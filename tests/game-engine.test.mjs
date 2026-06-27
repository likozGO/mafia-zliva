import test from "node:test";
import assert from "node:assert/strict";

await import("../src/ui-focus.js");

globalThis.window = globalThis;
globalThis.document = {
  getElementById() {
    return {};
  }
};
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {}
};
globalThis.React = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children };
  },
  useEffect() {},
  useMemo(factory) {
    return factory();
  },
  useState(initialValue) {
    const value = typeof initialValue === "function" ? initialValue() : initialValue;
    return [value, () => {}];
  }
};
globalThis.ReactDOM = {
  createRoot() {
    return { render() {} };
  }
};

await import("../src/app.js");

const engine = globalThis.MafiaGameEngine;

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function choose(random, values) {
  return values[Math.floor(random() * values.length)];
}

function kill(state, playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (player) {
    player.alive = false;
    player.deathReason = "simulation";
  }
}

test("makeBlankState normalizes role assignments for supported player counts", () => {
  for (let playerCount = 6; playerCount <= 24; playerCount += 1) {
    const state = engine.makeBlankState(playerCount);
    const issues = engine.validateRoles(state.roles, playerCount);
    const assignedPlayers = Object.values(state.roles).flat();

    assert.equal(state.playerCount, playerCount);
    assert.equal(state.players.length, playerCount);
    assert.deepEqual(issues, []);
    assert.equal(new Set(assignedPlayers).size, assignedPlayers.length);
    assert.equal(engine.availableActions(playerCount).length, engine.activeRoleDefs(playerCount).length);
  }
});

test("player counts are clamped to the supported table size", () => {
  assert.equal(engine.clampPlayerCount(1), 6);
  assert.equal(engine.clampPlayerCount(30), 24);
  assert.equal(engine.clampPlayerCount("18"), 18);
  assert.equal(engine.clampPlayerCount("not a number"), 20);
});

test("detectWinner covers mafia, civilians, maniac, and unfinished games", () => {
  const mafiaState = engine.makeBlankState(6);
  [1, 2, 4].forEach((id) => kill(mafiaState, id));
  assert.equal(engine.detectWinner(mafiaState), "Мафия");

  const civilianState = engine.makeBlankState(6);
  [3, 5, 6].forEach((id) => kill(civilianState, id));
  assert.equal(engine.detectWinner({ ...civilianState, roles: { ...civilianState.roles, don: [], mafia: [], maniac: [] } }), "Мирные");

  const maniacState = engine.makeBlankState(6);
  [1, 2, 3, 4, 5].forEach((id) => kill(maniacState, id));
  assert.equal(engine.detectWinner({ ...maniacState, roles: { ...maniacState.roles, don: [], mafia: [] } }), "Маньяк");

  assert.equal(engine.detectWinner(engine.makeBlankState(10)), null);
});

test("thirty deterministic elimination simulations end with a valid winner", () => {
  const winners = new Set(["Мафия", "Мирные", "Маньяк"]);

  for (let gameNumber = 1; gameNumber <= 30; gameNumber += 1) {
    const playerCount = 6 + (gameNumber % 19);
    const state = engine.makeBlankState(playerCount);
    const random = seededRandom(gameNumber * 97);

    for (let turn = 0; turn < playerCount * 2 && !engine.detectWinner(state); turn += 1) {
      const aliveIds = state.players.filter((player) => player.alive).map((player) => player.id);
      kill(state, choose(random, aliveIds));
    }

    const winner = engine.detectWinner(state);
    assert.ok(winners.has(winner), `game ${gameNumber} with ${playerCount} players ended with ${winner}`);
  }
});
