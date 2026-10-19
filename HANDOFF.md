# On Record — session handoff (2026-10-19)

## Where to resume

Resume at **slice 2: AI-checked claim locking**. The account/friend slice is live and verified. Claim creation, answer collection, an AI Edge Function, and the claim UI are committed in this checkpoint and pass `npm run build`, but the new SQL migration has **not** been applied to the live Supabase project, the Edge Function has **not** been deployed, and no claim flow has been tested. Complete the remaining code before asking the user to test individual flows.

The user explicitly requested this handoff because the current session is nearing a five-hour limit. Do not treat the claim slice as verified or continue coding beyond this checkpoint in this session.

## User preferences and decisions

- Explanations to the user: **maximum 20 lines** unless they explicitly ask for a concept explanation.
- User said: **“first write all the code then we can test individual things.”** They chose fast build mode. Keep local build checks, then coordinate live testing after the remaining code is written.
- User said: **“tell me when you need to do a task on browser, i will do it myself.”** Do not access Chrome or their browser without asking again. Give them exact browser steps when needed; never ask for passwords or a Gemini API key in chat.
- Push code to GitHub as work progresses. The public repo is <https://github.com/khanarmaghanrasheed-18/on-record>, `origin` on `main`.
- Keep hosting and services on free tiers where feasible. The selected stack is React/TypeScript/Vite PWA, Supabase Auth/Postgres/Edge Functions, Gemini clarity checking, and Cloudflare Pages.

## Product contract

The approved scope, PRD, technical spec, and build checklist are in `devpost/`. The user wants email/password accounts; a short public ID used once for friend requests; accepted friends added by name to claims; two-person demo with group claims supported; a dated topic; everyone enters their original answer; mandatory AI clarity check and neutral title/question/options; an invitee may decline; originals lock; an in-app due notice; group majority outcome vote (two-person disagreement breaks toward the creator); a point for each correct-vs-wrong pair; same-correctness pairs do not score; head-to-head leaderboards and profile titles; and a record-book visual style with vertically stacked colored claim cards. Installation on a phone is an important goal; an installable HTTPS PWA is the chosen free approach.

## Current infrastructure and access

- Supabase project ref: `skgajmkjiqbbplwvxqml`; URL: `https://skgajmkjiqbbplwvxqml.supabase.co`.
- Local ignored `.env` contains the Supabase URL and **publishable** key. Never commit `.env` or put a service-role/Gemini secret in `VITE_` variables.
- Two real Auth accounts (Arman and Arman2) exist. The user created them, accepted a friend request, and confirmed each sees the other after reload.
- `supabase/migrations/202610190001_accounts_friends.sql` and `202610190002_fix_profile_visibility.sql` have been applied live. The second migration fixes an ambiguous `id` in the profile visibility policy discovered by the first real test.
- `supabase/migrations/202610190003_claims.sql` exists only in the repo. Apply it in the Supabase SQL Editor when it is time for live claim testing; review it first, especially RLS, RPC permissions, and group behavior.
- `supabase/functions/clarify-claim/` exists only in the repo. It needs deployment and a server-side `GEMINI_API_KEY` secret before live testing. The user offered to supply/configure the key when needed; ask them to enter it in Supabase privately, never in chat. Verify model availability and the Gemini structured-output request against current official docs before deployment.
- A local Vite server was running at `http://127.0.0.1:5188/` in the earlier session; assume it may stop when the session ends. Start it again if needed.
- `gh`, Docker, `psql`, and Supabase CLI were unavailable in the earlier session. Git push worked through `git` with escalated terminal permissions. Browser tasks belong to the user now.

## Code at this checkpoint

- `src/App.tsx`, `src/lib/supabase.ts`, and migrations 001/002 implement accounts, profile creation, friend requests, acceptance, the record-book shell, and responsive friends/profile views.
- `src/components/ClaimWorkspace.tsx`, `src/lib/claims.ts`, migration 003, and `supabase/functions/clarify-claim/index.ts` implement the first draft of claim creation, invitations, private draft answers, decline, AI check, and atomic lock. The Records page now renders ClaimWorkspace. New claim styles are appended to `src/styles.css`.
- `npm run build` passed on this checkpoint (TypeScript and Vite; 75 modules). No live claim integration test has been run. The Edge Function was not type-checked by the Vite build.
- `src/App.tsx` still has placeholder Notices and Profile score content. There is no voting, settlement, score query, profile title, PWA manifest/service worker, Cloudflare deployment, or finished demo documentation yet.
- `README.md` still describes slice 1 and must be updated once the rest is built.

## Suggested next work

1. Review/fix migration 003 and the Edge Function before applying. Verify the model name and JSON response schema with official Gemini documentation. Consider race handling for simultaneous AI lock attempts and a direct Edge Function type check.
2. Build the settlement migration: vote only after due time; active participants vote on one of the locked options (or a clearly modeled unlisted outcome); group majority of active members, with creator tie-break only for exactly two participants; settle once atomically. Compute pairwise scores from settled rows so retries cannot duplicate points. Add profile win totals/titles.
3. Replace Notices/Profile placeholders and add a head-to-head leaderboard UI. Check that group claims award A-over-C and B-over-C when A/B are correct and C is wrong, with no A/B pair point.
4. Add PWA manifest, service worker, 192/512 icons, install guidance, free deployment setup, and final README. Keep account data out of static caches.
5. Run local builds. After all code is written, ask the user to perform the required Supabase SQL/function/secret steps in their browser. Then run the two-account vague/clear claim, settlement, group scoring, and phone install checks. Update `devpost/checklist.md` only for work actually verified.
6. Commit and push each checkpoint to `origin/main`. Inspect staged files for secrets before every push.

## Immediate known risks to inspect

- Migration 003 has not run against Postgres; successful TypeScript/Vite compilation does not validate SQL syntax, grants, or RLS behavior.
- Gemini response handling and model name have not been checked against a live key. A safe failure must leave answers editable, not lock a dubious claim.
- The UI automatically invokes AI when the final person answers and also offers a manual lock button. Test concurrent requests and ensure a harmless outcome when another request locks first.
- The claim detail RPC intentionally redacts other people's original draft answers before lock; direct `claim_members` access is revoked for authenticated clients. Verify this with real accounts.
- Claims whose due time passes while still collecting currently have no cancellation/expiry UI. Decide the user-facing behavior before final demo.

## Repo and verification commands

```powershell
cd C:\Armaghan\PYTHON\HACKATHONS\ONRECORD
git status --short
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5188
```

Read `devpost/checklist.md` first. Slice 1 was completed and verified. Slices 2–4 and the final review remain open.
