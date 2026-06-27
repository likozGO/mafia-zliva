# Day Vote And Speech Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the host choose the player who opens each daytime table and the forward/backward direction, with speeches and vote collection following that same order.

**Architecture:** Add pure order helpers to `src/ui-focus.js` and consume them from `src/app.js`. Persist `dayStartPlayerId` and `dayDirection` in state, initialize them whenever day speeches start, and expose compact controls in `DayFlowCard`.

**Tech Stack:** Browser React via `vendor/react.production.min.js`, plain JavaScript, `node --test`, localStorage state persistence.

---

## Files

- Modify `src/ui-focus.js`: add pure `daySpeakerOrder`, `nextDaySpeaker`, and `normalizeDayDirection` helpers and export them on `window.MafiaUiFocus`.
- Modify `tests/ui-focus.test.mjs`: add unit coverage for order generation and next-speaker lookup.
- Modify `src/app.js`: add state fields, load migration, day-start initialization, order update handler, `nextSpeaker` integration, and `DayFlowCard` UI.
- Modify `src/styles.css`: add compact styling for the day order controls and queue preview.

## Task 1: Pure Day Order Helpers

**Files:**
- Modify: `src/ui-focus.js`
- Test: `tests/ui-focus.test.mjs`

- [ ] **Step 1: Add failing tests for order helpers**

Append these tests to `tests/ui-focus.test.mjs` after the existing imports and tests. Also add `daySpeakerOrder`, `nextDaySpeaker`, and `normalizeDayDirection` to the destructuring from `globalThis.MafiaUiFocus`.

```js
test("daySpeakerOrder starts from the opener and wraps forward", () => {
  const players = [
    { id: 1, alive: true },
    { id: 2, alive: true },
    { id: 3, alive: true },
    { id: 4, alive: true }
  ];

  assert.deepEqual(daySpeakerOrder({ players, dayStartPlayerId: 3, dayDirection: "forward" }), [3, 4, 1, 2]);
});

test("daySpeakerOrder starts from the opener and wraps backward", () => {
  const players = [
    { id: 1, alive: true },
    { id: 2, alive: true },
    { id: 3, alive: true },
    { id: 4, alive: true }
  ];

  assert.deepEqual(daySpeakerOrder({ players, dayStartPlayerId: 3, dayDirection: "backward" }), [3, 2, 1, 4]);
});

test("daySpeakerOrder skips dead players and falls back from a dead opener", () => {
  const players = [
    { id: 1, alive: false },
    { id: 2, alive: true },
    { id: 3, alive: false },
    { id: 4, alive: true }
  ];

  assert.deepEqual(daySpeakerOrder({ players, dayStartPlayerId: 3, dayDirection: "forward" }), [2, 4]);
});

test("nextDaySpeaker skips completed players in the selected direction", () => {
  const players = [
    { id: 1, alive: true },
    { id: 2, alive: true },
    { id: 3, alive: true },
    { id: 4, alive: true }
  ];
  const context = {
    players,
    dayStartPlayerId: 3,
    dayDirection: "backward",
    currentSpeaker: 3,
    completeIds: [3, 2]
  };

  assert.equal(nextDaySpeaker(context), 1);
  assert.equal(nextDaySpeaker({ ...context, completeIds: [3, 2, 1, 4] }), 0);
});

test("normalizeDayDirection accepts only forward and backward", () => {
  assert.equal(normalizeDayDirection("backward"), "backward");
  assert.equal(normalizeDayDirection("forward"), "forward");
  assert.equal(normalizeDayDirection("sideways"), "forward");
  assert.equal(normalizeDayDirection(null), "forward");
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test
```

Expected: FAIL because the new helpers are not exported yet.

- [ ] **Step 3: Implement pure helpers**

In `src/ui-focus.js`, add these functions before `root.MafiaUiFocus = { ... }`:

```js
function normalizeDayDirection(value) {
  return value === "backward" ? "backward" : "forward";
}

function daySpeakerOrder(context) {
  const aliveIds = (context?.players || [])
    .filter((player) => player?.alive)
    .map((player) => Number(player.id))
    .filter(Boolean);
  if (!aliveIds.length) return [];

  const direction = normalizeDayDirection(context?.dayDirection);
  const requestedStart = Number(context?.dayStartPlayerId);
  const startId = aliveIds.includes(requestedStart) ? requestedStart : aliveIds[0];
  const startIndex = aliveIds.indexOf(startId);
  const ordered = [];

  for (let offset = 0; offset < aliveIds.length; offset += 1) {
    const index = direction === "backward"
      ? (startIndex - offset + aliveIds.length) % aliveIds.length
      : (startIndex + offset) % aliveIds.length;
    ordered.push(aliveIds[index]);
  }

  return ordered;
}

function nextDaySpeaker(context) {
  const order = daySpeakerOrder(context);
  if (!order.length) return 0;

  const complete = new Set((context?.completeIds || []).map(Number));
  const currentSpeaker = Number(context?.currentSpeaker);
  const currentIndex = order.indexOf(currentSpeaker);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  for (let offset = 0; offset < order.length; offset += 1) {
    const id = order[(startIndex + offset) % order.length];
    if (!complete.has(id)) return id;
  }

  return 0;
}
```

