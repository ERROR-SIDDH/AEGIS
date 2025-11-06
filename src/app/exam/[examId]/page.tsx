'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getExamDetails, submitExam, getPcStatus, updatePcLiveStatus } from '@/lib/actions';
import type { Question } from '@/lib/types';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


type ClientExam = {
  _id: string;
  title: string;
  duration: number;
  startTime: string;
  questionIds: string[];
  status: 'Scheduled' | 'In Progress' | 'Completed';
}

export default function ExamPage() {
    const [exam, setExam] = useState<ClientExam | null>(null);
    const [questions, setQuestions] = useState<WithId<Question>[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<{ questionId: string; selectedOption: number | null }[]>([]);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, startTransition] = useTransition();
    const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [alreadyTaken, setAlreadyTaken] = useState(false);

    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const examId = params.examId as string;

    const handleExamSubmit = useCallback(async () => {
        if (isSubmitting) return;

        startTransition(async () => {
            const pcIdentifier = localStorage.getItem('pcIdentifier');
            if (!pcIdentifier) {
                 toast({ title: 'Error', description: 'PC identifier not found. Cannot submit exam.', variant: 'destructive' });
                 return;
            }
            const pcStatus = await getPcStatus(pcIdentifier);
            const studentId = pcStatus.pcDetails?.assignedStudentId;

            if (!studentId) {
                toast({ title: 'Error', description: 'Student not assigned to this PC. Cannot submit.', variant: 'destructive' });
                return;
            }
            
            const result = await submitExam(examId, studentId, answers, pcIdentifier);

            if (result.success) {
                toast({ title: 'Success', description: 'Exam submitted successfully!' });
                router.push('/'); // Redirect to home/portal page
            } else {
                 toast({ title: 'Error', description: result.error || 'Failed to submit exam.', variant: 'destructive' });
            }
        });
    }, [examId, answers, router, toast, isSubmitting]);

    useEffect(() => {
        if (!examId) {
            setIsLoading(false);
            return;
        }

        const pcIdentifier = localStorage.getItem('pcIdentifier');
        if (!pcIdentifier) {
            setPageError('PC identifier not found. This device is not registered for the exam.');
            setIsLoading(false);
            return;
        }

        const fetchDetails = async () => {
            const pcStatus = await getPcStatus(pcIdentifier);
            const studentId = pcStatus.pcDetails?.assignedStudentId;

            if (!studentId) {
                setPageError('No student is assigned to this PC. Please contact an administrator.');
                setIsLoading(false);
                return;
            }

            try {
                // Extra guard on client: ensure this PC's assigned exam matches the URL
                const assignedExamId = pcStatus.pcDetails?.exam?._id?.toString();
                if (!assignedExamId || assignedExamId !== examId) {
                    setPageError('This PC is not assigned to this exam.');
                    setIsLoading(false);
                    return;
                }

                const data = await getExamDetails(examId, studentId, pcIdentifier);
                
                if (data.alreadyTaken) {
                    setAlreadyTaken(true);
                    setIsLoading(false);
                    return;
                }

                if (data && data.exam && data.questions.length > 0) {
                    setExam(data.exam as ClientExam);
                    setQuestions(data.questions);
                    setAnswers(data.questions.map(q => ({ questionId: q._id as string, selectedOption: null })));
                    
                    const examEndTime = new Date((data.exam as any).startTime).getTime() + (data.exam as any).duration * 60 * 1000;
                    const now = new Date().getTime();
                    const remainingTime = Math.max(0, Math.floor((examEndTime - now) / 1000));
                    setTimeLeft(remainingTime);

                    // Start sending heartbeats
                    updatePcLiveStatus(pcIdentifier, 'Attempting');
                } else {
                    setPageError(data?.error || "The exam might not have started or there are no questions.");
                }
            } catch (e) {
                toast({ title: 'Error', description: 'Could not load exam details.', variant: 'destructive' });
                 setPageError("An error occurred while loading exam details.");
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchDetails();

         const heartbeatInterval = setInterval(() => {
            updatePcLiveStatus(pcIdentifier, 'Attempting');
        }, 15000); // Send heartbeat every 15 seconds

        return () => {
            clearInterval(heartbeatInterval);
        };


    }, [examId, toast]);

    useEffect(() => {
        if (timeLeft === null || isLoading) return;

        if (timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft(prevTime => (prevTime ? prevTime - 1 : 0));
            }, 1000);
            return () => clearInterval(timer);
        } else if (timeLeft === 0) {
             if (!showTimeoutDialog && !isSubmitting) {
                setShowTimeoutDialog(true);
            }
        }
    }, [timeLeft, isLoading, showTimeoutDialog, isSubmitting]);

    const handleAnswerChange = (questionId: string, optionIndex: number) => {
        setAnswers(prev => prev.map(a => a.questionId === questionId ? { ...a, selectedOption: optionIndex } : a));
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };
    

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin" />
            </div>
        );
    }

     if (alreadyTaken) {
        return (
            <div className="flex h-screen items-center justify-center p-4 text-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2">
                           <ShieldCheck className="h-6 w-6 text-green-500"/> Exam Already Completed
                        </CardTitle>
                        <CardDescription>You have already submitted this exam.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Your submission has been recorded. You cannot take this exam again. If you believe this is an error, please contact an administrator.</p>
                         <Button onClick={() => router.push('/')} className="mt-4">Go Back to Portal</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }
    
    if (pageError || !exam || questions.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center p-4 text-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Exam Not Ready</CardTitle>
                        <CardDescription>We couldn't load the exam details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>{pageError || "This could be because the exam hasn't started yet, or no questions have been assigned by the administrator. Please wait or contact an admin if you believe this is an error."}</p>
                         <Button onClick={() => router.push('/')} className="mt-4">Go Back to Portal</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const minutes = Math.floor((timeLeft || 0) / 60);
    const seconds = (timeLeft || 0) % 60;
    const currentAnswer = answers.find(a => a.questionId === currentQuestion._id.toString())?.selectedOption;


    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 sm:p-8">
            <AlertDialog open={showTimeoutDialog}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Time's Up!</AlertDialogTitle>
                        <AlertDialogDescription>
                        The exam time has run out. Your answers will now be submitted automatically.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleExamSubmit} disabled={isSubmitting}>
                           {isSubmitting ? 'Submitting...' : 'Submit Now'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <div className="w-full max-w-4xl">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">{exam.title}</h1>
                    <div className="text-lg font-mono bg-card px-4 py-2 rounded-md shadow-sm">
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')
                    }
                    </div>
                </div>
                <Progress value={progress} className="mb-6" />
                <Card>
                    <CardHeader>
                        <CardTitle>Question {currentQuestionIndex + 1} of {questions.length}</CardTitle>
                        <CardDescription className="pt-4 text-base text-foreground">{currentQuestion.text.replace(/\$/g, '')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup 
                            value={currentAnswer !== null && currentAnswer !== undefined ? currentAnswer.toString() : ''}
                            onValueChange={(value) => handleAnswerChange(currentQuestion._id as string, parseInt(value))}
                            className="space-y-4"
                        >
                            {currentQuestion.options.map((opt, index) => (
                                <div key={index} className="flex items-center space-x-3 rounded-md border p-4 has-[:checked]:border-primary">
                                    <RadioGroupItem value={index.toString()} id={`q${currentQuestionIndex}-opt${index}`} />
                                    <Label htmlFor={`q${currentQuestionIndex}-opt${index}`} className="flex-1 cursor-pointer">{opt.text}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </CardContent>
                </Card>
                <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
                        Previous
                    </Button>
                    {currentQuestionIndex === questions.length - 1 ? (
                        <Button onClick={handleExamSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Exam'}
                        </Button>
                    ) : (
                        <Button onClick={handleNext}>
                            Next
                        </Button>
                    )}
                </div>
            </div>
        </main>
    );
}
