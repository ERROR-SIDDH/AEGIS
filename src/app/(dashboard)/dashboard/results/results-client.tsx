'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Download, Search, TrendingUp, TrendingDown, Users, ClipboardList, Award, BarChart3, Eye, ArrowUpDown } from 'lucide-react';
import type { ExamResult, Exam } from '@/lib/types';
import type { WithId } from 'mongodb';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Line, LineChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type SortField = 'studentName' | 'examTitle' | 'score' | 'completedAt' | 'percentage';
type SortOrder = 'asc' | 'desc';

interface ExamResultsClientProps {
    results: WithId<ExamResult>[];
    exams: WithId<Exam>[];
}

export function ExamResultsClient({ results, exams }: ExamResultsClientProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedExam, setSelectedExam] = useState<string>('all');
    const [minScore, setMinScore] = useState<string>('');
    const [maxScore, setMaxScore] = useState<string>('');
    const [sortField, setSortField] = useState<SortField>('completedAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [selectedResult, setSelectedResult] = useState<WithId<ExamResult> | null>(null);

    // Calculate statistics
    const stats = useMemo(() => {
        if (results.length === 0) {
            return {
                totalExams: 0,
                totalStudents: 0,
                averageScore: 0,
                averagePercentage: 0,
                passRate: 0,
                topScore: 0,
                lowestScore: 0,
            };
        }

        const uniqueStudents = new Set(results.map(r => r.studentName)).size;
        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        const totalPercentages = results.reduce((sum, r) => sum + (r.score / r.totalQuestions) * 100, 0);
        const passThreshold = 50; // 50% passing grade
        const passCount = results.filter(r => (r.score / r.totalQuestions) * 100 >= passThreshold).length;

        const scores = results.map(r => r.score);
        const topScore = Math.max(...scores);
        const lowestScore = Math.min(...scores);

        return {
            totalExams: results.length,
            totalStudents: uniqueStudents,
            averageScore: totalScore / results.length,
            averagePercentage: totalPercentages / results.length,
            passRate: (passCount / results.length) * 100,
            topScore,
            lowestScore,
        };
    }, [results]);

    // Filter and sort results
    const filteredResults = useMemo(() => {
        let filtered = results.filter(result => {
            const matchesSearch = 
                result.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                result.examTitle.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesExam = selectedExam === 'all' || result.examTitle === selectedExam;
            
            const percentage = (result.score / result.totalQuestions) * 100;
            const matchesMinScore = minScore === '' || percentage >= parseFloat(minScore);
            const matchesMaxScore = maxScore === '' || percentage <= parseFloat(maxScore);

            return matchesSearch && matchesExam && matchesMinScore && matchesMaxScore;
        });

        // Sort results
        filtered.sort((a, b) => {
            let aVal: any, bVal: any;

            switch (sortField) {
                case 'studentName':
                    aVal = a.studentName.toLowerCase();
                    bVal = b.studentName.toLowerCase();
                    break;
                case 'examTitle':
                    aVal = a.examTitle.toLowerCase();
                    bVal = b.examTitle.toLowerCase();
                    break;
                case 'score':
                    aVal = a.score;
                    bVal = b.score;
                    break;
                case 'percentage':
                    aVal = (a.score / a.totalQuestions) * 100;
                    bVal = (b.score / b.totalQuestions) * 100;
                    break;
                case 'completedAt':
                    aVal = new Date(a.completedAt).getTime();
                    bVal = new Date(b.completedAt).getTime();
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [results, searchQuery, selectedExam, minScore, maxScore, sortField, sortOrder]);

    // Chart data - Score Distribution
    const scoreDistributionData = useMemo(() => {
        const ranges = [
            { range: '0-20%', min: 0, max: 20, count: 0 },
            { range: '21-40%', min: 21, max: 40, count: 0 },
            { range: '41-60%', min: 41, max: 60, count: 0 },
            { range: '61-80%', min: 61, max: 80, count: 0 },
            { range: '81-100%', min: 81, max: 100, count: 0 },
        ];

        results.forEach(result => {
            const percentage = (result.score / result.totalQuestions) * 100;
            const range = ranges.find(r => percentage >= r.min && percentage <= r.max);
            if (range) range.count++;
        });

        return ranges.map(r => ({ name: r.range, students: r.count }));
    }, [results]);

    // Chart data - Performance by Exam
    const performanceByExamData = useMemo(() => {
        const examStats: Record<string, { total: number; count: number; examTitle: string }> = {};

        results.forEach(result => {
            if (!examStats[result.examTitle]) {
                examStats[result.examTitle] = { total: 0, count: 0, examTitle: result.examTitle };
            }
            const percentage = (result.score / result.totalQuestions) * 100;
            examStats[result.examTitle].total += percentage;
            examStats[result.examTitle].count++;
        });

        return Object.values(examStats).map(stat => ({
            exam: stat.examTitle,
            avgScore: Math.round(stat.total / stat.count),
            students: stat.count,
        }));
    }, [results]);

    // Chart data - Completion Timeline
    const completionTimelineData = useMemo(() => {
        const timeline: Record<string, number> = {};

        results.forEach(result => {
            const date = format(new Date(result.completedAt), 'MMM dd');
            timeline[date] = (timeline[date] || 0) + 1;
        });

        return Object.entries(timeline)
            .map(([date, count]) => ({ date, completions: count }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-10); // Last 10 days
    }, [results]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const exportToCSV = () => {
        const headers = ['Student Name', 'Exam Title', 'Score', 'Total Questions', 'Percentage', 'Completed At'];
        const rows = filteredResults.map(r => [
            r.studentName,
            r.examTitle,
            r.score.toString(),
            r.totalQuestions.toString(),
            `${((r.score / r.totalQuestions) * 100).toFixed(2)}%`,
            format(new Date(r.completedAt), 'yyyy-MM-dd HH:mm:ss')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `exam_results_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    const getScoreBadgeVariant = (percentage: number) => {
        if (percentage >= 80) return 'default';
        if (percentage >= 60) return 'secondary';
        if (percentage >= 40) return 'outline';
        return 'destructive';
    };

    return (
        <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalExams}</div>
                        <p className="text-xs text-muted-foreground">
                            From {stats.totalStudents} students
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.averagePercentage.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.averageScore.toFixed(1)} points average
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                        {stats.passRate >= 60 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.passRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            50% passing threshold
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Score Range</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.lowestScore} - {stats.topScore}</div>
                        <p className="text-xs text-muted-foreground">
                            Highest: {stats.topScore}, Lowest: {stats.lowestScore}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Score Distribution</CardTitle>
                        <CardDescription>Number of students in each score range</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={scoreDistributionData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="students" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Performance by Exam</CardTitle>
                        <CardDescription>Average scores across different exams</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={performanceByExamData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="exam" fontSize={12} />
                                <YAxis fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="avgScore" fill="#82ca9d" name="Avg Score %" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Filters and Actions */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Exam Results</CardTitle>
                            <CardDescription>Filter and view detailed exam submissions</CardDescription>
                        </div>
                        <Button onClick={exportToCSV} variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="search">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="Student or exam..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="exam-filter">Filter by Exam</Label>
                            <Select value={selectedExam} onValueChange={setSelectedExam}>
                                <SelectTrigger id="exam-filter">
                                    <SelectValue placeholder="All Exams" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Exams</SelectItem>
                                    {Array.from(new Set(results.map(r => r.examTitle))).map(examTitle => (
                                        <SelectItem key={examTitle} value={examTitle}>
                                            {examTitle}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="min-score">Min Score %</Label>
                            <Input
                                id="min-score"
                                type="number"
                                placeholder="0"
                                value={minScore}
                                onChange={(e) => setMinScore(e.target.value)}
                                min="0"
                                max="100"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="max-score">Max Score %</Label>
                            <Input
                                id="max-score"
                                type="number"
                                placeholder="100"
                                value={maxScore}
                                onChange={(e) => setMaxScore(e.target.value)}
                                min="0"
                                max="100"
                            />
                        </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        Showing {filteredResults.length} of {results.length} results
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('studentName')}
                                            className="h-8 px-2"
                                        >
                                            Student
                                            <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('examTitle')}
                                            className="h-8 px-2"
                                        >
                                            Exam
                                            <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('score')}
                                            className="h-8 px-2"
                                        >
                                            Score
                                            <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('percentage')}
                                            className="h-8 px-2"
                                        >
                                            Percentage
                                            <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('completedAt')}
                                            className="h-8 px-2"
                                        >
                                            Completed
                                            <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                                            No results found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredResults.map(result => {
                                        const percentage = (result.score / result.totalQuestions) * 100;
                                        return (
                                            <TableRow key={result._id as string}>
                                                <TableCell className="font-medium">{result.studentName}</TableCell>
                                                <TableCell>{result.examTitle}</TableCell>
                                                <TableCell>{result.score} / {result.totalQuestions}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getScoreBadgeVariant(percentage)}>
                                                        {percentage.toFixed(1)}%
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {format(new Date(result.completedAt), 'MMM d, yyyy, h:mm a')}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setSelectedResult(result)}
                                                    >
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        View
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Detailed Result Dialog */}
            <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Exam Result Details</DialogTitle>
                        <DialogDescription>
                            Detailed breakdown of the exam submission
                        </DialogDescription>
                    </DialogHeader>
                    {selectedResult && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm text-muted-foreground">Student</Label>
                                    <p className="font-semibold">{selectedResult.studentName}</p>
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Exam</Label>
                                    <p className="font-semibold">{selectedResult.examTitle}</p>
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Score</Label>
                                    <p className="font-semibold">
                                        {selectedResult.score} / {selectedResult.totalQuestions}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Percentage</Label>
                                    <p className="font-semibold">
                                        {((selectedResult.score / selectedResult.totalQuestions) * 100).toFixed(2)}%
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Completed At</Label>
                                    <p className="font-semibold">
                                        {format(new Date(selectedResult.completedAt), 'MMM d, yyyy, h:mm a')}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Total Questions</Label>
                                    <p className="font-semibold">{selectedResult.totalQuestions}</p>
                                </div>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2 block">Answer Summary</Label>
                                <div className="rounded-md border p-4 space-y-2">
                                    <p className="text-sm">
                                        <span className="font-medium">Total Answers:</span> {selectedResult.answers.length}
                                    </p>
                                    <p className="text-sm">
                                        <span className="font-medium">Answered:</span>{' '}
                                        {selectedResult.answers.filter(a => a.selectedOption !== null).length}
                                    </p>
                                    <p className="text-sm">
                                        <span className="font-medium">Skipped:</span>{' '}
                                        {selectedResult.answers.filter(a => a.selectedOption === null).length}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2 block">Individual Answers</Label>
                                <div className="rounded-md border max-h-64 overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Question #</TableHead>
                                                <TableHead>Selected Option</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedResult.answers.map((answer, index) => (
                                                <TableRow key={answer.questionId}>
                                                    <TableCell>Question {index + 1}</TableCell>
                                                    <TableCell>
                                                        {answer.selectedOption !== null ? (
                                                            <Badge variant="outline">
                                                                Option {answer.selectedOption + 1}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary">Not Answered</Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
