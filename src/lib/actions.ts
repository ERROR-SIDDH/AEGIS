

'use server';

import { z } from 'zod';
import { getAdminsCollection, getAdminLogsCollection, getExamResultsCollection, getExamsCollection, getPcsCollection, getPcRequestsCollection, getQuestionsCollection, getStudentsCollection } from './mongodb';
import { revalidatePath } from 'next/cache';
import { WithId, Document, ObjectId } from 'mongodb';
import type { Question, Student, PC, Exam, Admin, AdminLog, ExamResult } from './types';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';


const questionSchema = z.object({
  questionText: z.string().min(10, {
    message: "Question text must be at least 10 characters.",
  }),
  options: z.array(z.object({ text: z.string().min(1, "Option text cannot be empty.") })).min(2, "At least two options are required."),
  correctOptions: z.array(z.coerce.number()).min(1, "At least one correct option must be selected."),
  category: z.enum(['Easy', 'Medium', 'Hard']),
  tags: z.array(z.string()),
  weight: z.coerce.number().min(0),
  negativeMarking: z.boolean(),
});


async function logAdminAction(action: string, details: Record<string, any> = {}) {
    try {
        const adminLogsCollection = await getAdminLogsCollection();
        const adminCookie = cookies().get('admin_user');
        const admin = adminCookie ? JSON.parse(adminCookie.value) : { username: 'System' };
        
        await adminLogsCollection.insertOne({
            adminUsername: admin.username,
            action,
            details,
            timestamp: new Date(),
        });
        revalidatePath('/dashboard/logs');
    } catch (error) {
        console.error('Failed to log admin action:', error);
    }
}

export async function saveQuestion(data: unknown) {
    const validatedFields = questionSchema.safeParse(data);

    if (!validatedFields.success) {
        console.error('Validation failed', validatedFields.error.flatten().fieldErrors);
        return {
            error: 'Invalid data provided.'
        }
    }

    const { questionText, ...rest } = validatedFields.data;

    try {
        const questionsCollection = await getQuestionsCollection();
        const questionData = {
            text: questionText,
            ...rest
        };
        await questionsCollection.insertOne(questionData);
        await logAdminAction('Created Question', { questionText: questionData.text });
        revalidatePath('/dashboard/questions');
        revalidatePath('/dashboard');
    } catch(e) {
        console.error(e);
        return {
            error: 'Failed to save question to the database.'
        }
    }
    redirect('/dashboard/questions');
}

export async function addStudent(data: unknown) {
  const studentSchema = z.object({
    name: z.string().min(1, "Name is required."),
    rollNumber: z.string().min(1, "Roll number is required."),
    classBatch: z.string().min(1, "Class/Batch is required."),
    examId: z.string().optional(),
  });

  const validatedFields = studentSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  try {
    const studentsCollection = await getStudentsCollection();
    const { examId, ...studentData } = validatedFields.data;

    const studentToInsert: Omit<Student, "_id"> = {
        ...studentData
    };

    if (examId) {
        studentToInsert.assignedExamId = new ObjectId(examId);
    }
    
    await studentsCollection.insertOne(studentToInsert);
    
    await logAdminAction('Added Student', { studentName: validatedFields.data.name, rollNumber: validatedFields.data.rollNumber });
    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error(error);
    return {
      error: 'Failed to add student.',
    };
  }
}

async function fetchAndMapDocuments<T extends Document>(collectionName: 'students' | 'pcs' | 'questions' | 'exams' | 'admins' | 'admin_logs'): Promise<WithId<T>[]> {
  let collection;
  switch (collectionName) {
    case 'students':
      collection = await getStudentsCollection();
      break;
    case 'pcs':
      collection = await getPcsCollection();
      break;
    case 'questions':
      collection = await getQuestionsCollection();
      break;
    case 'exams':
      collection = await getExamsCollection();
      break;
    case 'admins':
      collection = await getAdminsCollection();
      break;
    case 'admin_logs':
      collection = await getAdminLogsCollection();
      break;
    default:
      throw new Error('Invalid collection name');
  }

    const documents = await collection.find({}).sort({ timestamp: -1 }).toArray();
    return documents.map(doc => ({
        ...doc,
        _id: doc._id.toString(),
    })) as unknown as WithId<T>[]; // Cast through unknown to satisfy TS structure
}


