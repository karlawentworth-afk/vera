# Vera Clickability Map

Every visible element → where it links.

## Admin Dashboard (/admin)

| Element | Links to |
|---------|----------|
| MRR card | /admin/invoices |
| Active clients card | /admin/clients |
| Jobs in flight card | /admin/jobs |
| Reviewers card | /admin/reviewers |
| Priority feed: unallocated job | Job detail drawer (click row) |
| Priority feed: expedited job | Job detail drawer |
| Priority feed: awaiting signoff | Job detail drawer |
| Priority feed: near allowance | Client detail (via clients page) |
| Reviewer capacity: name | /admin/reviewers/:id |
| Quick actions: New quote | /admin/quotes |
| Quick actions: Run invoices | /admin/invoices |
| Quick actions: Process payouts | /admin/invoices |
| Quick actions: Export to Xero | /admin/settings |

## Admin Jobs (/admin/jobs)

| Element | Links to |
|---------|----------|
| Any job row | Job detail drawer |
| Status tab | Filters list |
| "Manual entry" button | New job drawer |
| Job number in drawer | — (already in detail) |
| Client name in drawer | Should link to /admin/clients/:id |
| Reviewer name in drawer | Should link to /admin/reviewers/:id |

## Admin Clients (/admin/clients)

| Element | Links to |
|---------|----------|
| Client card "View" | /admin/clients/:id |
| Client card "Contact" | — (placeholder) |
| Client card "Invoices" | — (placeholder) |
| "Add client" | Invite drawer |
| "Resend invite" | Triggers resend function |

## Admin Reviewers (/admin/reviewers)

| Element | Links to |
|---------|----------|
| Any reviewer row | /admin/reviewers/:id |
| "Add reviewer" | Invite drawer |

## Admin Users (/admin/users)

| Element | Links to |
|---------|----------|
| Any user row (all views) | /admin/users/:id |
| Stat cards | Filter the list |

## Client Dashboard (/client)

| Element | Links to |
|---------|----------|
| AI Health Score card | /client/audit |
| Words this month card | /client/subscription |
| Active jobs card | /client/jobs |
| Avg turnaround card | /client/audit |
| Recommendation cards | /client/audit |
| Active jobs list rows | /client/jobs/:id |

## Client Jobs (/client/jobs)

| Element | Links to |
|---------|----------|
| Any job row | /client/jobs/:id |
| "Submit work" button | /client/submit |

## Client Job Detail (/client/jobs/:id)

| Element | Links to |
|---------|----------|
| Back arrow | /client/jobs |
| Source file download | Signed URL download |
| Verified file download | Signed URL download |
| XLIFF export | Generates and downloads XLIFF |

## Client Audit (/client/audit)

| Element | Links to |
|---------|----------|
| Export PDF | Downloads branded PDF |
| Export TMX | Downloads TMX translation memory |
| Audit trail rows | — (should link to /client/jobs/:id) |

## Client Glossary (/client/glossary)

| Element | Links to |
|---------|----------|
| Export TBX | Downloads TBX terminology file |
| Import TBX | Opens file picker |

## Reviewer Queue (/reviewer)

| Element | Links to |
|---------|----------|
| Active jobs card | /reviewer |
| Words card | /reviewer/earnings |
| Rate card | /reviewer/settings |
| Completed card | /reviewer/completed |
| Any job card | /reviewer/review/:id |
| "Connect bank" banner | /reviewer/settings |

## Sales Dashboard (/sales)

| Element | Links to |
|---------|----------|
| My clients card | /sales/clients |
| YTD earned card | /sales/earnings |
| Owed this month card | /sales/earnings |
| Expiring soon card | /sales/clients |
| Client agreement cards | — (inline detail) |

## Sales Leads (/sales/leads)

| Element | Links to |
|---------|----------|
| Kanban card | /sales/leads/:id |
| List table row | /sales/leads/:id |
| "Add lead" | Add lead drawer |

## Universal

| Element | Links to |
|---------|----------|
| Avatar/initials circle | /profile |
| Help icon (?) | /help |
| Demo banner "Return" | /portal-mode |
| VeraLogo | — (no link, stays on current page) |
