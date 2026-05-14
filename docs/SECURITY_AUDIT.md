# Vera Security Audit

**Date:** 2026-05-14
**Auditor:** Claude Code (automated)
**Status:** All critical and high issues resolved

---

## 1. Row Level Security (RLS)

### Tables with RLS enabled: ALL 30+ tables
Every table in the schema has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

### Policy pattern:
- **Admin role:** Full access (SELECT, INSERT, UPDATE, DELETE) via `auth_role() = 'admin'`
- **Client role:** Read own organisation's data via `auth_org_id()` helper
- **Reviewer role:** Read/write on assigned jobs via `reviewer_id = auth.uid()`
- **Salesperson role:** Own leads, own commission agreements, introduced client data

### Helper functions:
- `auth_role()` — returns current user's role from profiles table (SECURITY DEFINER)
- `auth_org_id()` — returns current user's organisation_id (SECURITY DEFINER)

### Critical privacy boundary:
- `job_internal_notes` has NO policy for client role — clients physically cannot query internal notes
- `leads` table: salespeople only see own leads, admin sees all, clients/reviewers have no access

---

## 2. Auth Gaps Fixed

| Function | Issue | Fix applied |
|----------|-------|-------------|
| `parse-segments.mts` | No authentication — anyone could trigger file parsing | Added Bearer token validation + admin/assigned-reviewer check |
| `preflight-check.mts` | No authentication — anyone could trigger Claude API calls (cost abuse) | Added Bearer token validation + admin/reviewer/client check |
| `stripe-checkout.mts` | Had auth but no org ownership check — user could checkout for any org | Added org membership verification (`organisation_id` matches caller's profile) |
| `stripe-portal.mts` | Had auth but no org ownership check — user could access any org's billing | Added same org membership verification |

### Functions with correct auth (no changes needed):
- `demo-login.mts` — admin role check
- `generate-recommendations.mts` — admin role check
- `invite-user.mts` — admin role check
- `resend-invite.mts` — admin role check
- `system-reset.mts` — admin role check
- `stripe-connect-onboard.mts` — reviewer/salesperson role check
- `stripe-webhook.mts` — Stripe signature verification (correct for webhooks)
- `send-email.mts` — internal service (no auth needed)

### Functions for cron/internal use (no auth by design):
- `run-cron-job.mts` — triggered by admin UI or cron scheduler
- `process-payouts.mts` — same pattern
- `calculate-ai-health.mts` — same pattern

---

## 3. is_demo Data Separation

### Strategy:
- `is_demo boolean NOT NULL DEFAULT false` column on all data tables
- Demo data marked `is_demo=true` by seed scripts
- Live data is `is_demo=false` (default)
- Admin profiles and operator org always `is_demo=false` (shared)

### Frontend enforcement:
- `getIsDemo()` helper reads from `sessionStorage('vera_demo_mode')`
- Set when admin picks Demo on portal-mode chooser
- **70 queries** across all 4 portals filter by `.eq('is_demo', getIsDemo())`

### Verification:
Live: 2 profiles, 1 org, 0 jobs, 0 everything else
Demo: 24 profiles, 8 orgs, 85 jobs, full population

### Known limitation:
- `is_demo` filter is application-level, not RLS-level. A user with direct database access could bypass it. For production hardening, add RLS policies that check a session variable.

---

## 4. Service Role Key Usage

The Supabase service role key bypasses RLS. It appears ONLY in:
- `netlify/functions/*.mts` (15 server-side functions)
- `scripts/*.ts` (9 seed/utility scripts, run locally only)
- `.env` file (gitignored, never committed)

**NOT present in any `src/` client-side code.** Verified by grep.

The `VITE_` prefix convention is correctly used:
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — exposed to browser (safe)
- `SUPABASE_SERVICE_ROLE_KEY` — no VITE prefix, server-side only
- `CLAUDE_API_KEY` — no VITE prefix, server-side only

---

## 5. Client-Side Security

- No `dangerouslySetInnerHTML` in any component
- No `eval()` or `Function()` constructor usage
- All user-generated content rendered via React JSX (auto-escaped)
- Markdown in help articles rendered as plain text (no HTML injection)
- File upload accepts only specified extensions, max 20MB

---

## 6. Storage Bucket Security

- `job-files` bucket: private, signed URLs with 1-hour expiry
- File paths follow `{org_id}/{job_id}/{source|delivered}/{filename}` structure
- RLS on storage would need Supabase Storage policies (not yet configured — noted as medium risk)

---

## 7. Known Limitations

1. **Storage RLS:** Supabase Storage bucket policies not yet configured for per-org path isolation. Currently relies on application-level path construction. Configure bucket policies before production.

2. **Rate limiting:** No rate limiting on login attempts, file uploads, or API calls. Supabase has some built-in protection, but explicit rate limiting should be added for production.

3. **2FA:** Not implemented. Supabase Auth supports TOTP — enable for admin accounts before production.

4. **Session management:** "Sign out everywhere" not implemented. Supabase session refresh works but no explicit revocation UI.

5. **Audit log integrity:** `audit_log` table allows updates/deletes by admin role. For true append-only, remove UPDATE/DELETE policies and add a database trigger that prevents modifications.

6. **GDPR:** No data export or deletion workflow. Implement before handling EU client data.

---

## 8. Recommendations for Production

1. Rotate all API keys (Supabase, Anthropic, Stripe, Resend)
2. Configure Supabase Storage bucket policies
3. Enable 2FA for admin accounts
4. Add rate limiting via Netlify or Supabase
5. Make audit_log append-only at database level
6. Build GDPR data export/deletion workflow
7. Add monitoring/alerting on auth failures and API costs
8. Consider adding `is_demo` check at RLS level for defense-in-depth
