---
doc: spec
status: approved
---

# On Record — Technical Spec

## How This Works, In Plain Language

The installable web app is the record book people open on their phones. Supabase keeps accounts, friend links, claims, answers, and votes together so friends see the same record. A small server function sends submitted wording to Gemini, gets back a clear title, question, and answer choices, and locks the claim only when the wording can be settled fairly. The AI key stays on that server function, not in the downloadable app. When a claim is due, the app shows it in a notifications tab. Votes settle the result; scores are calculated from locked answers and settled results so refreshing cannot award a point twice.

This implements `prd.md > The Core Journey` and preserves `scope.md > The Unique Kernel`.

## The Core Journey Through the System

1. **Register:** email/password goes to Supabase Auth; a profile with a short public friend ID is created. A returning session opens the claim list.
2. **Add a friend:** enter their public ID; Supabase records a request. The recipient accepts, after which both see each other in the friend panel.
3. **Create a claim:** the creator enters a topic, future check date, and accepted friends. Supabase stores the invitation and an empty answer slot for each participant.
4. **Answer and lock:** each participant saves a private draft answer or declines. The final answer submission automatically calls an authenticated Supabase Edge Function to ask Gemini for a clarity check and structured title, question, and normalized outcome choices. If it flags ambiguity, the app shows feedback and stays editable. Revising the topic clears prior draft answers so everyone responds to the new wording before another automatic check. If clear, the function stores the original answers and normalized choices and locks the claim before the check date.
5. **Notice and vote:** when the date is reached, a database query marks the locked claim as due in each participant's notifications tab. Each votes for one normalized choice or “none of these.” A majority of all active participants settles a group claim; when two disagree, the creator's vote settles it once both have voted.
6. **Score:** the settled outcome remains attached to the original answers. A head-to-head query gives one point for every correct-versus-wrong pair on a shared claim, including group claims. A profile's correct-claim count determines its title. Reopening the app reads the same record.

See `prd.md > Accounts and friends`, `Claims and AI clarity`, `Due notice and settlement`, and `Scores and title`.

## Stack