export async function getStudents(): Promise<WithId<Student>[]> {
  try {
    const studentsCollection = await getStudentsCollection();
    const students = await studentsCollection.aggregate([
        {
            $lookup: {
                from: 'exams',
                localField: 'assignedExamId',
                foreignField: '_id',
                as: 'assignedExam'
            }
        },
        {
            $unwind: {
                path: '$assignedExam',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $addFields: {
                examTitle: '$assignedExam.title'
            }
        },
        {
            $project: {
                assignedExam: 0
            }
        }
    ]).toArray();
    return students.map(student => {
      const { _id, assignedExamId, ...rest } = student;
      const plainStudent: any = {
        _id: _id.toString(),
        ...rest,
      };
      if (assignedExamId) {
        plainStudent.assignedExamId = assignedExamId.toString();
      }
      return plainStudent as WithId<Student>;
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
}

export async function updateStudent(data: unknown) {
    const studentSchema = z.object({
        id: z.string(),
        name: z.string().min(1, "Name is required."),
        rollNumber: z.string().min(1, "Roll number is required."),
        classBatch: z.string().min(1, "Class/Batch is required."),
        examId: z.string().optional(),
    });

    const validatedFields = studentSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const studentsCollection = await getStudentsCollection();
        const { id, examId, ...studentData } = validatedFields.data;
        const studentObjectId = new ObjectId(id);

        const updateData: Partial<Omit<Student, '_id'>> = {
            ...studentData,
        };
        
        const unsetData: any = {};

        if (examId && examId !== 'unassigned') {
            updateData.assignedExamId = new ObjectId(examId);
        } else {
            unsetData.assignedExamId = "";
        }

        const updateOperation: any = { $set: updateData };
        if (Object.keys(unsetData).length > 0) {
            updateOperation.$unset = unsetData;
        }

        await studentsCollection.updateOne(
            { _id: studentObjectId },
            updateOperation
        );

        await logAdminAction('Updated Student', { studentName: studentData.name, rollNumber: studentData.rollNumber });
        revalidatePath('/dashboard/students');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error(error);
        return {
            error: 'Failed to update student.',
        };
    }
}


export async function deleteStudent(studentId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const studentObjectId = new ObjectId(studentId);
        const studentsCollection = await getStudentsCollection();
        const pcsCollection = await getPcsCollection();
        
        const studentToDelete = await studentsCollection.findOne({ _id: studentObjectId });
        if (!studentToDelete) {
            return { success: false, error: 'Student not found.' };
        }

        // Unassign student from any PC
        await pcsCollection.updateMany({ assignedStudentId: studentObjectId }, { $set: { assignedStudentId: null, assignedStudentName: null, assignedStudentRollNumber: null } });

        await studentsCollection.deleteOne({ _id: studentObjectId });
        await logAdminAction('Deleted Student', { studentName: studentToDelete.name, rollNumber: studentToDelete.rollNumber });
        
        revalidatePath('/dashboard/students');
        revalidatePath('/dashboard/pcs');
        revalidatePath('/dashboard/exams');
        return { success: true };
    } catch (error) {
        console.error('Error deleting student:', error);
        return { success: false, error: 'Failed to delete student.' };
    }
}


export async function getPcs(): Promise<WithId<PC>[]> {
    const pcsCollection = await getPcsCollection();
    const pcs = await pcsCollection.aggregate([
        {
            $lookup: {
                from: 'students',
                localField: 'assignedStudentId',
                foreignField: '_id',
                as: 'assignedStudent'
            }
        },
        {
            $unwind: {
                path: '$assignedStudent',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $addFields: {
                assignedStudentName: '$assignedStudent.name',
                assignedStudentRollNumber: '$assignedStudent.rollNumber'
            }
        },
        {
            $project: {
                assignedStudent: 0
            }
        }
    ]).sort({ name: 1 }).toArray();
    
    return pcs.map(pc => {
        const { _id, assignedStudentId, assignedExamId, ...rest } = pc;
        const plainPc: any = {
          _id: _id.toString(),
          ...rest,
        };
        if (assignedStudentId) {
          plainPc.assignedStudentId = assignedStudentId.toString();
        }
        if (assignedExamId) {
          plainPc.assignedExamId = assignedExamId.toString();
        }
        return plainPc as WithId<PC>;
      });
}


export async function getQuestions(questionIds?: ObjectId[]): Promise<WithId<Question>[]> {
    try {
        const questionsCollection = await getQuestionsCollection();
        const query = questionIds ? { _id: { $in: questionIds } } : {};
        const questions = await questionsCollection.find(query).toArray();
        
        return questions.map(q => ({
            ...(q as any),
            _id: q._id.toString(),
            text: q.text || (q as any).questionText,
        }));
    } catch (error) {
        console.error('Error fetching questions:', error);
        return [];
    }
}


export async function getExams(filter: { status?: 'Scheduled' | 'In Progress' | 'Completed' } = {}): Promise<WithId<Exam>[]> {
    try {
        const examsCollection = await getExamsCollection();
        const query = filter.status ? { status: filter.status } : {};
        const exams = await examsCollection.find(query).sort({ startTime: -1 }).toArray();
        return exams.map(exam => {
            const plainExam: any = { ...exam, _id: exam._id.toString() };
            if (exam.startTime) {
                plainExam.startTime = exam.startTime.toISOString();
            }
            if (exam.assignedStudentIds) {
                plainExam.assignedStudentIds = exam.assignedStudentIds.map((id: ObjectId | string) => id.toString());
            }
            if (exam.questionIds) {
                plainExam.questionIds = exam.questionIds.map((id: ObjectId | string) => id.toString());
            }
            return plainExam as WithId<Exam>;
        });
    } catch (error) {
        console.error('Error fetching exams:', error);
        return [];
    }
}


export async function getAdmins(): Promise<WithId<Admin>[]> {
  try {
    const adminsCollection = await getAdminsCollection();
    const admins = await adminsCollection.find({}).toArray();
     return admins.map(admin => ({
        ...admin,
        _id: admin._id.toString(),
    })) as WithId<Admin>[];
  } catch (error) {
    console.error('Error fetching admins:', error);
    return [];
  }
}

export async function getAdminLogs(): Promise<WithId<AdminLog>[]> {
  try {
    const logsCollection = await getAdminLogsCollection();
    const logs = await logsCollection.find({}).sort({ timestamp: -1 }).toArray();
    return logs.map(log => ({
        ...log,
        _id: log._id.toString(),
        timestamp: new Date(log.timestamp),
    })) as WithId<AdminLog>[];
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    return [];
  }
}

// Authentication Actions

export async function authenticate(prevState: any, formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    const adminsCollection = await getAdminsCollection();
    
    const admin = await adminsCollection.findOne({ username });

    if (admin && admin.password === password) {
        const adminUser = { username: admin.username, role: admin.role };
        cookies().set('auth', 'true', { path: '/' });
        cookies().set('admin_user', JSON.stringify(adminUser), { path: '/' });
        await logAdminAction('Admin Logged In');
        redirect('/dashboard');
    }

    return {
        message: 'Invalid username or password.',
    };
}


export async function logout() {
  const adminCookie = cookies().get('admin_user');
  if (adminCookie) {
    await logAdminAction('Admin Logged Out');
  }
  cookies().delete('auth');
  cookies().delete('admin_user');
  redirect('/login');
}


// PC Registration
function generateRandomString(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function registerPc(prevState: any, formData: FormData) {
    const pcName = formData.get('pcName') as string;
    
    if (!pcName || pcName.trim().length < 3) {
        return { message: "PC name must be at least 3 characters.", status: "error" };
    }

    try {
        const pcRequestsCollection = await getPcRequestsCollection();
        const uniqueIdentifier = `pc-id-${generateRandomString(12)}`;
        
        await pcRequestsCollection.insertOne({
            name: pcName,
            uniqueIdentifier,
            requestedAt: new Date(),
        });
        revalidatePath('/dashboard/pcs');

        return { message: `PC "${pcName}" has been submitted for approval.`, status: "success", identifier: uniqueIdentifier };
    } catch (error) {
        console.error('PC Registration Error:', error);
        return { message: "An error occurred while registering your PC. Please try again.", status: "error" };
    }
}


export async function getPcStatus(identifier: string) {
    try {
        if (!identifier) return { status: null, pcDetails: null };

        const pcsCollection = await getPcsCollection();
        const pc = await pcsCollection.findOne({ uniqueIdentifier: identifier });

        if (pc) {
            await pcsCollection.updateOne({ _id: pc._id }, { $set: { lastSeen: new Date() }});

            const pcWithDetailsCursor = pcsCollection.aggregate([
                { $match: { _id: pc._id } },
                {
                    $lookup: {
                        from: 'students',
                        localField: 'assignedStudentId',
                        foreignField: '_id',
                        as: 'assignedStudent'
                    }
                },
                { $unwind: { path: '$assignedStudent', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'exams',
                        localField: 'assignedStudent.assignedExamId',
                        foreignField: '_id',
                        as: 'exam'
                    }
                },
                { $unwind: { path: '$exam', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'exam_results',
                        let: { student_id: '$assignedStudent._id', exam_id: '$exam._id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$studentId', '$$student_id'] },
                                            { $eq: ['$examId', '$$exam_id'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'examResult'
                    }
                },
                {
                    $addFields: {
                        assignedStudentName: '$assignedStudent.name',
                        assignedStudentRollNumber: '$assignedStudent.rollNumber',
                        examAlreadyTaken: { $gt: [{ $size: '$examResult' }, 0] }
                    }
                },
                {
                    $project: { 
                        name: 1,
                        status: 1,
                        liveStatus: 1,
                        lastSeen: 1,
                        uniqueIdentifier: 1,
                        assignedStudentId: 1,
                        assignedStudentName: 1,
                        assignedStudentRollNumber: 1,
                        examAlreadyTaken: 1,
                        exam: {
                            _id: '$exam._id',
                            title: '$exam.title',
                            status: '$exam.status',
                        }
                    }
                }
            ]);

            const pcWithDetailsArray = await pcWithDetailsCursor.toArray();
            if (pcWithDetailsArray.length > 0) {
                const pcDetails = pcWithDetailsArray[0];
                 // Ensure exam object is not empty if there's no exam
                if (!pcDetails.exam?._id) {
                    pcDetails.exam = null;
                }
                
                // If exam has been taken, update the liveStatus to Finished
                if (pcDetails.examAlreadyTaken && pc.liveStatus !== 'Finished') {
                    await pcsCollection.updateOne({ _id: pc._id }, { $set: { liveStatus: 'Finished' } });
                    pcDetails.liveStatus = 'Finished';
                }
                
                return { status: pc.status, pcDetails: JSON.parse(JSON.stringify(pcDetails)) };
            }
            
            return { status: pc.status, pcDetails: JSON.parse(JSON.stringify(pc)) };
        }

        const pcRequestsCollection = await getPcRequestsCollection();
        const pcRequest = await pcRequestsCollection.findOne({ uniqueIdentifier: identifier });
        if (pcRequest) {
            return { status: 'Pending', pcDetails: null };
        }

        return { status: null, pcDetails: null };

    } catch (error) {
        console.error('Error fetching PC status:', error);
        return { status: null, pcDetails: null, error: "Database error" };
    }
}


export async function updatePcStatus(pcId: string, status: 'Approved' | 'Rejected') {
  try {
    const pcsCollection = await getPcsCollection();
    const pc = await pcsCollection.findOne({ _id: new ObjectId(pcId) });

    if (!pc) {
      return { success: false, error: 'PC not found.' };
    }

    if (status === 'Rejected') {
        await pcsCollection.deleteOne({ _id: new ObjectId(pcId) });
        await logAdminAction(`PC Rejected and Removed`, { pcName: pc?.name });
    } else if (status === 'Approved') {
        const updateData: any = { 
            status: 'Approved', 
            liveStatus: 'Online', 
            lastSeen: new Date() 
        };
        
        // If PC doesn't have a macAddress, assign one
        if (!pc.macAddress) {
            let uniqueMacAddress = generateUniqueMacAddress();
            
            // Ensure the MAC address is truly unique
            while (await pcsCollection.findOne({ macAddress: uniqueMacAddress, _id: { $ne: pc._id } })) {
                uniqueMacAddress = generateUniqueMacAddress();
            }
            
            updateData.macAddress = uniqueMacAddress;
        }
        
        // If PC doesn't have a deviceToken, assign one
        if (!pc.deviceToken) {
            let uniqueDeviceToken = generateUniqueDeviceToken();
            
            // Ensure the device token is truly unique
            while (await pcsCollection.findOne({ deviceToken: uniqueDeviceToken, _id: { $ne: pc._id } })) {
                uniqueDeviceToken = generateUniqueDeviceToken();
            }
            
            updateData.deviceToken = uniqueDeviceToken;
        }
        
        await pcsCollection.updateOne(
          { _id: new ObjectId(pcId) },
          { $set: updateData }
        );
        await logAdminAction(`PC Approved`, { 
            pcName: pc?.name, 
            macAddress: updateData.macAddress, 
            deviceToken: updateData.deviceToken 
        });
    }

    revalidatePath('/dashboard/pcs');
    return { success: true };
  } catch (error) {
    console.error('Error updating PC status:', error);
    return { error: 'Failed to update PC status.' };
  }
}

export async function deletePc(pcId: string) {
    try {
        const pcsCollection = await getPcsCollection();
        const pc = await pcsCollection.findOne({ _id: new ObjectId(pcId) });

        await pcsCollection.deleteOne({ _id: new ObjectId(pcId) });
        await logAdminAction(`PC Deleted`, { pcName: pc?.name });
        revalidatePath('/dashboard/pcs');
        revalidatePath('/dashboard/live-status');
        return { success: true };
    } catch (error) {
        console.error('Error deleting PC:', error);
        return { error: 'Failed to delete PC.' };
    }
}

export async function addAdmin(data: unknown) {
  const adminSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    role: z.enum(['admin', 'superadmin']),
  });

  const validatedFields = adminSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  try {
    const adminsCollection = await getAdminsCollection();
    const existingAdmin = await adminsCollection.findOne({ username: validatedFields.data.username });
    if (existingAdmin) {
      return { error: 'An admin with this username already exists.' };
    }

    await adminsCollection.insertOne(validatedFields.data);
    await logAdminAction('Admin Created', { newAdminUsername: validatedFields.data.username, role: validatedFields.data.role });
    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error) {
    console.error(error);
    return {
      error: 'Failed to add new admin.',
    };
  }
}

export async function deleteAdmin(adminId: string) {
    try {
        const adminCookie = cookies().get('admin_user');
        if (!adminCookie) return { error: 'Authentication required.' };
        
        const currentUser = JSON.parse(adminCookie.value);

        const adminToDeleteId = new ObjectId(adminId);

        const adminsCollection = await getAdminsCollection();
        const adminToDelete = await adminsCollection.findOne({ _id: adminToDeleteId });

        if (!adminToDelete) {
            return { error: 'Admin not found.' };
        }
        
        if (adminToDelete.username === currentUser.username) {
            return { error: 'You cannot delete your own account.' };
        }

        await adminsCollection.deleteOne({ _id: adminToDeleteId });
        await logAdminAction(`Admin Deleted`, { deletedAdminUsername: adminToDelete.username });
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error) {
        console.error('Error deleting admin:', error);
        return { error: 'Failed to delete admin.' };
    }
}

export async function scheduleExam(data: Omit<Exam, '_id' | 'status' | 'questionIds'>) {
    const examSchema = z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        startTime: z.date(),
        duration: z.number().min(1, "Duration must be positive"),
        numberOfQuestions: z.number().min(1, "Number of questions must be at least 1"),
    });

    const validatedFields = examSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            error: 'One or more fields are invalid.',
        }
    }

    try {
        const examsCollection = await getExamsCollection();
        const newExam: Omit<Exam, '_id'> = {
            ...validatedFields.data,
            status: 'Scheduled',
            questionIds: [],
        }
        await examsCollection.insertOne(newExam);
        await logAdminAction('Scheduled Exam', { examTitle: validatedFields.data.title });
        revalidatePath('/dashboard/exams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Error scheduling exam:', error);
        return { error: 'Failed to schedule exam.' };
    }
}


