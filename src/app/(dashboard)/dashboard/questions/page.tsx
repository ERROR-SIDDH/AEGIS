'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getQuestions } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BulkUploadQuestions } from '@/components/bulk-upload-questions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Question } from '@/lib/types';
import type { WithId } from 'mongodb';

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<WithId<Question>[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuestions = async () => {
    setIsLoading(true);
    const data = await getQuestions();
    setQuestions(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleUploadComplete = () => {
    fetchQuestions();
    setShowUploadDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Loading questions...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
                <p className="text-muted-foreground">
                    Browse, create, and manage all questions for your exams.
                </p>
            </div>
            <div className="flex gap-2">
                <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <Upload className="mr-2 h-4 w-4" /> 
                            Bulk Upload
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Bulk Upload Questions</DialogTitle>
                            <DialogDescription>
                                Upload multiple questions at once using a CSV file
                            </DialogDescription>
                        </DialogHeader>
                        <BulkUploadQuestions onUploadComplete={handleUploadComplete} />
                    </DialogContent>
                </Dialog>
                
                <Link href="/dashboard/questions/new" passHref>
                    <Button><PlusCircle className="mr-2 h-4 w-4" /> New Question</Button>
                </Link>
            </div>
        </div>

        {questions.length === 0 ? (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground mb-4">No questions yet. Add your first question!</p>
                    <div className="flex gap-2">
                        <Link href="/dashboard/questions/new">
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Question
                            </Button>
                        </Link>
                        <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Bulk Upload
                        </Button>
                    </div>
                </CardContent>
            </Card>
        ) : (
            <div className="grid gap-4">
                {questions.map((q) => (
                    <Card key={q._id as string}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                               <CardTitle className="text-base font-medium leading-relaxed pr-8">{q.text.replace(/\$/g, '')}</CardTitle>
                               <Badge variant={q.category === 'Easy' ? 'secondary' : q.category === 'Medium' ? 'outline' : 'default'}
                                className={
                                    q.category === 'Easy' ? 'bg-green-100 text-green-800 border-green-200' :
                                    q.category === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                    'bg-red-100 text-red-800 border-red-200'
                                }>{q.category}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2 text-sm">
                                {q.options.map((opt, index) => (
                                    <div key={index} className={`flex items-center gap-2 p-2 rounded-md ${q.correctOptions.includes(index) ? 'bg-green-50 border border-green-200' : 'bg-card'}`}>
                                        <span className={`font-mono text-xs ${q.correctOptions.includes(index) ? 'text-green-700' : 'text-muted-foreground'}`}>{String.fromCharCode(65 + index)}.</span>
                                        <span>{opt.text}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <div className="flex items-center gap-2 p-6 pt-2">
                            {q.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
                        </div>
                    </Card>
                ))}
            </div>
        )}
    </div>
  );
}
