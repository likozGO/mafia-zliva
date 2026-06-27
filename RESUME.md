# Resume: Mafia Host Balanced Focus UI

## Hard Constraints

- Do not commit.
- Do not push.
- Keep all work local unless the user explicitly changes this.
- The app is a private host screen, not a player-facing display. Private role/check results may be shown in host UI.

## Current Local State

The repo has local uncommitted changes:

- Modified: `.gitignore`
- Modified: `index.html`
- Modified: `package.json`
- Modified: `src/app.js`
- Modified: `src/styles.css`
- Added, untracked: `docs/superpowers/specs/2026-06-22-balanced-focus-ui-design.md`
- Added, untracked: `docs/superpowers/plans/2026-06-22-balanced-focus-ui.md`
- Added, untracked: `src/ui-focus.js`
- Added, untracked: `tests/ui-focus.test.mjs`

Nothing should be staged. The previous turn explicitly unstaged the earlier staged files.

## What Was Implemented

Balanced Focus UI was implemented locally:

- Added `src/ui-focus.js`, exposed as `globalThis.MafiaUiFocus`.
- Added tests in `tests/ui-focus.test.mjs`.
- Added `npm test` script using `node --test`.
- Loaded `src/ui-focus.js` before `src/app.js` in `index.html`.
- Cache-busted `src/styles.css` in `index.html`.
- Added local `.superpowers/` ignore entry to `.gitignore`.
- Added `openDrawer` state in `App`.
- Collapsed role strip after intro night unless role drawer is open.
- Collapsed full `LogBox` unless log drawer is open.
- Added side-panel focus shell:
  - current phase/action summary;
  - compact audit chips;
  - latest event chip;
  - blocker chip;
  - active mark chip;
  - drawer buttons for roles, marks, journal, details.
- Hid manual mark controls unless the mark drawer is open or an active mark exists.
- Hid phase detail card unless details drawer is open or intro night.
- Hid full night checklist unless details drawer is open or a blocker requires visibility.
- Added CSS for focus shell, audit chips, drawer buttons, collapsible panels, and responsive behavior.
- Fixed responsive grid override for `.workspace.game-workspace`.

## Verification Already Run

Commands passed:

```bash
npm test
node --check src/app.js
node --check src/ui-focus.js
```

Browser verification was done through a temporary local server:

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

Verified in browser at `http://localhost:4175/`:

- App loaded with title `Мафия`.
- No console errors.
- Journal drawer opens.
- Marks drawer opens.
- Role confirmation removes intro-night blocker.
- Next phase unlocks after role confirmation.
- Discussion phase and timer render after transition.
- Desktop overflow check passed.
- Mobile overflow check passed after CSS cache-bust.

The temporary server was stopped.

## Grilling Session Decisions

The user invoked `grill-me` and asked to grill everything. The following product/design decisions were made:

- Most expensive mistake to prevent: forgetting a night action.
- Night UI should use a hybrid active-action model:
  - selected action can stay active;
  - primary area must still show `Next missing: <action>` until all night actions are complete.
- Shield-blocked actions:
  - count as done;
  - remain visible as blocked in compact night summary.
- Night audit should not rely on latest log text.
- During night, show a structured per-night action ledger.
- Night ledger placement:
  - always visible in the side panel during night;
  - full checklist can remain in Details.
- Ledger privacy:
  - show full private results because this is a private host screen.
- Manual death:
  - stays in same drawer as other manual marks;
  - no extra confirmation.
- During night, player cards should emphasize night-relevant status over roles.
- Night target selection:
  - support both board click and dropdown;
  - board selection must visibly explain what will happen.
- Click-mode banner:
  - show only for manual marks, not for normal night actions.
- Night ledger should show actor identity.
  - Example: `Doctor #9 -> #4`, `Shield #2 blocked Doctor #9`.
- Night ledger compactness:
  - one row per available night action.
- Day flow most expensive mistakes:
  - recording wrong voter/target;
  - advancing before all votes/speeches complete.
- Speeches/voting table:
  - stays visible by default.
- Vote capture:
  - current speaker quick-vote remains primary;
  - row dropdowns are secondary.
- Vote audit:
  - row should show both directions:
    - voter row: `#6 voted #12`;
    - target row: received vote totals.

## Pending Work

Apply the grilled corrections locally, still with no commit/push:

1. Night primary area
   - Show `Next missing: <action>` even when another action is selected.
   - Include blocked action count/name in compact summary.

2. Always-visible night ledger
   - One row per available night action.
   - Show pending/done/blocked state.
   - Show actor identity.
   - Show target.
   - Show full private check results.
   - Show shield-blocked actions as blocked while counted complete.

3. Player board during night
   - Night-relevant statuses visually outrank roles.
   - Selected player card explains pending night action result.

4. Manual mark mode
   - Add a persistent board banner only when manual mark mode is active.
   - Banner should explain what clicking a player will do.

5. Speeches/voting
   - Keep full speech/vote table visible by default.
   - Keep quick-vote as the primary input.
   - Make row dropdowns visually secondary.
   - Show both voter choice and target received totals.

6. Tests
   - Extend `src/ui-focus.js` tests first for new helper behavior.
   - Follow TDD for new helper logic.
   - Run `npm test`.
   - Run `node --check src/app.js`.
   - Run `node --check src/ui-focus.js`.
   - Browser-verify at `http://localhost:4175/` or another approved local port.

## Useful Files

- Main app: `src/app.js`
- Styles: `src/styles.css`
- Helper module: `src/ui-focus.js`
- Helper tests: `tests/ui-focus.test.mjs`
- Design spec: `docs/superpowers/specs/2026-06-22-balanced-focus-ui-design.md`
- Implementation plan: `docs/superpowers/plans/2026-06-22-balanced-focus-ui.md`

## Notes For Next Chat

- If browser verification is needed, the sandbox may block starting a server unless escalated.
- Port `4174` was previously occupied/refusing connections.
- Port `4175` worked when started with:

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

- The in-app browser blocks direct `file://` navigation, so use a local HTTP server.
- The user wants to proceed in another chat, so start by reading this file plus current `git status`.