export async function updateExam(data: Omit<Exam, 'status' | 'questionIds' | 'assignedStudentIds'> & { id: string }) {
    const examSchema = z.object({
        id: z.string(),
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        startTime: z.date(),
        duration: z.number().min(1, "Duration must be positive"),
        numberOfQuestions: z.number().min(1, "Number of questions must be at least 1"),
    });

    const validatedFields = examSchema.safeParse(data);

    if (!validatedFields.success) {
        return { error: 'One or more fields are invalid.' };
    }

    try {
        const examsCollection = await getExamsCollection();
        const { id, ...examData } = validatedFields.data;

        await examsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: examData }
        );

        await logAdminAction('Updated Exam', { examTitle: examData.title });
        revalidatePath('/dashboard/exams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Error updating exam:', error);
        return { error: 'Failed to update exam.' };
    }
}


export async function startExamNow(examId: string) {
    try {
        const examsCollection = await getExamsCollection();
        const questionsCollection = await getQuestionsCollection();
        const exam = await examsCollection.findOne({ _id: new ObjectId(examId) });

        if (!exam) return { error: 'Exam not found.' };

        // Get random questions based on the number specified in the exam
        const randomQuestions = await questionsCollection.aggregate([
            { $sample: { size: exam.numberOfQuestions || 10 } }
        ]).toArray();

        const questionIds = randomQuestions.map(q => q._id);

        await examsCollection.updateOne(
            { _id: new ObjectId(examId) },
            { $set: { status: 'In Progress', startTime: new Date(), questionIds: questionIds } }
        );

        await logAdminAction('Started Exam Manually', { examTitle: exam.title });
        revalidatePath('/dashboard/exams');
        revalidatePath('/dashboard');
        revalidatePath('/');
        revalidatePath('/dashboard/live-status');
        return { success: true };
    } catch (error) {
        console.error('Error starting exam:', error);
        return { error: 'Failed to start exam.' };
    }
}

