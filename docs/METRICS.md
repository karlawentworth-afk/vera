# Vera Metrics — Data Sources

Every number shown in the UI comes from a specific database query. No hardcoded values.

## Admin Dashboard

| Metric | Source | Query |
|--------|--------|-------|
| MRR | SUM of active subscriptions monthly_price_pence | `subscriptions WHERE status='active' AND is_demo=mode` |
| Active clients | COUNT of active subscriptions | Same as MRR |
| Near allowance | Subscriptions where org's job word_count sum > 85% of allowance | Calculated client-side from jobs + subscriptions |
| Jobs in flight | COUNT of jobs WHERE status NOT IN (delivered, cancelled) | `jobs WHERE status IN (unallocated, in_review, awaiting_signoff)` |
| Expedited count | COUNT of active jobs WHERE urgency='expedited' | Filtered from above |
| Unallocated count | COUNT of jobs WHERE status='unallocated' | Filtered from above |
| Reviewers | COUNT of profiles WHERE role='reviewer' | `profiles WHERE role='reviewer'` |
| Free reviewers | Reviewers with 0 active jobs | Calculated by counting reviewer_id in active jobs |

## Client Dashboard

| Metric | Source |
|--------|--------|
| AI Health Score | `ai_health_snapshots.overall_score` (latest snapshot) OR live calc from `scores.hter_score` |
| Words this month | SUM of `jobs.word_count WHERE organisation_id=org AND status!='cancelled'` |
| Active jobs | COUNT of jobs WHERE org AND status IN (unallocated, allocated, in_review, awaiting_signoff) |
| Avg turnaround | AVG of (delivered_at - submitted_at) for delivered jobs, in hours |
| Health trend | Last 6 entries from `ai_health_snapshots WHERE organisation_id=org ORDER BY snapshot_date DESC` |

## Reviewer Queue

| Metric | Source |
|--------|--------|
| Active jobs | COUNT of jobs WHERE reviewer_id=me AND status IN (allocated, in_review, awaiting_signoff) |
| Words this month | SUM of active + delivered job word_count for this reviewer |
| Rate | `profiles.rate_per_word` |
| Completed | COUNT of jobs WHERE reviewer_id=me AND status='delivered' |

## Sales Dashboard

| Metric | Source |
|--------|--------|
| My clients | COUNT of commission_agreements WHERE salesperson_id=me AND status='active' |
| MRR introduced | SUM of subscriptions.monthly_price_pence for orgs with active agreements |
| YTD earned | SUM of commission_payouts WHERE status='paid' AND this year |
| Owed this month | SUM of commission_payouts WHERE status='pending' |

## Score Calculation

- hTER = MAX(0.05, MIN(0.50, (10 - avg_of_6_criteria) / 10 * 0.5))
- AI Health Score = ROUND((1 - avg_hter) * 100)
- Industry benchmark hTER: 0.31
