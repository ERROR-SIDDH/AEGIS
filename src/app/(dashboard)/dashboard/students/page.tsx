

'use client';
import { getStudents, addStudent, deleteStudent, getExams, updateStudent, bulkAssignExamToStudents } from '@/lib/actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Upload, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BulkUploadStudents } from '@/components/bulk-upload-students';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useTransition } from 'react';
import type { Student, Exam } from '@/lib/types';
import type { WithId } from 'mongodb';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';


const studentSchema = z.object({
  name: z.string().min(1, "Name is required."),
  rollNumber: z.string().min(1, "Roll number is required."),
  classBatch: z.string().min(1, "Class/Batch is required."),
  examId: z.string().optional(),
});

const editStudentSchema = studentSchema.extend({
    id: z.string(),
});


export default function StudentsPage() {
    const [students, setStudents] = useState<WithId<Student>[]>([]);
    const [scheduledExams, setScheduledExams] = useState<WithId<Exam>[]>([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState<WithId<Student> | null>(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [bulkAssignExamId, setBulkAssignExamId] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchStudentsAndExams = () => {
        getStudents().then(setStudents);
        getExams({ status: 'Scheduled' }).then(setScheduledExams);
    };

    useEffect(() => {
        fetchStudentsAndExams();
    }, []);

    const addForm = useForm({
        resolver: zodResolver(studentSchema),
        defaultValues: {
        name: '',
        rollNumber: '',
        classBatch: '',
        examId: '',
        },
    });

    const editForm = useForm({
        resolver: zodResolver(editStudentSchema),
        defaultValues: {
            id: '',
            name: '',
            rollNumber: '',
            classBatch: '',
            examId: '',
        }
    });

    const onAddSubmit = async (data: z.infer<typeof studentSchema>) => {
        const result = await addStudent(data);
        if (result?.success) {
        toast({ title: "Student Added", description: "The new student has been saved." });
        setAddDialogOpen(false);
        addForm.reset();
        fetchStudentsAndExams();
        } else {
        toast({ title: "Error", description: result?.error || "An unknown error occurred.", variant: "destructive" });
        }
    };
    
    const onEditSubmit = async (data: z.infer<typeof editStudentSchema>) => {
        const result = await updateStudent(data);
         if (result?.success) {
            toast({ title: "Student Updated", description: "The student's details have been saved." });
            setEditDialogOpen(false);
            fetchStudentsAndExams();
        } else {
            toast({ title: "Error", description: result?.error || "An unknown error occurred.", variant: "destructive" });
        }
    };

    const handleOpenEditDialog = (student: WithId<Student>) => {
        setStudentToEdit(student);
        editForm.reset({
            id: student._id.toString(),
            name: student.name,
            rollNumber: student.rollNumber,
            classBatch: student.classBatch,
            examId: student.assignedExamId?.toString() || '',
        });
        setEditDialogOpen(true);
    };


    const handleDelete = (studentId: string) => {
        startTransition(async () => {
            const result = await deleteStudent(studentId);
            if (result.success) {
                toast({ title: 'Success', description: 'Student has been deleted.' });
                fetchStudentsAndExams();
            } else {
                toast({ title: 'Error', description: result.error || 'Failed to delete student.', variant: 'destructive' });
            }
        });
    }

    const handleSelectStudent = (studentId: string, checked: boolean | 'indeterminate') => {
        if (checked) {
            setSelectedStudentIds(prev => [...prev, studentId]);
        } else {
            setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
        }
    };

    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (checked) {
            setSelectedStudentIds(students.map(s => s._id.toString()));
        } else {
            setSelectedStudentIds([]);
        }
    };

    const handleBulkAssign = async () => {
        if (selectedStudentIds.length === 0 || !bulkAssignExamId) {
            toast({ title: 'Error', description: 'Please select students and an exam.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const result = await bulkAssignExamToStudents(selectedStudentIds, bulkAssignExamId);
            if (result.success) {
                toast({ title: 'Success', description: `${result.modifiedCount} students have been assigned to the exam.` });
                fetchStudentsAndExams();
                setSelectedStudentIds([]);
                setBulkAssignExamId('');
                setBulkAssignDialogOpen(false);
            } else {
                toast({ title: 'Error', description: result.error || 'Failed to assign exam.', variant: 'destructive' });
            }
        });
    };


  return (
    <>
        <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Student Management</CardTitle>
                    <CardDescription>
                    Add, edit, and manage all student records in the system.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                     <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Upload className="mr-2 h-4 w-4" />
                                Bulk Upload
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <BulkUploadStudents onUploadComplete={() => {
                                fetchStudentsAndExams();
                                setBulkUploadDialogOpen(false);
                            }} />
                        </DialogContent>
                    </Dialog>
                    <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" disabled={selectedStudentIds.length === 0}>
                                <ClipboardList className="mr-2 h-4 w-4" />
                                Assign Exam to Selected ({selectedStudentIds.length})
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Bulk Assign Exam</DialogTitle>
                                <DialogDescription>
                                    Assign an exam to the {selectedStudentIds.length} selected students.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                               <Select onValueChange={setBulkAssignExamId} value={bulkAssignExamId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a scheduled exam" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {scheduledExams.map(exam => (
                                            <SelectItem key={exam._id as string} value={exam._id as string}>
                                                {exam.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleBulkAssign} disabled={isPending || !bulkAssignExamId}>
                                    {isPending ? 'Assigning...' : 'Assign Exam'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> Add Student</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Student</DialogTitle>
                            </DialogHeader>
                            <Form {...addForm}>
                                <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                                    <FormField
                                    control={addForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={addForm.control}
                                    name="rollNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Roll Number</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                    control={addForm.control}
                                    name="classBatch"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Class/Batch</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                    <FormField
                                        control={addForm.control}
                                        name="examId"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Assign to Exam (Optional)</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a scheduled exam" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {scheduledExams.map(exam => (
                                                        <SelectItem key={exam._id as string} value={exam._id as string}>
                                                            {exam.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <Button type="submit" disabled={addForm.formState.isSubmitting}>
                                            {addForm.formState.isSubmitting ? 'Saving...' : 'Save Student'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                 <TableHead padding="checkbox">
                    <Checkbox
                        checked={selectedStudentIds.length === students.length && students.length > 0}
                        onCheckedChange={(checked) => handleSelectAll(checked)}
                        aria-label="Select all"
                    />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Roll Number</TableHead>
                <TableHead>Class / Batch</TableHead>
                <TableHead>Assigned Exam</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {students.map((student) => (
                <TableRow key={student._id as string}
                    data-state={selectedStudentIds.includes(student._id.toString()) && "selected"}
                >
                     <TableCell padding="checkbox">
                        <Checkbox
                            checked={selectedStudentIds.includes(student._id.toString())}
                            onCheckedChange={(checked) => handleSelectStudent(student._id.toString(), checked)}
                            aria-label={`Select student ${student.name}`}
                        />
                    </TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.rollNumber}</TableCell>
                    <TableCell>{student.classBatch}</TableCell>
                    <TableCell>
                        {student.examTitle ? (
                            <Badge variant="secondary" className="flex items-center gap-1.5">
                                <ClipboardList className="h-3 w-3" />
                                {student.examTitle}
                            </Badge>
                        ) : (
                            <span className="text-muted-foreground">Not Assigned</span>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                    <AlertDialog>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenEditDialog(student)}>Edit</DropdownMenuItem>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the student record for <span className="font-bold">{student.name}</span>.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(student._id.toString())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </CardContent>
        </Card>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Student</DialogTitle>
                </DialogHeader>
                <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                        <FormField
                        control={editForm.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={editForm.control}
                        name="rollNumber"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Roll Number</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={editForm.control}
                        name="classBatch"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Class/Batch</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                            control={editForm.control}
                            name="examId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Assign to Exam (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a scheduled exam" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Not Assigned</SelectItem>
                                        {scheduledExams.map(exam => (
                                            <SelectItem key={exam._id as string} value={exam._id as string}>
                                                {exam.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                             <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={editForm.formState.isSubmitting}>
                                {editForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </>
  );
}