export async function endExam(examId: string) {
    try {
        const examsCollection = await getExamsCollection();
        const exam = await examsCollection.findOne({ _id: new ObjectId(examId) });

        if (!exam) return { error: 'Exam not found.' };

        await examsCollection.updateOne(
            { _id: new ObjectId(examId) },
            { $set: { status: 'Completed' } }
        );

        await logAdminAction('Ended Exam Manually', { examTitle: exam.title });
        revalidatePath('/dashboard/exams');
        revalidatePath('/');
        revalidatePath('/dashboard/live-status');
        return { success: true };
    } catch (error) {
        console.error('Error ending exam:', error);
        return { error: 'Failed to end exam.' };
    }
}

export async function deleteExam(examId: string) {
    try {
        const examsCollection = await getExamsCollection();
        const exam = await examsCollection.findOne({ _id: new ObjectId(examId) });

        if (!exam) return { error: 'Exam not found.' };

        await examsCollection.deleteOne({ _id: new ObjectId(examId) });
        await logAdminAction('Deleted Exam', { examTitle: exam.title });

        revalidatePath('/dashboard/exams');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Error deleting exam:', error);
        return { error: 'Failed to delete exam.' };
    }
}


export async function assignStudentToPc(pcId: string, studentId: string | null) {
  try {
    const pcsCollection = await getPcsCollection();
    const studentsCollection = await getStudentsCollection();
    const pcObjectId = new ObjectId(pcId);
    
    let studentToAssign = null;
    let studentExamId: ObjectId | null = null;
    let studentObjectId: ObjectId | null = null;

    if (studentId) {
        studentObjectId = new ObjectId(studentId);
        
        const existingAssignment = await pcsCollection.findOne({ assignedStudentId: studentObjectId, _id: { $ne: pcObjectId } });
        if (existingAssignment) {
            return { error: 'This student is already assigned to another PC.' };
        }

        studentToAssign = await studentsCollection.findOne({_id: studentObjectId});
        if (studentToAssign && studentToAssign.assignedExamId) {
            studentExamId = studentToAssign.assignedExamId as ObjectId;
        }
    }

    await pcsCollection.updateOne(
      { _id: pcObjectId },
      { $set: { 
          assignedStudentId: studentObjectId,
          assignedExamId: studentExamId,
          liveStatus: studentObjectId ? 'Ready' : 'Online',
          lastSeen: new Date(),
      } }
    );
    
    const pc = await pcsCollection.findOne({ _id: pcObjectId });

    await logAdminAction('Assigned Student to PC', {
      pcName: pc?.name,
      studentName: studentToAssign ? studentToAssign.name : 'None'
    });

    revalidatePath('/dashboard/pcs');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error assigning student to PC:', error);
    return { error: 'Failed to assign student.' };
  }
}


