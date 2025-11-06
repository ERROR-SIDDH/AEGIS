
'use client';

import { useEffect, useState } from 'react';
import { getAdmins, deleteAdmin, deleteAllQuestions, clearAllLogs, deleteAllStudents, deleteAllExams, deleteAllResults, flushAllData } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddAdminForm } from '@/components/add-admin-form';
import { Badge } from '@/components/ui/badge';
import type { Admin } from '@/lib/types';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Database, FileX, Users, ClipboardList, Award, BarChart3, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Cookies from 'js-cookie';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


export default function SettingsPage() {
    const [admins, setAdmins] = useState<WithId<Admin>[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [confirmText, setConfirmText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchAdmins = () => {
        getAdmins().then(setAdmins);
    };

    useEffect(() => {
        const userCookie = Cookies.get('admin_user');
        console.log('Raw cookie:', userCookie);
        if (userCookie) {
            try {
                const parsed = JSON.parse(userCookie);
                console.log('Parsed user:', parsed);
                setCurrentUser(parsed);
            } catch (e) {
                console.error("Failed to parse user cookie", e);
            }
        }
        fetchAdmins();
        setIsLoading(false);
    }, []);

    const handleDelete = async (adminId: string) => {
        const result = await deleteAdmin(adminId);
        if (result?.success) {
            toast({ title: 'Success', description: 'Admin has been deleted.' });
            fetchAdmins(); // Refresh the list
        } else {
            toast({ title: 'Error', description: result?.error || 'An error occurred.', variant: 'destructive' });
        }
    };

    const handleDangerousAction = async (action: () => Promise<any>, actionName: string, confirmRequired = true) => {
        if (confirmRequired && confirmText !== 'DELETE') {
            toast({ 
                title: 'Confirmation Required', 
                description: 'Please type DELETE to confirm this action.', 
                variant: 'destructive' 
            });
            return;
        }

        setIsProcessing(true);
        try {
            const result = await action();
            if (result?.success) {
                toast({ 
                    title: 'Success', 
                    description: `${actionName} completed successfully. ${result.deletedCount || result.totalDeleted || 0} items removed.` 
                });
                setConfirmText('');
            } else {
                toast({ 
                    title: 'Error', 
                    description: result?.error || 'An error occurred.', 
                    variant: 'destructive' 
                });
            }
        } catch (error) {
            toast({ 
                title: 'Error', 
                description: 'Failed to complete the action.', 
                variant: 'destructive' 
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const isSuperAdmin = currentUser?.role === 'superadmin';
    
    console.log('Current user:', currentUser);
    console.log('Is super admin:', isSuperAdmin);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <p>Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Debug Info - Remove in production */}
            {currentUser && (
                <Card className="bg-muted">
                    <CardContent className="pt-6">
                        <div className="text-sm space-y-1">
                            <p><strong>Logged in as:</strong> {currentUser.username}</p>
                            <p><strong>Role:</strong> {currentUser.role}</p>
                            <p><strong>Is Superadmin:</strong> {isSuperAdmin ? 'Yes ✅' : 'No ❌'}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Admin Management</CardTitle>
                            <CardDescription>View and manage administrator accounts.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Username</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {admins.map(admin => (
                                        <TableRow key={admin._id.toString()}>
                                            <TableCell className="font-medium">{admin.username}</TableCell>
                                            <TableCell>
                                                <Badge variant={admin.role === 'superadmin' ? 'default' : 'secondary'}>
                                                    {admin.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {currentUser?.username !== admin.username ? (
                                                     <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-destructive">
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This action cannot be undone. This will permanently delete the admin account for <span className="font-bold">{admin.username}</span>.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(admin._id.toString())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                ) : (
                                                    <div className="h-9 w-9" /> 
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                <div>
                    <AddAdminForm onAdminAdded={fetchAdmins} />
                </div>
            </div>

            {/* Dangerous Operations - Only for Superadmins */}
            {isSuperAdmin && (
                <Card className="border-destructive">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            <CardTitle className="text-destructive">Dangerous Operations</CardTitle>
                        </div>
                        <CardDescription>
                            These actions are irreversible and will permanently delete data. Only superadmins can perform these operations.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Delete All Questions */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                                        <FileX className="mr-2 h-4 w-4" />
                                        Delete All Questions
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                            <AlertTriangle className="h-5 w-5" />
                                            Delete All Questions?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-3">
                                            <p>This will permanently delete ALL questions from the database. This action cannot be undone.</p>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirm-questions">Type <strong>DELETE</strong> to confirm:</Label>
                                                <Input
                                                    id="confirm-questions"
                                                    value={confirmText}
                                                    onChange={(e) => setConfirmText(e.target.value)}
                                                    placeholder="DELETE"
                                                    className="font-mono"
                                                />
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDangerousAction(deleteAllQuestions, 'Delete All Questions')}
                                            disabled={confirmText !== 'DELETE' || isProcessing}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            {isProcessing ? 'Deleting...' : 'Delete All Questions'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* Delete All Students */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                                        <Users className="mr-2 h-4 w-4" />
                                        Delete All Students
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                            <AlertTriangle className="h-5 w-5" />
                                            Delete All Students?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-3">
                                            <p>This will permanently delete ALL students and unassign them from PCs. This action cannot be undone.</p>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirm-students">Type <strong>DELETE</strong> to confirm:</Label>
                                                <Input
                                                    id="confirm-students"
                                                    value={confirmText}
                                                    onChange={(e) => setConfirmText(e.target.value)}
                                                    placeholder="DELETE"
                                                    className="font-mono"
                                                />
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDangerousAction(deleteAllStudents, 'Delete All Students')}
                                            disabled={confirmText !== 'DELETE' || isProcessing}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            {isProcessing ? 'Deleting...' : 'Delete All Students'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* Delete All Exams */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                                        <ClipboardList className="mr-2 h-4 w-4" />
                                        Delete All Exams
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                            <AlertTriangle className="h-5 w-5" />
                                            Delete All Exams?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-3">
                                            <p>This will permanently delete ALL exams from the database. This action cannot be undone.</p>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirm-exams">Type <strong>DELETE</strong> to confirm:</Label>
                                                <Input
                                                    id="confirm-exams"
                                                    value={confirmText}
                                                    onChange={(e) => setConfirmText(e.target.value)}
                                                    placeholder="DELETE"
                                                    className="font-mono"
                                                />
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDangerousAction(deleteAllExams, 'Delete All Exams')}
                                            disabled={confirmText !== 'DELETE' || isProcessing}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            {isProcessing ? 'Deleting...' : 'Delete All Exams'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* Delete All Results */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                                        <BarChart3 className="mr-2 h-4 w-4" />
                                        Delete All Results
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                            <AlertTriangle className="h-5 w-5" />
                                            Delete All Exam Results?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-3">
                                            <p>This will permanently delete ALL exam results. This action cannot be undone.</p>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirm-results">Type <strong>DELETE</strong> to confirm:</Label>
                                                <Input
                                                    id="confirm-results"
                                                    value={confirmText}
                                                    onChange={(e) => setConfirmText(e.target.value)}
                                                    placeholder="DELETE"
                                                    className="font-mono"
                                                />
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDangerousAction(deleteAllResults, 'Delete All Results')}
                                            disabled={confirmText !== 'DELETE' || isProcessing}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            {isProcessing ? 'Deleting...' : 'Delete All Results'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* Clear All Logs */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Clear All Logs
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                                            <AlertTriangle className="h-5 w-5" />
                                            Clear All Admin Logs?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-3">
                                            <p>This will permanently delete ALL admin logs. A new log entry will be created for this action.</p>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirm-logs">Type <strong>DELETE</strong> to confirm:</Label>
                                                <Input
                                                    id="confirm-logs"
                                                    value={confirmText}
                                                    onChange={(e) => setConfirmText(e.target.value)}
                                                    placeholder="DELETE"
                                                    className="font-mono"
                                                />
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDangerousAction(clearAllLogs, 'Clear All Logs')}
                                            disabled={confirmText !== 'DELETE' || isProcessing}
                                            className="bg-orange-600 text-white hover:bg-orange-700"
                                        >
                                            {isProcessing ? 'Clearing...' : 'Clear All Logs'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* Flush All Data */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="border-red-700 text-red-700 hover:bg-red-700 hover:text-white md:col-span-2">
                                        <Database className="mr-2 h-4 w-4" />
                                        FLUSH ALL DATA (Nuclear Option)
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                                            <AlertTriangle className="h-5 w-5" />
                                            FLUSH ENTIRE DATABASE?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-3">
                                            <p className="font-semibold text-red-600">⚠️ EXTREME DANGER ⚠️</p>
                                            <p>This will delete ALL data from the system including:</p>
                                            <ul className="list-disc list-inside space-y-1 text-sm">
                                                <li>All Students</li>
                                                <li>All Questions</li>
                                                <li>All Exams</li>
                                                <li>All Results</li>
                                                <li>All PCs and PC Requests</li>
                                            </ul>
                                            <p className="text-red-600 font-semibold">Admin accounts and logs will be preserved.</p>
                                            <p className="font-bold">This action is IRREVERSIBLE!</p>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirm-flush">Type <strong>DELETE</strong> to confirm:</Label>
                                                <Input
                                                    id="confirm-flush"
                                                    value={confirmText}
                                                    onChange={(e) => setConfirmText(e.target.value)}
                                                    placeholder="DELETE"
                                                    className="font-mono"
                                                />
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDangerousAction(flushAllData, 'Flush All Data')}
                                            disabled={confirmText !== 'DELETE' || isProcessing}
                                            className="bg-red-700 text-white hover:bg-red-800"
                                        >
                                            {isProcessing ? 'Flushing...' : 'FLUSH ALL DATA'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
