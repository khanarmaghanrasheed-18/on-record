# On Record — handoff for the next chat (2026-10-20)

## Read this first

Continue the existing React/Vite PWA in this repository; do not restart the project. The user's latest live report is: **password recovery through the sign-in email works**. The user is moving chats and requested this complete handoff. The most recent feature commit before this handoff is `2e53730` (`Add recovery profiles and timed answer corrections`), pushed to `main` at <https://github.com/khanarmaghanrasheed-18/on-record>. Use `git status` and the latest commit to see whether any newer work has landed.

**Important uncertainty:** The user has **not reported** whether they ran `202610200003_profiles_photos.sql` or `202610200004_locked_answer_edits.sql`, nor whether they deployed the latest `clarify-claim/index.ts`. Password recovery needs none of these, so its successful test does not establish their deployment. Ask for the status only when it matters to the next live test; do not claim they succeeded or rerun SQL files without checking.

## How to work with the owner

- Every answer/explanation to the user must be **at most 20 lines**, unless they explicitly ask for a concept explanation. Code itself may be longer.
- The user chose **fast build mode** and said to write all code before testing individual features. They want progress pushed to GitHub alongside work.
- **The user performs browser actions. Do not access Chrome or any browser without asking first.** Give precise steps for Supabase, the app, and hosting, then wait for the result. They specifically asked agents to stop spending tokens on browser tasks they can do.
- Never request passwords, a service-role key, or the Gemini API key in chat. The user handles credential entry privately.
- Preserve the free-cost goal. A phone-installable PWA is the chosen route; Cloudflare Pages deployment is planned, not yet confirmed live.
- Use the local Devpost Learn Skill Pack in `.agents/skills/`, especially `5-build/SKILL.md` while finishing and `6-ship/SKILL.md` only after build review is complete. The approved planning docs are `devpost/scope.md`, `prd.md`, `spec.md`, and `checklist.md`. The private `devpost/learner-profile.md` is Git-ignored.

## Product and agreed behavior

On Record is a shared record book for friends' predictions. People register with email/password, connect once using an eight-character friend ID, and select accepted friends for each claim. Each participant writes their own answer. Gemini must reject vague or subjective claims and, when clear, produce a neutral title, question, and outcome choices. Draft answers remain private until lock; a rejected topic can be revised by the creator, which clears draft answers and requires fresh submissions. AI runs automatically after the final answer; there is no extra “check AI” button.

For **five minutes after the first lock**, each participant may edit **only their own answer**; the window ends sooner if the claim's due time arrives. The revision is checked by AI before it is committed, the original `locked_at` does not reset, and after the deadline answers are permanent. The creator cannot change the topic after lock. A due claim appears in the in-app Notices tab. Participants vote on the real outcome: a majority settles a group claim; when exactly two people disagree, the creator's vote decides after both have voted. Each correct-versus-wrong pair gains one head-to-head point, including pairs from group claims; same-correctness pairs do not score. Earned rank titles can be shared by many people.

Profiles are opened from the top-right header, Friends, or Scores. The owner can edit their name, personal title, bio, and photo; accepted friends can view these details and the earned rank. Password reset uses the **sign-in email**, not a separate recovery address. Claim cards are vertically stacked in richer green, coral, blue, and purple. In-app due notices suffice; email due reminders and closed-app push are deferred.

## Verified live by the user

- Supabase project exists; two test accounts (Arman and Arman2) were created, their friend request was accepted, and each saw the other after reload.
- The original five migrations through `202610200002_claim_revisions.sql` ran successfully. The earlier `clarify-claim` function was deployed with legacy **Verify JWT off** and `GEMINI_API_KEY` stored privately as an Edge Function secret.
- A clear two-person coin-flip claim locked with both answers. Gemini rejected a subjective “weather will be awesome” claim. The creator's revised-topic/fresh-answer flow worked. The saved-answer confirmation card was seen live.
- **Password recovery email and reset logic work**, per the user's latest report. Do not re-test unless a later change affects it.
- These reports do not establish live settlement/scoring, profile editing/photo visibility, five-minute post-lock edits, inline AI error location, hosted deployment, or phone installation.

