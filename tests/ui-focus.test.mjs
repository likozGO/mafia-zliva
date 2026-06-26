import test from "node:test";
import assert from "node:assert/strict";

await import("../src/ui-focus.js");

const {
  daySpeakerOrder,
  finalSpeechRequiredDeathIds,
  filterInitialImmunityTargets,
  initialImmunityActiveIds,
  latestLogEntry,
  nightActionLedger,
  nextDaySpeaker,
  normalizeDayDirection,
  phaseProgress,
  primaryFocus,
  rowFlashClass,
  shouldExpireInitialImmunity,
  toggleInitialImmunitySelection,
  toggleDrawerSet,
  voteAudit
} = globalThis.MafiaUiFocus;

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

test("phaseProgress names shield-blocked actions while counting them complete", () => {
  const summary = phaseProgress({
    phase: "night",
    nightChecklist: [
      ["mafia", "Выстрел мафии", true],
      ["doctor", "Врач", true],
      ["lawyer", "Адвокат", false]
    ],
    blockedActions: { doctor: 9 }
  });

  assert.deepEqual(summary, {
    label: "Ночь",
    value: "2 / 3",
    tone: "pending",
    detail: "Осталось: Адвокат; заблокировано: Врач"
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

test("primaryFocus keeps next missing night action visible when another action is selected", () => {
  const focus = primaryFocus({
    phase: "night",
    activeActionName: "Адвокат",
    targetId: 7,
    canApply: true,
    nextMissingName: "Врач"
  });

  assert.equal(focus.detail, "Цель: игрок 7");
  assert.equal(focus.nextMissing, "Next missing: Врач");
});

test("nightActionLedger returns one row per action with actor, target, result, and blocked state", () => {
  const rows = nightActionLedger({
    actions: [
      ["doctor", "Врач", true],
      ["don", "Дон", true],
      ["lawyer", "Адвокат", false]
    ],
    actors: { doctor: [9], don: [3], lawyer: [8] },
    targets: { doctor: [4], don: 4 },
    results: { don: "не шериф" },
    blockedActions: { doctor: 9 }
  });

  assert.deepEqual(rows, [
    { key: "doctor", label: "Врач", state: "blocked", actor: "#9", target: "#4", result: "Заблокировано щитом #9" },
    { key: "don", label: "Дон", state: "done", actor: "#3", target: "#4", result: "не шериф" },
    { key: "lawyer", label: "Адвокат", state: "pending", actor: "#8", target: "-", result: "Ожидает" }
  ]);
});

test("voteAudit shows voter choice and target received totals", () => {
  assert.deepEqual(voteAudit({ playerId: 6, votes: { 6: 12, 7: 12 }, receivedVotes: 2, foulVotes: 1 }), {
    choice: "#6 -> #12",
    received: "Получил: 2",
    fouls: "Фолы: 1",
    total: "Итого: 3"
  });
});

test("finalSpeechRequiredDeathIds requires night last words until marked done", () => {
  assert.deepEqual(finalSpeechRequiredDeathIds({
    deaths: [
      { id: 3, finalSpeech: false },
      { id: 4, finalSpeech: false },
      { id: 6, finalSpeech: true }
    ],
    lastWordsDone: { 6: false }
  }), [6]);

  assert.deepEqual(finalSpeechRequiredDeathIds({
    deaths: [
      { id: 6, finalSpeech: true }
    ],
    lastWordsDone: { 6: true }
  }), []);
});

test("toggleDrawerSet toggles one drawer without closing the others", () => {
  assert.deepEqual(toggleDrawerSet(["roles"], "marks"), ["roles", "marks"]);
  assert.deepEqual(toggleDrawerSet(["roles", "marks", "details"], "marks"), ["roles", "details"]);
  assert.deepEqual(toggleDrawerSet(null, "log"), ["log"]);
});

test("rowFlashClass marks only the recently changed row", () => {
  assert.equal(rowFlashClass("doctor", "doctor"), "flash");
  assert.equal(rowFlashClass("doctor", "mafia"), "");
  assert.equal(rowFlashClass("doctor", null), "");
});

test("initialImmunityActiveIds keeps start immunity until the first voting day ends", () => {
  const base = { startImmunityIds: [2, 4], startImmunityExpired: false };
  assert.deepEqual(initialImmunityActiveIds({ ...base, phase: "night", nightNumber: 2 }), [2, 4]);
  assert.deepEqual(initialImmunityActiveIds({ ...base, phase: "speeches", dayNumber: 2 }), [2, 4]);
  assert.deepEqual(initialImmunityActiveIds({ ...base, phase: "night", nightNumber: 3 }), []);
  assert.deepEqual(initialImmunityActiveIds({ ...base, startImmunityExpired: true, phase: "speeches", dayNumber: 2 }), []);
});

test("filterInitialImmunityTargets blocks first-night attacks but allows checks and healing", () => {
  const options = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const context = { phase: "night", nightNumber: 2, startImmunityIds: [2], startImmunityExpired: false };

  assert.deepEqual(filterInitialImmunityTargets(options, { ...context, actionKey: "mafia" }).map((option) => option.id), [1, 3]);
  assert.deepEqual(filterInitialImmunityTargets(options, { ...context, actionKey: "maniac" }).map((option) => option.id), [1, 3]);
  assert.deepEqual(filterInitialImmunityTargets(options, { ...context, actionKey: "sheriff", sheriffActionMode: "shoot" }).map((option) => option.id), [1, 3]);
  assert.deepEqual(filterInitialImmunityTargets(options, { ...context, actionKey: "sheriff", sheriffActionMode: "check" }).map((option) => option.id), [1, 2, 3]);
  assert.deepEqual(filterInitialImmunityTargets(options, { ...context, actionKey: "doctor" }).map((option) => option.id), [1, 2, 3]);
});

test("filterInitialImmunityTargets blocks first voting day targets and shouldExpireInitialImmunity marks its end", () => {
  const options = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const context = { phase: "speeches", dayNumber: 2, startImmunityIds: [2], startImmunityExpired: false };

  assert.deepEqual(filterInitialImmunityTargets(options, { ...context, mode: "vote" }).map((option) => option.id), [1, 3]);
  assert.equal(shouldExpireInitialImmunity({ ...context, phase: "voteResults", dayNumber: 2 }), true);
  assert.equal(shouldExpireInitialImmunity({ ...context, phase: "voteResults", dayNumber: 1 }), false);
});

test("toggleInitialImmunitySelection toggles player icons while keeping the five-player limit", () => {
  assert.deepEqual(toggleInitialImmunitySelection([2, 4], 4, 6), [2]);
  assert.deepEqual(toggleInitialImmunitySelection([2, 4], 5, 6), [2, 4, 5]);
  assert.deepEqual(toggleInitialImmunitySelection([1, 2, 3, 4, 5], 6, 6), [1, 2, 3, 4, 5]);
  assert.deepEqual(toggleInitialImmunitySelection([1, 2, 3, 4, 5], 3, 6), [1, 2, 4, 5]);
  assert.deepEqual(toggleInitialImmunitySelection([1, 2, 30], 6, 6), [1, 2, 6]);
});

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
