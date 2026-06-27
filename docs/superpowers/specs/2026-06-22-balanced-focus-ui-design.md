# Balanced Focus UI Design

## Goal

Improve the live host experience by making the current required action dominant while keeping enough audit context visible to avoid mistakes.

## Current Context

The app is a browser-only React/JS Mafia host tool with one main UI file (`src/app.js`) and one stylesheet (`src/styles.css`). It already tracks phases, role setup, timers, speeches, votes, shootouts, night actions, blockers, manual marks, logs, and player status. The current pain point is visual priority: too many blocks compete for attention even though the state model already knows what matters next.

## Chosen Direction

Use a Balanced Focus layout:

- The primary phase action answers what the host needs to do now.
- The player board stays stable and prominent across phases.
- Audit context stays close, but only in compact form by default.
- Full log, full role summary, manual mark controls, and detailed checklists move behind drawers or expandable sections.

This combines the user's preference for next-action focus with audit/control safeguards.

## Layout

The screen has three priority levels:

1. Primary: current required action.
   Examples include confirming roles, starting the discussion timer, managing the current speaker, recording a vote, applying the current night action, announcing results, or marking final speeches.
2. Secondary: stable player board.
   The board remains the persistent workspace. Player clicks continue to select a target or apply the active mark.
3. Tertiary: audit/support context.
   Always-visible audit context is limited to latest event, compact progress, current blocker, active mark mode, and compact role/checklist summaries.

## Phase Behavior

### Intro Night

Role setup is the primary action. Live-game tools stay hidden until roles are confirmed. Detailed role inputs are visible before confirmation and can collapse after roles are locked. The next-phase button remains blocked until valid roles are confirmed.

### Discussion

The discussion timer and next-phase transition are primary. The board remains visible. Previous public night results stay visible only long enough for announcement. Latest event remains visible.

### Speeches And Voting

The current speaker card is primary. On day 1, the primary action is finishing the speech and moving to the next speaker. On later days, the primary action is capturing the current speaker's vote. The full player speech/vote table becomes expandable after the current speaker card.

### Vote Results

The announcement card and required last-word actions are primary. Timer and night action controls are hidden. The next-phase button remains blocked until required last words are complete.

### Night

The current night action is primary: role, target, apply, and clear. The night checklist appears as compact progress, with full details expandable. Manual marks remain available but do not dominate the screen.

### Game Over

Winner and surviving players are primary. Logs and tools collapse by default.

## Disclosure Rules

Always visible:

- Current phase title and next-phase button/blocker.
- Primary phase action.
- Player board.
- Latest event.
- Active manual mark mode when a mark is selected.
- Compact progress summary such as `4 / 7 night actions` or `12 / 18 votes`.

Collapsed by default:

- Full journal.
- Full role strip after intro night.
- Manual mark controls when no mark is active.
- Full night checklist when compact progress is enough.
- Full speech/vote table when the current speaker flow is enough.

Expanded by default only when needed:

- Role editor during intro night before confirmation.
- Vote/shootout details when there is a tie.
- Last-word list when pending.
- Night checklist if a phase transition is blocked by incomplete night actions.
- Full log after an error/blocking action or when the host opens it.

## Implementation Boundaries

This is a UI restructuring, not a rules rewrite.

Expected changes:

- Add derived phase-focus helpers for primary action label, compact progress, latest event, and blocker state.
- Restructure `MainColumn` and `ActionPanel` so active phase actions are promoted and secondary blocks are collapsible.
- Keep existing game state and rule functions intact unless a UI bug is discovered during implementation.
- Add persistent disclosure state only where useful, such as which drawer is open.
- Update CSS for stronger hierarchy, fewer always-visible cards, compact audit chips, and stable board sizing.

## Verification Requirements

Implementation must verify:

- Role confirmation still blocks intro-night transition correctly.
- Timer behavior remains correct in discussion and speeches.
- Current speaker, vote capture, shootout, night action checklist, and final speech blockers still work.
- Collapsed sections do not hide active errors or required blockers.
- Desktop and mobile layouts have no overlapping controls or unreadable text.

## Out Of Scope

- Changing game rules.
- Adding new roles.
- Rewriting the state model.
- Building a separate route/navigation system.
- Adding an audit-rich mode as a second full layout.
