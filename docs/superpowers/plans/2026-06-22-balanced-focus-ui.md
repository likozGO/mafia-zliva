# Balanced Focus UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Mafia host UI so the current required action is dominant while compact audit context remains visible.

**Architecture:** Add a small browser-compatible helper module for phase focus summaries, cover it with Node built-in tests, then use those helpers from the existing single-file React app. Keep game rules and state transitions intact; change layout and disclosure only.

**Tech Stack:** Browser React globals, plain JavaScript, Node built-in `node:test`, existing CSS.

**User Constraint:** Do not commit or push. Leave all changes local.

---

## File Structure

- Modify `package.json`: add a `test` script using Node's built-in test runner.
- Create `src/ui-focus.js`: browser-compatible helper module exposed as `globalThis.MafiaUiFocus`.
- Create `tests/ui-focus.test.mjs`: unit tests for focus/progress/latest-event helpers.
- Modify `index.html`: load `src/ui-focus.js` before `src/app.js`.
- Modify `src/app.js`: add primary focus surface, compact audit surface, and disclosure state.
- Modify `src/styles.css`: add balanced focus layout, compact audit chips, drawers, and responsive behavior.

## Task 1: Add Focus Helper Tests

**Files:**
- Modify: `package.json`
- Create: `tests/ui-focus.test.mjs`

- [ ] **Step 1: Add test script and failing tests**

Add this script:

```json
"test": "node --test"
```

Create `tests/ui-focus.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

await import("../src/ui-focus.js");

const { latestLogEntry, phaseProgress, primaryFocus } = globalThis.MafiaUiFocus;

test("latestLogEntry extracts the newest log text after the phase prefix", () => {
  assert.equal(latestLogEntry({ log: ["Ночь 2: Мафия: игрок 7"] }), "Мафия: игрок 7");
});

test("phaseProgress summarizes night checklist completion", () => {
  const summary = phaseProgress({
    phase: "night",
    nightChecklist: [
      ["mafia", "Выстрел мафии", true],
      ["doctor", "Врач", false],
      ["lawyer", "Адвокат", true]
    ]
  });

  assert.deepEqual(summary, {
    label: "Ночь",
    value: "2 / 3",
    tone: "pending",
    detail: "Осталось: Врач"
  });
});

test("primaryFocus names the current night action", () => {
  const focus = primaryFocus({
    phase: "night",
    activeActionName: "Выстрел мафии",
    targetId: 7,
    canApply: true
  });

  assert.equal(focus.eyebrow, "Ночное действие");
  assert.equal(focus.title, "Выстрел мафии");
  assert.equal(focus.detail, "Цель: игрок 7");
  assert.equal(focus.actionLabel, "Применить");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test
```

Expected: FAIL because `src/ui-focus.js` does not exist or `globalThis.MafiaUiFocus` is undefined.

## Task 2: Implement Focus Helpers

**Files:**
- Create: `src/ui-focus.js`

- [ ] **Step 1: Add minimal helper implementation**

Create a browser-compatible module:

```js
(function attachMafiaUiFocus(root) {
  function latestLogEntry(state) {
    const entry = String(state?.log?.[0] || "");
    const parts = entry.split(": ");
    return parts.length > 1 ? parts.slice(1).join(": ") : entry;
  }

  function phaseProgress(context) {
    if (context?.phase === "night") {
      const checklist = context.nightChecklist || [];
      const done = checklist.filter(([, , complete]) => complete).length;
      const pending = checklist.filter(([, , complete]) => !complete).map(([, label]) => label);
      return {
        label: "Ночь",
        value: `${done} / ${checklist.length}`,
        tone: pending.length ? "pending" : "done",
        detail: pending.length ? `Осталось: ${pending.join(", ")}` : "Все действия завершены"
      };
    }

    return { label: "Прогресс", value: "", tone: "idle", detail: "" };
  }

  function primaryFocus(context) {
    if (context?.phase === "night") {
      return {
        eyebrow: "Ночное действие",
        title: context.activeActionName || "Ход",
        detail: context.targetId ? `Цель: игрок ${context.targetId}` : "Выберите цель",
        actionLabel: context.canApply ? "Применить" : "Недоступно"
      };
    }

    return {
      eyebrow: "Текущая фаза",
      title: context?.phaseName || "",
      detail: context?.blockReason || "",
      actionLabel: context?.blockReason ? "Заблокировано" : "Следующая фаза"
    };
  }

  root.MafiaUiFocus = { latestLogEntry, phaseProgress, primaryFocus };
})(globalThis);
```

- [ ] **Step 2: Run tests to verify GREEN**

Run:

```bash
npm test
```

Expected: PASS for all `ui-focus` tests.

## Task 3: Wire Balanced Focus UI

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Load helper before app**

Add before `src/app.js`:

```html
<script src="./src/ui-focus.js?v=20260622-balanced-focus"></script>
```

- [ ] **Step 2: Add disclosure state and focus props**

In `App`, add:

```js
const [openDrawer, setOpenDrawer] = useState(null);
```

Pass `blockReason`, `openDrawer`, `setOpenDrawer`, and existing phase action callbacks into `MainColumn`.

- [ ] **Step 3: Promote the primary focus surface**

Create a `FocusPanel` component in `src/app.js` that renders:

- phase eyebrow/title/detail;
- compact progress chip;
- latest event chip;
- phase-specific primary controls using existing callbacks;
- drawer buttons for roles, journal, marks, and details.

Use existing logic for timers, current speaker, votes, night actions, result cards, and blockers. Do not change rule functions.

- [ ] **Step 4: Collapse secondary blocks**

Move these behind drawer/expandable surfaces:

- full `LogBox`;
- role strip details after intro night;
- manual mark controls when no mark is active;
- full night checklist when compact progress is enough;
- full speech/vote table when current speaker flow is enough.

Keep required blockers visible when they prevent phase transition.

- [ ] **Step 5: Update CSS**

Add styles for:

- `.focus-shell`;
- `.focus-primary`;
- `.audit-strip`;
- `.audit-chip`;
- `.drawer-grid`;
- `.collapsible-panel`;
- responsive one-column layout under mobile widths.

Ensure text fits within controls and the board keeps stable grid dimensions.

## Task 4: Verification

**Files:**
- No new files unless a failing verification reveals a bug.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run local app**

Run:

```bash
npm start
```

Expected: local HTTP server starts on port 4174.

- [ ] **Step 3: Browser verification**

Open:

```text
http://127.0.0.1:4174/
```

Verify:

- role confirmation still blocks intro-night transition;
- discussion and speech timer controls remain usable;
- current speaker and vote capture remain usable;
- night action apply/clear and checklist progress remain usable;
- required blockers remain visible when sections are collapsed;
- desktop and mobile layouts have no overlapping controls or unreadable text.
