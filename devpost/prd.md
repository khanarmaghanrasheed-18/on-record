---
doc: prd
status: approved
---

# On Record — Product Requirements

A phone-friendly prediction record book for friends. Source: `scope.md > The Unique Kernel`, `Who It's For`, and `The POC Boundary`.

## The Core Journey

1. A new person registers an account once; returning people open their claim collection.
2. A person sends a friend request by user ID. Once accepted, the friend can be chosen for claims without re-entering an ID.
3. The creator starts a dated claim and chooses two or more participants from their friends. Each participant writes their own answer or claim.
4. AI checks the wording, finalizes the shared claim and a one-line title, and the submitted answers lock before the outcome. An invited friend can decline to join instead of having a claim affect their score.
5. When the check date arrives, participants receive a notice and propose the actual outcome. A group settles by majority; with two people, the creator's decision breaks a disagreement.
6. The record preserves the original positions and outcome. A correct participant gains one point against each wrong participant; head-to-head scores and earned profile titles update.

## Screens and Layout

- **Registration** for first-time account creation.
- **Home** after sign-in: claims appear as vertically stacked, differently colored cards with one-line titles; friends' user names appear in a side panel. The main action is starting a claim. A notifications tab shows due claims.
- **Friend area** for requesting a friend by user ID and accepting a request, then selecting friends for a claim.
- **Claim detail** for submitted answers, AI's shared wording, lock state, check date, and eventual result.
- **Head-to-head score view** for the selected friend; group claims contribute to each pair's score.

Source: `scope.md > The Core Loop` and `What "Working" Looks Like`.

## Look and Feel

The learner wants a record-book feel. Claim cards line up vertically and use different colors. Typography and whether colors encode status are not specified.

## Features and Behavior

### Accounts and friends

- New users register once; returning users see their existing claims and friends.
- Send a friend request using a user ID; after acceptance, add that friend to claims from the friend list.
- Claim participation requires an account.

### Claims and AI clarity

- A creator sets a check date and selects friends; each participant submits an answer in their own words.
- AI checks for vague, subjective, or untestable wording before the claim can lock and proposes a clear shared wording and one-line card title. "Tomorrow's weather will be awesome" should be rejected or rewritten into an objective condition because "awesome" means different things to different friends.
- Original answers remain visible after locking. Participants do not need a separate approval step for AI's final wording; an invitee who does not want to take part can reject the invitation without affecting their score.

### Due notice and settlement

- A due claim appears in the in-app notifications tab when a friend next opens On Record. A phone notice while the app is closed is optional only if it adds no meaningful cost or burden.
- Each participant can vote on the actual outcome. For groups of three or more, the majority choice settles the claim. With two participants who disagree, the creator breaks the tie. If no majority emerges in a larger group, the claim remains unresolved until more votes or agreement arrive.

### Scores and title

- On a settled claim, each correct participant gains one head-to-head point against each participant who was wrong.
- A pair with the same correctness does not gain a point against each other for that claim.
- If no original answer matches the agreed outcome, no points are awarded.
- Profiles earn rank-like titles based on total correct claims. Several friends can hold the same title, as in battle royale games. Exact labels and thresholds are a low-stakes implementation detail; the learner said they are not important to the first version.

## States and Boundaries

- **First use:** registration precedes the home collection.
- **No claims/friends:** the home and friend area need a clear starting action.
- **Pending:** invited friends can submit their answer or decline. A declined invitation does not affect their score. The claim waits for the required answers before locking.
- **Locked:** original answers and shared wording cannot be quietly changed.
- **Due:** the in-app notifications tab shows the claim and settlement becomes available.
- **Disputed or unclear:** no scoring until a majority of a group agrees, except that the creator resolves a two-person tie.
- **Settled:** the record shows the outcome and scores persist on return.

## Product Decisions

- Accounts and friend requests replace anonymous share links so repeat friends can build a shared history.
- Group claims are required, though a two-person claim is enough for the demo.
- Scores are between pairs of friends, including pairs who participated in a group claim.
- The visual metaphor is a record book with a vertical stack of colored claim cards.

## What We're Building

One complete account-to-settlement journey with friend requests, group claims, required AI clarity checks, a due notice, a preserved locked record, head-to-head scoring, and earned profile titles.

## Demo Acceptance Checks

- Two accounts can become friends through one user-ID request and then select each other for a claim.
- A vague claim receives a concrete explanation or rewrite and cannot lock as-is.
- Two or more submitted answers become a titled, locked record whose original wording remains visible.
- A due claim appears in the notifications tab; participants can settle it by the agreed voting rule.
- A settled claim updates each correct-versus-wrong pair once and updates the relevant profile title without duplicate awards.

## Deferred From the POC

Richer statistics and social features beyond claims, friends, and scores.
Phone push notifications while the app is closed, if they add setup burden. The due claim remains visible in the app at no extra cost.

## Possible Later Enhancements

More ways to browse a long history of predictions and more detailed rivalry summaries.

## Non-Goals

- Cash stakes or payments.
- Automatic verification of real-world events.

## Open Questions

No product-defining questions remain. The title names and thresholds can be chosen during implementation.