export async function getExamDetails(examId: string, studentId: string, pcIdentifier?: string) {
    try {
        const examsCollection = await getExamsCollection();
        const examResultsCollection = await getExamResultsCollection();
        const pcsCollection = await getPcsCollection();
        const studentsCollection = await getStudentsCollection();
        
        const examObjectId = new ObjectId(examId);
        const studentObjectId = new ObjectId(studentId);

        // Optional server-side guard: ensure the request comes from the mapped PC and exam
        if (pcIdentifier) {
            const pc = await pcsCollection.findOne({ uniqueIdentifier: pcIdentifier });
            if (!pc) {
                return { exam: null, questions: [], alreadyTaken: false, error: 'PC not registered.' };
            }
            if (!pc.assignedStudentId || !pc.assignedStudentId.equals?.(studentObjectId)) {
                return { exam: null, questions: [], alreadyTaken: false, error: 'Student is not assigned to this PC.' };
            }
            // Verify the student's assigned exam matches the requested exam
            const studentDoc = await studentsCollection.findOne({ _id: studentObjectId });
            if (!studentDoc || !studentDoc.assignedExamId || !studentDoc.assignedExamId.equals?.(examObjectId)) {
                return { exam: null, questions: [], alreadyTaken: false, error: 'This student is not assigned to this exam.' };
            }
        }

        // Check if the student has already taken this exam
        const existingResult = await examResultsCollection.findOne({
            examId: examObjectId,
            studentId: studentObjectId,
        });

        if (existingResult) {
            return { exam: null, questions: [], alreadyTaken: true };
        }

        const exam = await examsCollection.findOne({ _id: examObjectId });
        
        if (!exam || !exam.questionIds) {
            return { exam: null, questions: [], alreadyTaken: false };
        }
        
        if (exam.questionIds.length === 0) {
            return { exam: null, questions: [], alreadyTaken: false };
        }

        // Only allow access while exam is in progress
        if (exam.status !== 'In Progress') {
            return { exam: null, questions: [], alreadyTaken: false, error: 'Exam is not in progress.' };
        }

        const questions = await getQuestions(exam.questionIds as ObjectId[]);
        
        const serializableExam = {
             ...exam,
            _id: exam._id.toString(),
            startTime: exam.startTime.toISOString(),
            questionIds: exam.questionIds.map((id: ObjectId | string) => id.toString())
        };

        const serializableQuestions = questions.map(q => ({
            ...q,
            _id: q._id.toString()
        }));

        return {
            exam: serializableExam,
            questions: serializableQuestions,
            alreadyTaken: false,
        };

    } catch (error) {
        console.error('Error fetching exam details:', error);
        return { exam: null, questions: [], alreadyTaken: false };
    }
}