- **React + TypeScript + Vite:** free, open-source browser UI and build tool. [React](https://react.dev/), [Vite](https://vite.dev/guide/).
- **Progressive web app manifest and service worker via `vite-plugin-pwa`:** home-screen installation from HTTPS; cache the app shell, while live claims still require a connection. [Install requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [plugin documentation](https://vite-pwa-org.netlify.app/).
- **Supabase JavaScript client, Auth, Postgres, and one Edge Function:** the learner chose Supabase; its free tier includes accounts, database, and function calls. [JavaScript client](https://supabase.com/docs/reference/javascript/introduction), [pricing](https://supabase.com/pricing), [Edge Functions](https://supabase.com/docs/guides/functions).
- **Gemini 3.5 Flash-Lite:** clarity and title generation via the Edge Function. The current free tier covers the demo, subject to quotas. Google says free-tier inputs may be used to improve its products. [Model list](https://ai.google.dev/gemini-api/docs/models), [pricing](https://ai.google.dev/gemini-api/docs/pricing).
- **Cloudflare Pages:** free HTTPS hosting for the built static app. [React deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/), [free limits](https://developers.cloudflare.com/pages/platform/limits/).

No paid plan is required for the planned demo. Each free service has quotas; Supabase can pause an inactive free project. The owner can restore it in the Supabase Dashboard by selecting the project and clicking **Resume project**. [Supabase pausing guide](https://supabase.com/docs/guides/platform/free-project-pausing).

## Where It Runs and How Someone Tries It

- **Local build:** Node.js 24 is installed. Run `npm install`, create a local `.env` from `.env.example` with the Supabase URL and publishable key, then `npm run dev` and open the shown localhost URL. Apply the SQL migration and deploy the Edge Function to the user's Supabase project, with `GEMINI_API_KEY` saved as a server secret. Never paste credentials into chat or commit them.
- **Hosted build:** connect the repository to Cloudflare Pages, build with `npm run build`, publish `dist/`, and set the public Supabase URL/key as build variables. HTTPS permits phone installation from the browser's **Add to Home Screen** flow. Set the hosted URL in Supabase Auth redirects.
- **Demo:** use two test accounts, add a friend, complete a prepared claim whose check date is due, settle it, and show the pairwise score and title. The hackathon also requires a public repository and a demo video under three minutes; deployment does not replace them. [Devpost rules](https://learn-ai-basics.devpost.com/rules).

## Look and Feel

Implements `prd.md > Screens and Layout` and `Look and Feel`: a record-book mood, vertically stacked claim cards with varied muted colors, concise one-line titles, and a friend side panel on wide screens. On phones, the friend panel becomes a reachable drawer or section. Status text and icons remain explicit so color alone never carries meaning. Typography should feel like a readable record rather than a generic dashboard.

## Components

### Account and Profile

React screens for email/password registration and sign-in, profile name and friend ID, session restoration, and sign-out. Supabase Auth handles passwords; the `profiles` table contains only public app identity. Implements `prd.md > Accounts and friends` and `States and Boundaries`.

### Friend Panel

Send a request by public ID, accept or decline incoming requests, and choose accepted friends for a claim. It does not accept arbitrary non-friends as claim participants. If declined invites leave fewer than two active participants, the creator can invite another accepted friend before locking. Implements `prd.md > Accounts and friends` and `Screens and Layout`.

### Claim Cards and Detail

Home displays vertically stacked colored cards. Detail shows the topic, check date, invitation state, each original answer, AI's title/question, and the settled outcome. Draft answers can be edited only before locking; locked wording is immutable. Implements `prd.md > Claims and AI clarity` and `Screens and Layout`.

### AI Clarity Function

The authenticated `clarify-claim` Edge Function fetches the claim and current answers server-side, checks participation and future check date, asks Gemini for structured JSON, validates it, and either returns specific feedback or stores the final title/question/options and locked timestamp. It rejects subjective wording such as “weather will be awesome.” Only this function can write AI-approved lock fields. Implements `prd.md > Claims and AI clarity`.

### Notifications and Settlement

The notifications tab queries locked claims where `due_at <= now()` and the viewer is a participant. A vote form offers AI-normalized choices and “none of these.” An atomic database function validates due status and participant identity, records or updates a vote, and settles once the PRD's rule is met. Implements `prd.md > Due notice and settlement`.

### Pairwise Score and Titles

A read-only database function computes a selected pair's score from settled shared claims; another counts correct settled claims for earned profile titles. Scores are derived, not incremented on every page load. Initial rank labels and thresholds are simple implementation choices because the learner said exact values are unimportant. Implements `prd.md > Scores and title` and `Demo Acceptance Checks`.

## Data Model

- `profiles`: `id` (Auth user), `display_name`, unique short `friend_code`, creation time. Identity remains after app restart.
- `friendships`: unordered user pair, requester, status (`pending`, `accepted`, `declined`), timestamps. One row per pair; only the addressee can accept.
- `claims`: creator, initial topic, AI title/question, normalized outcome choices, check date, state (`collecting`, `locked`, `settled`), lock time, settled choice, timestamps.
- `claim_members`: claim/user pair, invitation state, original answer, normalized choice, vote. One active member row per friend in a claim. Original answer becomes immutable at lock.

Authenticated browser reads use Supabase Row Level Security (RLS): only participants read a claim and answers; only members of a friendship see its request; authenticated people may find a profile by public friend code. Browser writes are restricted to their own drafts and authorized requests. The Edge Function performs AI-approved locking with server credentials. Database functions validate and commit votes atomically. [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security), [key safety](https://supabase.com/docs/guides/api/api-keys).

## File Structure

```text
ONRECORD/
├── devpost/                    # Required hackathon planning docs and private learner profile
├── public/                     # PWA manifest and generated app icons
├── src/
│   ├── components/             # Cards, friend panel, notices, forms
│   ├── pages/                  # Auth, home, claim detail, score/profile
│   ├── lib/                    # Supabase client, API calls, score and date helpers
│   ├── App.tsx                 # Routes and signed-in layout
│   └── main.tsx                # React entry point
├── vite.config.ts              # React and PWA build settings
├── supabase/
│   ├── migrations/            # Schema, RLS, and database functions
│   └── functions/clarify-claim/# Authenticated Gemini proxy and claim lock
├── .env.example                # Public variable names, no values
├── package.json
├── README.md                   # Setup, deployment, demo, Supabase resume steps
└── LICENSE
```

## External Services and Dependencies

- **Supabase Auth:** `signUp({ email, password })`, `signInWithPassword`, and `getSession`; the hosted project's email-confirmation setting and redirect URL must match deployment. [Auth docs](https://supabase.com/docs/guides/auth/passwords). The default email service is limited, so the demo uses prepared accounts.
- **Supabase data:** browser queries `profiles`, `friendships`, `claims`, and `claim_members` through the publishable key and the signed-in session; `.rpc('create_claim', { topic, due_at, friend_ids })`, `.rpc('vote_and_settle', { claim_id, choice })`, and score RPCs handle protected multi-row operations. Responses are table rows or an updated claim state. [Client docs](https://supabase.com/docs/reference/javascript/introduction), [RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security).
- **AI function:** `supabase.functions.invoke('clarify-claim', { body: { claimId } })` sends the user's Auth token. It returns `{ locked: true, title, question, options }` or `{ locked: false, feedback }`. [Invoke docs](https://supabase.com/docs/reference/javascript/functions-invoke).
- **Gemini:** the Edge Function sends the topic and answers to `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent` with `x-goog-api-key` and structured JSON response instructions. No browser call contains the secret. [GenerateContent API](https://ai.google.dev/api/generate-content), [structured output](https://ai.google.dev/gemini-api/docs/structured-output). Check the exact response format in the build against the live API docs.
- **Cloudflare Pages:** runs the Vite build and serves `dist/` over HTTPS; no app server is hosted there. [Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/).

## Important Failure Modes

- **Gemini unavailable or over quota:** keep the claim editable and show a retry message; never silently lock an unchecked claim.
- **Supabase offline, paused, or session expired:** show a reconnect/sign-in message and keep draft text in the form until saving succeeds. The owner can resume a paused free project from the dashboard.
- **No majority:** display current votes as pending and award no points. A two-person disagreement waits for both votes before the creator's choice applies.

## What Was Simplified and Why

- **In-app due notifications** instead of email or phone push: no scheduler or mail service, consistent with the learner's free and low-burden choice. Email is used for account sign-in, not scheduled reminders.
- **Scores derived from settled records** instead of stored counters: one source of truth avoids duplicate awards and preserves the record-book idea.
- **One live AI clarity call at locking** instead of continual AI analysis: keeps API use and failure modes small while preserving the required clarity gate.

## Decisions and Open Issues

- **Learner choices:** Supabase database; phone-installable app if free; free hosting; accounts with email/password and a public friend ID; in-app due notices for the first version; AI clarity required before lock.
- **Recommended and accepted:** React/Vite PWA on Cloudflare Pages, Supabase Auth/Edge Function, Gemini free tier. The learner has not used React or Vite before, so the README and build review will explain how they fit together.
- **Useful uncertainty clarified:** an installable web app is a PWA served on HTTPS with a manifest and icons; people install it from their phone browser's home-screen action, without a Play Store submission. Verify installation on a real phone after the Cloudflare deployment. [PWA guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- **Build-time verification:** check Gemini 3.5 Flash-Lite access and response shape with a real free-tier key; verify Supabase hosted Auth email settings and the PWA install flow. These do not change the agreed product behavior.