Export them:

```js
root.MafiaUiFocus = {
  daySpeakerOrder,
  filterInitialImmunityTargets,
  finalSpeechRequiredDeathIds,
  initialImmunityActiveIds,
  latestLogEntry,
  nextDaySpeaker,
  nightActionLedger,
  normalizeDayDirection,
  phaseProgress,
  primaryFocus,
  rowFlashClass,
  shouldExpireInitialImmunity,
  toggleInitialImmunitySelection,
  toggleDrawerSet,
  voteAudit
};
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit helper changes**

```bash
git add src/ui-focus.js tests/ui-focus.test.mjs
git commit -m "Add day speech order helpers"
```

## Task 2: State And Flow Wiring

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: Add state fields and load migration**

In `makeBlankState`, add the new fields near `dayNumber`:

```js
dayStartPlayerId: 1,
dayDirection: "forward",
```

In `loadState`, add migration fields near `dayEliminationDone`:

```js
dayStartPlayerId: Number(saved.dayStartPlayerId) || blank.dayStartPlayerId,
dayDirection: window.MafiaUiFocus?.normalizeDayDirection(saved.dayDirection) || "forward",
```

- [ ] **Step 2: Add local helper functions in `src/app.js`**

Add these helpers near `nextAliveSpeaker`:

```js
function dayOrder(state) {
  return window.MafiaUiFocus?.daySpeakerOrder?.(state) || nextAliveSpeakerFallbackOrder(state);
}

function nextAliveSpeakerFallbackOrder(state) {
  return state.players.filter((player) => player.alive).map((player) => player.id);
}

function completeSpeechIds(state) {
  const votingOpen = hasDayVoting(state);
  return state.players
    .filter((player) => player.alive)
    .map((player) => player.id)
    .filter((id) => votingOpen ? Boolean(state.votes?.[id]) : Boolean(state.speechesDone?.[id]));
}

function nextOrderedSpeaker(state, currentSpeaker) {
  return window.MafiaUiFocus?.nextDaySpeaker?.({
    ...state,
    currentSpeaker,
    completeIds: completeSpeechIds(state)
  }) || 0;
}

function resetDayOrder(draft) {
  const firstAlive = draft.players.find((player) => player.alive)?.id || 1;
  draft.dayStartPlayerId = firstAlive;
  draft.dayDirection = "forward";
  draft.timer.currentSpeaker = firstAlive;
}
```

- [ ] **Step 3: Initialize order when speeches start**

Replace both places that start day speeches:

```js
draft.timer.currentSpeaker = nextAliveSpeaker(draft, 0);
```

with:

```js
resetDayOrder(draft);
```

These places are the timer auto-transition from discussion to speeches and the `nextPhase` discussion branch.

- [ ] **Step 4: Update `nextSpeaker` to use selected order**

Replace the body of `nextSpeaker` after the phase guard with:

```js
const currentSpeaker = Number(draft.timer.currentSpeaker);
const aliveIds = draft.players.filter((player) => player.alive).map((player) => player.id);
const isComplete = (id) => hasDayVoting(draft) ? Boolean(draft.votes[id]) : Boolean(draft.speechesDone?.[id]);
if (!aliveIds.length || aliveIds.every(isComplete)) {
  draft.timer.currentSpeaker = 0;
  draft.timer.running = false;
  draft.timer.remainingSeconds = draft.timer.speechSeconds;
  addLog(draft, "все речи завершены");
  return;
}

const currentIsPending = aliveIds.includes(currentSpeaker) && !isComplete(currentSpeaker);
if (!currentIsPending) {
  const nextSpeakerId = nextOrderedSpeaker(draft, currentSpeaker);
  draft.timer.currentSpeaker = nextSpeakerId;
  draft.timer.remainingSeconds = draft.timer.speechSeconds;
  draft.timer.running = false;
  addLog(draft, nextSpeakerId ? `слово у игрока ${nextSpeakerId}` : "все речи завершены");
  return;
}

if (hasDayVoting(draft) && !draft.votes[currentSpeaker]) {
  addLog(draft, `Игрок ${currentSpeaker} должен проголосовать.`);
  return;
}

