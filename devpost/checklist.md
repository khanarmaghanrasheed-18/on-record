---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Two people can register and become friends**
  Becomes usable: The app opens on desktop and phone sizes; two accounts can register, exchange a public friend ID once, and see each other in the friend panel.
  Why now: This is the smallest live shared behavior and proves the Supabase connection, account setup, and record-book shell before claims depend on them. Project bootstrapping is included here.
  PRD ref: `prd.md > The Core Journey` (steps 1-2), `prd.md > Accounts and friends`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Account and Profile`, `spec.md > Friend Panel`, `spec.md > Data Model`, `spec.md > File Structure`
  Build: Create the React/Vite app, responsive record-book shell, Supabase client and migrations, email/password registration, profile creation, friend requests, and accepted-friend list.
  Verify (mechanical): Run `npm run build`; with a configured Supabase project, register two test accounts, send and accept a request, reload, and verify the accepted friendship persists and a third account cannot read it.
  Learner check: Open the app on two phones or browser sessions, add each other by friend ID, and say whether the first screen and friend flow match your picture.
  Commit: `Add accounts and friend connections`

- [ ] **2. Friends can lock an AI-checked claim**
  Becomes usable: A creator chooses friends and a check date, everyone submits an answer, and a real AI check either explains vagueness or locks an immutable titled record. Invitees can decline.
  Why now: This is On Record's distinctive moment, and the unfamiliar Gemini integration is tested before settlement work grows around it.
  PRD ref: `prd.md > The Core Journey` (steps 3-4), `prd.md > Claims and AI clarity`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Claim Cards and Detail`, `spec.md > AI Clarity Function`, `spec.md > External Services and Dependencies`
  Build: Add claim creation, invitations, answers, claim cards/detail, the authenticated AI function, structured-output validation, and lock behavior.
  Verify (mechanical): Run `npm run build`; against the configured free-tier Gemini endpoint, show that “weather will be awesome” cannot lock and that a concrete two-person claim locks with a title, normalized choices, and unchanged original answers after reload.
  Learner check: Try one vague and one clear claim with a friend; inspect the locked record and tell me if the wording feels fair to both sides.
  Commit: `Add AI checked claim locking`

- [ ] **3. Due claims settle and update head-to-head scores**
  Becomes usable: Due claims appear in notifications, participants vote, group majorities or a two-person creator tie-break settle the record, and pairwise scores and profile titles reflect it.
  Why now: This closes the promised loop and proves group claims count correctly without a duplicate-award counter.
  PRD ref: `prd.md > The Core Journey` (steps 5-6), `prd.md > Due notice and settlement`, `prd.md > Scores and title`, `prd.md > Demo Acceptance Checks`
  Spec ref: `spec.md > Notifications and Settlement`, `spec.md > Pairwise Score and Titles`, `spec.md > Data Model`
  Build: Add due-date query, notification tab, protected vote-and-settle database function, score queries, profile ranks, and pending/disputed states.
  Verify (mechanical): Run `npm run build`; settle a two-person claim and a three-person claim, verify each correct-versus-wrong pair gets one point, same-outcome pairs get none, and repeated reloads/votes do not duplicate scores.
  Learner check: Settle a claim and check the head-to-head record with a friend; try a group claim and say whether the score feels right.
  Commit: `Settle claims and show rivalry scores`

- [ ] **4. The record book installs and can be demonstrated**
  Becomes usable: The app has home-screen icons and an install prompt where supported, works at phone size, and has clear setup and demo instructions for a free HTTPS deployment.
  Why now: Installation is the learner's stated learning goal; it follows a working core journey so the installed app has something meaningful to show.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`, `prd.md > What We're Building`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Look and Feel`, `spec.md > Important Failure Modes`
  Build: Finish responsive polish, PWA manifest/service worker/icons, `.env.example`, README, license, and Cloudflare Pages configuration and deployment when service access is available.
  Verify (mechanical): Run `npm run build` and a local production preview; inspect the manifest and icons, verify phone layout and core navigation, and check installation from the HTTPS deployment on a phone.
  Learner check: Open the deployed app on your phone, add it to the home screen, and try the two-account demo from the installed icon.
  Commit: `Prepare installable app and demo setup`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2, when the AI-checked locked claim can shape the remaining UI.
- [ ] Final kick-the-tires exploration and feedback completed — after slice 4.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship.

## Code Tour and App Map

- [ ] Learning activity complete — follow the phone installation path from manifest through HTTPS deployment and browser install.
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate.
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse.

Activity and evidence: not yet started.
Route and stops: not yet started.
Edit outcome: not yet started.
Reflection: not yet started.
Activity mode: not yet started.

## Revisions
- 2026-10-20: Live two-account testing confirmed a clear coin-flip claim locked with both original answers. The learner noticed the saved-answer form still looked unsent while waiting for a friend; the collecting view now shows an explicit saved state with an Edit action. Reload persistence and vague-claim rejection remain to verify before checking slice 2.
- 2026-10-20: The remaining claim, settlement, score, and PWA code was implemented before learner testing as requested. Local TypeScript/Vite build and generated PWA files passed checks. Slices 2–4 remain unchecked until the new SQL, Edge Function, two-account journey, and hosted install are verified live with the learner.
- 2026-10-20: Current Supabase publishable keys need the Edge Function's legacy gateway JWT check disabled; the function verifies the user's session token itself. The implementation and deployment guide now reflect this without changing the agreed product behavior.
- 2026-10-19: The learner requested that all remaining code be written before further hands-on tests. Keep mechanical build checks during implementation, then run the individual live flows with the learner after the code is complete.
- 2026-10-19: First live test exposed an ambiguous `id` in the profile visibility policy. A repair migration was applied, and both accounts saw the accepted friendship after reload.
