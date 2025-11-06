import { getExamResults, getExams } from '@/lib/actions';
import { ExamResultsClient } from './results-client';

export default async function ResultsPage() {
    const results = await getExamResults();
    const exams = await getExams();

    return <ExamResultsClient results={results} exams={exams} />;
}
