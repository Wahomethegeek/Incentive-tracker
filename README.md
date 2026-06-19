# Incentive Tracker

Shared employee incentive tracker for claim submission, evidence upload, review status, and payroll export.

## What Is Included

- Full incentive catalog from Parts A, B, and C.
- Employee claim form with department, period, completed date, client/project, notes, claimed amount, and evidence upload.
- Directory upload support for completed incentive evidence folders.
- Company tracker with filtering by employee, incentive, client/project, period, department, and status.
- Review status workflow: Submitted, Under review, Approved, Needs info, Paid, Declined.
- CSV export for payroll processing.
- D1 database schema and migration for claim records and evidence metadata.
- R2 evidence storage binding for uploaded files.

## Local Commands

```bash
npm install
npm run db:generate
npm run build
npm run dev -- --host 127.0.0.1 --port 3000
```

## Hosting Notes

The app is configured for Sites with:

- D1 binding: `DB`
- R2 binding: `EVIDENCE`

The local UI runs without hosted storage, but claims and evidence uploads require the D1 and R2 bindings to be connected in the hosted environment.