draft.speechesDone[currentSpeaker] = true;
const nextSpeakerId = nextOrderedSpeaker(draft, currentSpeaker);
draft.timer.currentSpeaker = nextSpeakerId || 0;
draft.timer.remainingSeconds = draft.timer.speechSeconds;
draft.timer.running = false;
addLog(draft, nextSpeakerId ? `слово у игрока ${nextSpeakerId}` : "все речи завершены");
```

- [ ] **Step 5: Add order update handler**

Inside `App`, near `nextSpeaker`, add:

```js
const updateDayOrder = (field, value) => {
  updateState((draft) => {
    if (draft.phase !== "speeches") return;
    if (field === "dayStartPlayerId") {
      const selectedId = Number(value);
      if (!draft.players.some((player) => player.id === selectedId && player.alive)) return;
      draft.dayStartPlayerId = selectedId;
    }
    if (field === "dayDirection") {
      draft.dayDirection = window.MafiaUiFocus?.normalizeDayDirection(value) || "forward";
    }
    const completeIds = new Set(completeSpeechIds(draft));
    if (!draft.timer.currentSpeaker || completeIds.has(Number(draft.timer.currentSpeaker))) {
      draft.timer.currentSpeaker = nextOrderedSpeaker(draft, Number(draft.timer.currentSpeaker));
    }
    draft.timer.running = false;
    draft.timer.remainingSeconds = draft.timer.speechSeconds;
  });
};
```

- [ ] **Step 6: Pass handler to `DayFlowCard`**

Update the render call:

```js
state.phase === "speeches" && h(DayFlowCard, { state, aliveOptions, castVote, updateFoulVote, setShootoutNumber, setShootoutPlayer, recordShootoutGuess, nextSpeaker, updateDayOrder }),
```

Update the component signature:

```js
function DayFlowCard({ state, aliveOptions, castVote, updateFoulVote, setShootoutNumber, setShootoutPlayer, recordShootoutGuess, nextSpeaker, updateDayOrder }) {
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit flow wiring**

```bash
git add src/app.js
git commit -m "Wire day speech order into game flow"
```

## Task 3: Day Order Controls UI

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Add UI values in `DayFlowCard`**

Near the other `DayFlowCard` derived values, add:

```js
const speakerOrder = window.MafiaUiFocus?.daySpeakerOrder?.(state) || alivePlayers.map((player) => player.id);
const orderPreview = speakerOrder.map((id) => `#${id}`).join(" -> ");
```

- [ ] **Step 2: Render controls above the current speaker card**

Insert this block after the `day-flow-head` block and before `current-speaker-card`:

```js
h(
  "div",
  { className: "day-order-controls" },
  h(
    "label",
    null,
    h("span", null, "Открывает стол"),
    h(
      "select",
      {
        value: state.players.some((player) => player.id === Number(state.dayStartPlayerId) && player.alive) ? state.dayStartPlayerId : (alivePlayers[0]?.id || ""),
        onChange: (event) => updateDayOrder("dayStartPlayerId", event.target.value),
        "data-testid": "day-start-player"
      },
      alivePlayers.map((player) => h("option", { key: player.id, value: player.id }, `Игрок ${player.id}`))
    )
  ),
  h(
    "label",
    null,
    h("span", null, "Направление"),
    h(
      "select",
      {
        value: state.dayDirection === "backward" ? "backward" : "forward",
        onChange: (event) => updateDayOrder("dayDirection", event.target.value),
        "data-testid": "day-direction"
      },
      h("option", { value: "forward" }, "Вперед"),
      h("option", { value: "backward" }, "Назад")
    )
  ),
  h("div", { className: "day-order-preview" }, h("span", null, "Очередь"), h("strong", null, orderPreview || "-"))
),
```

- [ ] **Step 3: Add order styling**

Add to `src/styles.css` near the `.current-speaker-card` rules:

```css
.day-order-controls {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) minmax(140px, 0.8fr) minmax(180px, 1.4fr);
  gap: 10px;
  align-items: end;
  margin: 12px 0;
}

.day-order-controls label,
.day-order-preview {
  display: grid;
  gap: 5px;
}

.day-order-controls span,
.day-order-preview span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.day-order-controls select {
  width: 100%;
}

.day-order-preview {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #f8fafc;
}

.day-order-preview strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Inside the existing mobile media query, add:

```css
.day-order-controls {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit UI controls**

```bash
git add src/app.js src/styles.css
git commit -m "Add day order controls"
```

## Task 4: Final Verification

**Files:**
- Verify: `src/app.js`
- Verify: `src/ui-focus.js`
- Verify: `src/styles.css`
- Verify: `tests/ui-focus.test.mjs`

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Start local server**

Run:

```bash
npm start
```

Expected: server listens on `http://localhost:4174`.

- [ ] **Step 3: Browser smoke test**

Open `http://localhost:4174`. Start or load a game into day speeches and confirm:

- "Открывает стол" select appears;
- "Направление" select appears;
- queue preview changes when either select changes;
- current speaker follows the queue;
- on voting days, the next button stays blocked until the current speaker votes.

- [ ] **Step 4: Final status**

Run:

```bash
git status --short
```

Expected: only intentional changes remain, or a clean tree if all task commits were made.