export async function submitExam(examId: string, studentId: string, answers: { questionId: string, selectedOption: number | null }[], pcIdentifier?: string) {
    try {
        const examsCollection = await getExamsCollection();
        const questionsCollection = await getQuestionsCollection();
        const studentsCollection = await getStudentsCollection();
        const examResultsCollection = await getExamResultsCollection();
        const pcsCollection = await getPcsCollection();

        const examObjectId = new ObjectId(examId);
        const studentObjectId = new ObjectId(studentId);

        const exam = await examsCollection.findOne({ _id: examObjectId });
        const student = await studentsCollection.findOne({ _id: studentObjectId });

        if (!exam || !student) {
            return { error: 'Invalid exam or student.' };
        }

        // Optional server-side guard: ensure submission originates from mapped PC and exam
        if (pcIdentifier) {
            const pc = await pcsCollection.findOne({ uniqueIdentifier: pcIdentifier });
            if (!pc) {
                return { error: 'PC not registered.' };
            }
            if (!pc.assignedStudentId || !pc.assignedStudentId.equals?.(studentObjectId)) {
                return { error: 'Student is not assigned to this PC.' };
            }
            if (!student.assignedExamId || !student.assignedExamId.equals?.(examObjectId)) {
                return { error: 'Student is not assigned to this exam.' };
            }
            if (exam.status !== 'In Progress') {
                return { error: 'Exam is not in progress.' };
            }
        }

        // Prevent re-submission
        const existingResult = await examResultsCollection.findOne({ examId: examObjectId, studentId: studentObjectId });
        if (existingResult) {
            return { error: 'You have already submitted this exam.' };
        }
        
        // Only consider answers for questions that belong to this exam
        const validQuestionIds = new Set((exam.questionIds || []).map((id: any) => id.toString()));
        const filteredAnswers = answers.filter(a => validQuestionIds.has(a.questionId));

        const questionIds = filteredAnswers.map(a => new ObjectId(a.questionId));
        const questions = await questionsCollection.find({ _id: { $in: questionIds } }).toArray();
        
        let score = 0;
        questions.forEach(q => {
            const answer = filteredAnswers.find(a => a.questionId === q._id.toString());
            if (answer && answer.selectedOption !== null && q.correctOptions.includes(answer.selectedOption)) {
                score += q.weight || 1;
            }
        });

        const examResult: Omit<ExamResult, '_id'> = {
            examId: examObjectId,
            studentId: studentObjectId,
            studentName: student.name,
            examTitle: exam.title,
            answers,
            score,
            totalQuestions: questions.length,
            completedAt: new Date(),
        };

        await examResultsCollection.insertOne(examResult);
        
        // Update PC status to Finished
        // Mark only this PC as Finished if identifier is provided; otherwise fall back to student binding
        if (pcIdentifier) {
            await pcsCollection.updateOne(
                { uniqueIdentifier: pcIdentifier },
                { $set: { liveStatus: 'Finished' } }
            );
        } else {
            await pcsCollection.updateOne(
                { assignedStudentId: studentObjectId },
                { $set: { liveStatus: 'Finished' } }
            );
        }


        revalidatePath('/dashboard/results');
        revalidatePath('/dashboard/live-status');
        return { success: true };

    } catch (error) {
        console.error('Error submitting exam:', error);
        return { error: 'Failed to submit exam.' };
    }
}


