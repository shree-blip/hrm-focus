## Goal

Wire correct in-app notifications (header bell only) for the 13 scenarios in your spec. Keep all existing email/Resend logic, permissions, role names, and feature logic untouched. Use only the existing `create_notification` RPC + `notifications` table — no schema changes.

## Architecture

Add one shared frontend helper `src/lib/notify.ts`:

- `notifyUser(userId, {title, message, link, type})`
- `notifyUsers(userIds[], ...)` — dedupes IDs, skips self when needed
- `getLineManagerAndSupervisorUserIds(employeeId)` — returns `{lineManagerUserId, supervisorUserId}` by walking `employees.line_manager_id` and (optional secondary) `team_members` parents
- `getAdminAndVpUserIds()` — queries `user_roles` for `admin` + `vp`
- `getAllActiveUserIds()` — profiles where status != inactive
- `getManagementChain(employeeId)` — line manager + supervisor + admin + vp, deduped

All call sites use this helper so receiver logic is consistent.

## Per-module changes

| # | Module / file | Fix |
|---|---|---|
| 1 | Contracts upload (`src/hooks/useDocuments.ts`) | When category=`contract` and single recipient, notify only selected employee → `/documents?tab=contracts`. |
| 2 | Policy upload (`useDocuments.ts`) | When category=`policy`, fan out to all active users → `/documents?tab=policies`. |
| 3 | Compliance upload (`useDocuments.ts`) | Notify uploader's line manager + supervisor + admin + vp; confirmation to uploader → `/documents?tab=compliance`. |
| 4 | Leave evidence upload (`useLeaveRequests.ts` or evidence handler) | Notify line manager + supervisor; confirmation to employee → `/approvals?tab=leave`. |
| 5 | Loans (`src/hooks/useLoans.ts`) | LM approve → notify employee + VP. VP approve/reject → notify employee (+ admin audit copy). Fix existing wording. |
| 6 | Attendance edit (`useAttendanceAdjustments.ts`, `EditAttendanceDialog.tsx`) | Submit → LM + supervisor. Approve/reject → employee. |
| 7 | Leave request (`useLeaveRequests.ts`) | Submit → LM + supervisor (currently only manager). Approve/reject → employee (already exists, verify). |
| 8 | Announcements (`Announcements.tsx`, `notify_users_on_announcement` trigger) | Already broadcasts; verify link goes to `/announcements`. Frontend insert path: skip duplicate manual loop since trigger handles it (audit only — leave logic if it's currently the only path). |
| 9 | Hiring (`src/pages/Hiring.tsx`) | On create, notify all active users → `/hiring`. |
| 10 | General document upload (`useDocuments.ts`) | Other categories → only selected recipients (already does this; verify message + link). |
| 11 | Bug reports (`useBugReports.ts`) | On submit → admin + vp; confirmation to reporter → `/support?tab=bugs`. |
| 12 | Asset requests (`useAssetRequests.ts` + `send-asset-approval-email`) | Submit → LM (or admin if no LM). LM approve → employee + admin. Admin approve/reject → employee. Already mostly in email function; mirror in-app via `create_notification`. |
| 13 | Profile update (`Profile.tsx` save handler) | On save → confirmation to employee + management copy (LM + supervisor + admin + vp). Throttle: only fire if meaningful fields changed (name/phone/dept/title/location). |

## Milestone broadcast fix (from prior audit)

Patch `supabase/functions/check-milestones/index.ts` to notify only the celebrant + their line manager + admin/vp instead of every user. (This is the broadcast bug flooding dashboards.)

## Deduplication

Helper always dedupes a Set of user IDs before inserting, so a user who is both LM and Admin gets only one notification per event.

## Out of scope (explicitly not touched)

- Email/Resend functions and templates
- `notification_logs` schema
- Permission map / route map
- Role rename or hierarchy DB structure
- Sidebar badge logic
- DB schema additions (category/priority/dedup_key) — deferred to a later phase

## Risk / safety

- No migrations. All changes are additive RPC calls inside existing handlers.
- Each change wrapped in try/catch already present at call sites, so a notify failure never breaks the underlying action.
- Existing notifications stay; we only add missing receivers and fix wrong/missing links.

## Implementation order

1. Add `src/lib/notify.ts` helper
2. Patch `useDocuments.ts` (covers #1, #2, #3, #10)
3. Patch `useLeaveRequests.ts` (#4, #7)
4. Patch `useAttendanceAdjustments.ts` + `EditAttendanceDialog.tsx` (#6)
5. Patch `useLoans.ts` (#5)
6. Patch `useAssetRequests.ts` (#12)
7. Patch `useBugReports.ts` (#11)
8. Patch `Hiring.tsx` (#9)
9. Patch `Profile.tsx` (#13)
10. Patch `check-milestones` edge function (broadcast fix)

Approve and I'll implement in this order.