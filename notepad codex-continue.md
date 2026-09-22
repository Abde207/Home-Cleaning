Continue the Home Clean App implementation from the exact current repository state.



Do NOT restart the project, recreate the architecture, or repeat completed phases.



First, read these files completely and use them as the source of truth:



1\. `Home\_Clean\_App\_Complete\_Design\_Until\_Phase\_12A.md`

2\. `prompt.txt`

3\. `full permission .txt`

4\. Existing `docs/` files

5\. Existing source code in `backend/`, `database/`, `mobile/`, and `admin/`



Then inspect the actual repository and determine the current implementation state from the code, migrations, package files, and documentation.



IMPORTANT:



\* Continue from the existing implementation.

\* Do not rebuild working components unnecessarily.

\* Do not skip directly to Flutter UI.

\* Do not ask me for permission for normal engineering decisions.

\* You have permission to modify files, install development dependencies, run builds/tests/linters/migrations, start Docker services, and fix development errors.

\* Ask only before production deployment, real production credentials/secrets, irreversible production operations, external purchases, or accessing files outside the project workspace.



Your immediate objective is:



PHASE 12A VALIDATION



1\. Start the local PostgreSQL and Redis infrastructure if needed.

2\. Verify the existing Prisma schema.

3\. Verify Prisma migrations.

4\. Generate the Prisma client.

5\. Apply/deploy the migration.

6\. Run the database seed.

7\. Verify the actual PostgreSQL database.

8\. Verify foreign keys, indexes, relations, constraints, and seeded data.

9\. Validate the NestJS backend TypeScript/build.

10\. Validate the Flutter projects' dependencies/analyzer/tests where possible.

11\. Validate the Next.js admin project where possible.

12\. Fix development errors encountered during validation.

13\. Rerun the failed validation after each fix.



Do not claim something is VALIDATED unless you actually executed the relevant command and observed the result.



Use these status labels:



\* SPECIFIED

\* IMPLEMENTED

\* VALIDATED

\* BLOCKED



After validation succeeds, continue automatically to the next implementation stage:



PHASE 13 — BACKEND DATABASE INTEGRATION



Implement the real database layer in NestJS using the existing Prisma/PostgreSQL foundation.



Priorities:



1\. PrismaService

2\. DatabaseModule

3\. Configuration/environment handling

4\. Database connection lifecycle

5\. Health checks

6\. Replace temporary/in-memory persistence where it exists

7\. Implement repository/service persistence using Prisma

8\. Preserve the architecture and domain model already specified

9\. Add transactions where business operations require atomicity

10\. Add proper error handling

11\. Add tests for database-backed behavior



Then continue through the implementation phases defined by the master specification in order:



Authentication

→ Authorization

→ Users / Customers / Providers

→ Services / Properties / Addresses

→ Booking engine

→ Pricing

→ Dispatch

→ Assignments

→ Payments

→ Settlements

→ Notifications

→ Locations

→ Ratings / Support

→ Admin operations

→ Customer Flutter

→ Provider Flutter

→ Admin UI

→ Testing

→ CI/CD

→ Production hardening



For every phase:



1\. Inspect what already exists.

2\. Implement only what is missing.

3\. Run validation.

4\. Fix errors.

5\. Rerun validation.

6\. Update the relevant Markdown documentation.

7\. Update `docs/codex-implementation-status.md`.

8\. Update `docs/codex-changelog.md`.

9\. Update `docs/phase12-changelog.md` when the change belongs to the Phase 12 foundation history.

10\. Keep the master architecture intact unless a genuine implementation issue requires a documented change.



API RULE:



Every API endpoint must document:



\* Method

\* Path

\* Authentication

\* Required role

\* Request DTO

\* Response DTO

\* Validation

\* Errors

\* Idempotency

\* Side effects



DATABASE RULE:



All schema changes must use Prisma migrations.



Do not casually delete, rewrite, or reset migration history.



BUSINESS RULES:



Backend owns business state and financial truth.



Do not implement arbitrary:



`PATCH /booking/status`



Use explicit domain commands such as:



\* CreateBooking

\* ConfirmBooking

\* SelectCashPayment

\* InitiateOnlinePayment

\* CancelBooking

\* AcceptAssignment

\* RejectAssignment

\* MarkOnTheWay

\* StartCleaning

\* CompleteCleaning

\* SubmitCompletionProof

\* CollectCash

\* CreateRefund

\* ManualAssignBooking

\* ManualReassignBooking



Preserve booking history, assignment history, payment history, settlement history, and auditability.



At the end of this session, report:



\### Implemented



What was actually changed.



\### Validated



What commands/tests actually passed.



\### Not Yet Validated



What remains unverified.



\### Blocked



Anything preventing progress.



\### Files Changed



List the important files.



\### Tests / Commands



List the actual commands executed and their results.



\### Documentation Updated



List every Markdown/documentation file updated.



\### Current Project Phase



State the exact phase and percentage/status of completion.



\### Next Step



State the exact next implementation task.



Then continue working rather than stopping after the audit unless a genuine blocker requires my input.



