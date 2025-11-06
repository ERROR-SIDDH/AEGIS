# AEGIS ExamLab

This project is a Next.js + TypeScript application for administering and monitoring secure, proctored exams across multiple lab PCs.

## Core Concepts

- PC Registration: Each client machine registers and receives a `uniqueIdentifier` stored in `localStorage` (`pcIdentifier`).
- Admin Approval: PCs are approved by an admin before they can participate.
- Student–PC Binding: An admin assigns a student to exactly one approved PC at a time (`assignedStudentId`).
- Exam Assignment: Students receive an `assignedExamId`. PCs inherit the exam context through the assigned student.
- Live Status: PCs heartbeat their status (`Online`, `Ready`, `Attempting`, `Finished`) for monitoring.

## Recent Security/Flow Hardening

Previously any PC could attempt to fetch or submit an exam if it knew an `examId` + `studentId`. The server now strictly enforces:

1. PC must exist and be approved.
2. The PC's `assignedStudentId` must match the provided `studentId`.
3. The student must be assigned to the requested exam (`assignedExamId`).
4. The exam must be `In Progress` to fetch questions or accept submissions.
5. Submitted answers are filtered so only questions belonging to that exam are scored.
6. Only the submitting PC's `liveStatus` is marked `Finished` (prevents side-effects on other machines).

These guards are implemented in `getExamDetails` and `submitExam` (see `src/lib/actions.ts`). The exam page passes the `pcIdentifier` to these server actions.

## Key Server Actions (src/lib/actions.ts)

- `getExamDetails(examId, studentId, pcIdentifier?)`
	- Validates PC → Student → Exam chain.
	- Denies access if exam not In Progress.
	- Blocks if student already has a result.
- `submitExam(examId, studentId, answers, pcIdentifier?)`
	- Re-validates the same chain.
	- Filters out answers for questions not in the exam.
	- Prevents duplicate submissions.

## Client Exam Flow (src/app/exam/[examId]/page.tsx)

1. Reads `pcIdentifier` from `localStorage`.
2. Loads PC status to obtain mapped student & exam.
3. Verifies URL `examId` matches the PC's assigned exam before requesting data.
4. Starts heartbeat (`Attempting`) once questions load.
5. Auto-submits on timer expiry.

## Development

Install dependencies and run the dev server:
```bash
npm install
npm run dev
```

## Future Enhancements

- Per-question autosave + resume state.
- Server-side rate limiting for submission endpoint.
- Cryptographically signed device tokens in cookies instead of relying solely on `localStorage`.
- Audit trail for each answer change (already partially supported through admin logs design).

---
For more details on planned capabilities, see `docs/blueprint.md`.
