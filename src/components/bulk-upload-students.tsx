'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { bulkUploadStudents } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UploadResult {
    success: boolean;
    totalRows?: number;
    successCount?: number;
    errorCount?: number;
    results?: Array<{
        success: boolean;
        row: number;
        error?: string;
        studentName?: string;
    }>;
    error?: string;
}

export function BulkUploadStudents({ onUploadComplete }: { onUploadComplete?: () => void }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [showResults, setShowResults] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadSampleCSV = () => {
        const sampleData = [
            ['Name', 'Roll Number', 'Class/Batch', 'Exam Title (optional)'],
            ['John Doe', 'STU001', 'Grade 10-A', ''],
            ['Jane Smith', 'STU002', 'Grade 10-A', 'Mid-Term Physics'],
            ['Michael Johnson', 'STU003', 'Grade 10-B', ''],
            ['Emily Davis', 'STU004', 'Grade 10-B', 'Final Chemistry Exam'],
            ['David Wilson', 'STU005', 'Grade 11-A', ''],
        ];

        const csvContent = sampleData.map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'students_template.csv';
        link.click();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await processFile(files[0]);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            await processFile(files[0]);
        }
    };

    const processFile = async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            toast({
                title: 'Invalid File',
                description: 'Please upload a CSV file.',
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(true);
        try {
            const text = await file.text();
            const result = await bulkUploadStudents(text);
            
            setUploadResult(result);
            setShowResults(true);

            if (result.success && result.successCount && result.successCount > 0) {
                toast({
                    title: 'Upload Complete',
                    description: `Successfully uploaded ${result.successCount} student(s).${result.errorCount ? ` ${result.errorCount} failed.` : ''}`,
                });
                onUploadComplete?.();
            } else if (result.error) {
                toast({
                    title: 'Upload Failed',
                    description: result.error,
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to process the CSV file.',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Bulk Upload Students
                    </CardTitle>
                    <CardDescription>
                        Upload multiple students at once using a CSV file
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={downloadSampleCSV}
                            className="flex-1"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Sample CSV
                        </Button>
                    </div>

                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                            isDragging
                                ? 'border-primary bg-primary/5'
                                : 'border-muted-foreground/25'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={isUploading}
                        />
                        
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Processing CSV file...</p>
                            </div>
                        ) : (
                            <>
                                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-sm font-medium mb-2">
                                    Drag and drop your CSV file here, or
                                </p>
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    variant="secondary"
                                >
                                    Browse Files
                                </Button>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Supports CSV files only
                                </p>
                            </>
                        )}
                    </div>

                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                        <p className="font-semibold">CSV Format Requirements:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>Column 1: Name (required)</li>
                            <li>Column 2: Roll Number (required, must be unique)</li>
                            <li>Column 3: Class/Batch (required, e.g., "Grade 10-A")</li>
                            <li>Column 4: Exam Title (optional, leave empty if not assigning)</li>
                        </ul>
                        <p className="text-xs text-muted-foreground mt-2">
                            <strong>Note:</strong> Roll numbers must be unique. Duplicates will be rejected.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={showResults} onOpenChange={setShowResults}>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Upload Results</DialogTitle>
                        <DialogDescription>
                            Details of the bulk upload operation
                        </DialogDescription>
                    </DialogHeader>

                    {uploadResult && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold">{uploadResult.totalRows || 0}</p>
                                            <p className="text-xs text-muted-foreground">Total Rows</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-green-600">
                                                {uploadResult.successCount || 0}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Successful</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-red-600">
                                                {uploadResult.errorCount || 0}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Failed</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {uploadResult.results && uploadResult.results.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2">Detailed Results:</h4>
                                    <ScrollArea className="h-[300px] rounded-md border p-4">
                                        <div className="space-y-2">
                                            {uploadResult.results.map((result, index) => (
                                                <div
                                                    key={index}
                                                    className={`flex items-start gap-2 p-2 rounded ${
                                                        result.success
                                                            ? 'bg-green-50 dark:bg-green-950/20'
                                                            : 'bg-red-50 dark:bg-red-950/20'
                                                    }`}
                                                >
                                                    {result.success ? (
                                                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium">
                                                            Row {result.row}
                                                            {result.success && (
                                                                <Badge variant="outline" className="ml-2 bg-green-100 text-green-700">
                                                                    Success
                                                                </Badge>
                                                            )}
                                                        </p>
                                                        {result.studentName && (
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {result.studentName}
                                                            </p>
                                                        )}
                                                        {result.error && (
                                                            <p className="text-xs text-red-600 mt-1">
                                                                {result.error}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