export async function getExamResults(): Promise<WithId<ExamResult>[]> {
    try {
        const resultsCollection = await getExamResultsCollection();
        const results = await resultsCollection.find({}).sort({ completedAt: -1 }).toArray();
        return results.map(result => ({
            ...result,
            _id: result._id.toString(),
            examId: result.examId.toString(),
            studentId: result.studentId.toString(),
            completedAt: new Date(result.completedAt),
        })) as WithId<ExamResult>[];
    } catch (error) {
        console.error('Error fetching exam results:', error);
        return [];
    }
}


export async function updatePcLiveStatus(pcIdentifier: string, status: PC['liveStatus']) {
    try {
        const pcsCollection = await getPcsCollection();
        const result = await pcsCollection.updateOne(
            { uniqueIdentifier: pcIdentifier },
            { $set: { liveStatus: status, lastSeen: new Date() } }
        );

        if (result.modifiedCount > 0) {
            revalidatePath('/dashboard/live-status');
            return { success: true };
        }
        return { success: false, error: "PC not found or status not changed." };
    } catch (error) {
        console.error('Error updating PC live status:', error);
        return { success: false, error: 'Failed to update status.' };
    }
}
    
export async function getLivePcStatuses(): Promise<WithId<PC>[]> {
    try {
        const pcsCollection = await getPcsCollection();
        const pcs = await pcsCollection.aggregate([
            {
                $lookup: {
                    from: 'exams',
                    localField: 'assignedExamId',
                    foreignField: '_id',
                    as: 'exam'
                }
            },
            {
                $unwind: { path: '$exam', preserveNullAndEmptyArrays: true }
            },
            {
                $match: {
                    'assignedStudentId': { $exists: true, $ne: null },
                    'exam.status': 'In Progress'
                }
            },
            {
                $lookup: {
                    from: 'students',
                    localField: 'assignedStudentId',
                    foreignField: '_id',
                    as: 'student'
                }
            },
            {
                $unwind: { path: '$student', preserveNullAndEmptyArrays: true }
            },
             {
                $addFields: {
                    'student.name': '$student.name',
                    'student.rollNumber': '$student.rollNumber',
                    'exam.title': '$exam.title',
                }
            },
             {
                $project: {
                    'student._id': 0,
                    'student.classBatch': 0,
                    'student.assignedExamId': 0,
                    'exam._id': 0,
                    'exam.description': 0,
                    'exam.startTime': 0,
                    'exam.duration': 0,
                    'exam.numberOfQuestions': 0,
                    'exam.questionIds': 0,
                }
            }
        ]).sort({ name: 1 }).toArray();
        
        return pcs.map(pc => {
            const { _id, ...rest } = pc as any;
            return { _id: _id.toString(), ...rest } as WithId<PC>;
        });

    } catch (error) {
        console.error('Error fetching live PC statuses:', error);
        return [];
    }
}

export async function getPcRequests() {
    const pcRequestsCollection = await getPcRequestsCollection();
    const requests = await pcRequestsCollection.find({}).sort({ requestedAt: -1 }).toArray();
    return requests.map(req => ({
        ...req,
        _id: req._id.toString(),
    }));
}

// Generate a unique MAC address-like string
function generateUniqueMacAddress(): string {
    const generateHexPair = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return Array.from({ length: 6 }, generateHexPair).join(':').toUpperCase();
}

// Generate a unique device token
function generateUniqueDeviceToken(): string {
    return 'dev-' + Math.random().toString(36).substring(2) + '-' + Date.now().toString(36);
}