## Implementation and setup state

- Stack: React/TypeScript/Vite PWA, Supabase Auth/Postgres/Storage/Edge Function, Gemini clarity check, intended Cloudflare Pages HTTPS hosting.
- Supabase project ref: `skgajmkjiqbbplwvxqml`; project URL: `https://skgajmkjiqbbplwvxqml.supabase.co`. The local ignored `.env` has the public URL/publishable key; never commit it. Supabase CLI, Docker, psql, and gh were unavailable earlier; Git pushing worked with an escalated terminal command.
- `src/App.tsx`: auth, reset-password UI, shell, friends, profile navigation. `src/components/ProfilePage.tsx` and `Avatar.tsx`: profile editing/view, photo upload. `src/components/ClaimWorkspace.tsx`: claims, AI feedback, saved-answer state, locked-answer correction. `src/components/NoticesPage.tsx` and `ScoresPage.tsx`: settlement and pairwise scores. `src/lib/claims.ts` and `supabase.ts`: client/data helpers. `src/styles.css`: responsive record-book styling and vibrant cards.
- Migrations `202610190001` through `202610200002` are live. **Status unknown** for `supabase/migrations/202610200003_profiles_photos.sql` (profile columns and public owner-scoped photo bucket) and `202610200004_locked_answer_edits.sql` (server-enforced five-minute correction). If not run, the owner should run 003 then 004 **once each** in Supabase SQL Editor.
- `supabase/functions/clarify-claim/index.ts` now accepts a proposed answer revision, rechecks it with Gemini, and calls a service-role-only atomic RPC. **Latest deployment status unknown.** If needed, the owner can open the existing Supabase Edge Function's Code tab, replace `index.ts`, and click **Deploy updates**; deletion/recreation is unnecessary. Keep Verify JWT off: the function calls `auth.getUser` to verify the session. The existing Gemini secret persists.
- The app uses Supabase Auth's `resetPasswordForEmail` and `updateUser`; the user tested this successfully. On a future hosted deployment, allow the hosted origin under Supabase Authentication → URL Configuration so reset and confirmation links return to the app.
- The feature commit passed `npm.cmd run build` (TypeScript and Vite; PWA output generated). This does **not** validate the new SQL against the live database, the latest Edge Function against Gemini, or the phone UI. Static PWA manifest/icons/service worker are implemented; no confirmed Cloudflare Pages deployment.
- `README.md` has setup, deployment, demo steps, scoring rules, and photo privacy. The photo bucket is public for delivery; anyone with a photo URL can view that image. The PWA caches static assets, not account/claim responses.

## Next checkpoint, in order

1. Check `git status`, the latest commit, and `devpost/checklist.md`. Confirm whether migrations 003/004 and the latest Edge Function code were deployed; avoid making the owner repeat completed setup. Do not open their browser.
2. Once those are live, have the owner create a **new** clear claim with a due time more than five minutes away. Both accounts should see their own correction option. Edit one answer, let AI check on submit, reload both accounts, and verify the revised answer and normalized choice. Check that edits close at five minutes or the due time, whichever comes first. Test vague-answer feedback next to the editor.
3. Have the owner test own profile name/title/bio/photo and the friend's read-only view; inspect any error they report. Brighter card colors should also be visible.
4. Complete the existing core journey: due notice, two-person voting/creator tiebreak, group majority, pairwise scores and earned ranks, including reload without duplicate points. Resolve any issues before ticking the relevant checklist boxes.
5. Deploy the GitHub repository to Cloudflare Pages as described in `README.md`, set only public build variables, configure Supabase Auth redirect URLs, and have the owner test installation and navigation on a phone. Do the final learner review, code tour/app map, and then `6-ship` submission work.

## Verification and Git discipline

```powershell
cd C:\Armaghan\PYTHON\HACKATHONS\ONRECORD
git status --short
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5188
```

The dev server may not survive chat/session changes. Commit and push each verified checkpoint to `origin/main`; inspect staged files for secrets and unrelated work first. `devpost/checklist.md` currently has slice 1 checked and slices 2–4 plus final review still open. Do not mark a live check complete from a local build or infer a deployment from password recovery alone.