// One-time function to fix existing PCs with null macAddress or deviceToken
export async function fixExistingPcMacAddresses() {
    try {
        const pcsCollection = await getPcsCollection();
        
        // Find all PCs without macAddress/deviceToken or with null values
        const pcsToFix = await pcsCollection.find({ 
            $or: [
                { macAddress: null },
                { macAddress: { $exists: false } },
                { deviceToken: null },
                { deviceToken: { $exists: false } }
            ]
        }).toArray();

        console.log(`Found ${pcsToFix.length} PCs to fix`);

        for (const pc of pcsToFix) {
            const updateData: any = {};
            
            if (!pc.macAddress) {
                updateData.macAddress = generateUniqueMacAddress();
            }
            
            if (!pc.deviceToken) {
                updateData.deviceToken = generateUniqueDeviceToken();
            }
            
            if (Object.keys(updateData).length > 0) {
                await pcsCollection.updateOne(
                    { _id: pc._id },
                    { $set: updateData }
                );
                console.log(`Fixed PC ${pc.name} with:`, updateData);
            }
        }

        return { success: true, fixedCount: pcsToFix.length };
    } catch (error) {
        console.error('Error fixing PC fields:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function approvePcRequest(requestId: string) {
    try {
        if (!ObjectId.isValid(requestId)) {
            return { success: false, error: "Invalid request ID format." };
        }
        
        const pcRequestsCollection = await getPcRequestsCollection();
        const pcsCollection = await getPcsCollection();
        
        const request = await pcRequestsCollection.findOne({ _id: new ObjectId(requestId) });

        if (!request) {
            return { success: false, error: "Request not found." };
        }

        // Check if PC with same uniqueIdentifier already exists
        const existingPc = await pcsCollection.findOne({ uniqueIdentifier: request.uniqueIdentifier });
        if (existingPc) {
            return { success: false, error: "PC with this identifier already exists." };
        }

        // Generate unique values for all constrained fields
        let uniqueMacAddress = generateUniqueMacAddress();
        let uniqueDeviceToken = generateUniqueDeviceToken();
        
        // Ensure the MAC address is truly unique
        while (await pcsCollection.findOne({ macAddress: uniqueMacAddress })) {
            uniqueMacAddress = generateUniqueMacAddress();
        }
        
        // Ensure the device token is truly unique
        while (await pcsCollection.findOne({ deviceToken: uniqueDeviceToken })) {
            uniqueDeviceToken = generateUniqueDeviceToken();
        }

        const newPc: any = {
            name: request.name,
            uniqueIdentifier: request.uniqueIdentifier,
            ipAddress: 'N/A',
            macAddress: uniqueMacAddress,
            deviceToken: uniqueDeviceToken,
            status: 'Approved',
            liveStatus: 'Online',
            lastSeen: new Date(),
        };

        await pcsCollection.insertOne(newPc);
        await pcRequestsCollection.deleteOne({ _id: new ObjectId(requestId) });

        await logAdminAction('Approved PC Request', { 
            pcName: request.name, 
            macAddress: uniqueMacAddress, 
            deviceToken: uniqueDeviceToken 
        });
        revalidatePath('/dashboard/pcs');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Error approving PC request:', error);
        return { success: false, error: `Failed to approve PC request: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}

export async function rejectPcRequest(requestId: string) {
    try {
        if (!ObjectId.isValid(requestId)) {
            return { success: false, error: "Invalid request ID format." };
        }
        const pcRequestsCollection = await getPcRequestsCollection();
        const request = await pcRequestsCollection.findOne({ _id: new ObjectId(requestId) });

        if (!request) {
            return { success: false, error: "Request not found." };
        }

        await pcRequestsCollection.deleteOne({ _id: new ObjectId(requestId) });

        await logAdminAction('Rejected PC Request', { pcName: request.name });
        revalidatePath('/dashboard/pcs');
        return { success: true };
    } catch (error) {
        console.error('Error rejecting PC request:', error);
        return { success: false, error: "Failed to reject PC request." };
    }
}

export async function bulkAssignExamToStudents(studentIds: string[], examId: string) {
    if (!studentIds || studentIds.length === 0 || !examId) {
        return { success: false, error: "Invalid student IDs or exam ID." };
    }
    
    try {
        const studentsCollection = await getStudentsCollection();
        const examsCollection = await getExamsCollection();
        
        const studentObjectIds = studentIds.map(id => new ObjectId(id));
        const examObjectId = new ObjectId(examId);

        const exam = await examsCollection.findOne({ _id: examObjectId });
        if (!exam) {
            return { success: false, error: "Exam not found." };
        }

        const result = await studentsCollection.updateMany(
            { _id: { $in: studentObjectIds } },
            { $set: { assignedExamId: examObjectId } }
        );

        await logAdminAction('Bulk Assigned Exam', { examTitle: exam.title, studentCount: result.modifiedCount });
        revalidatePath('/dashboard/students');
        return { success: true, modifiedCount: result.modifiedCount };

    } catch (error) {
        console.error('Error bulk assigning exam:', error);
        return { success: false, error: 'Failed to assign exam to students.' };
    }
}
