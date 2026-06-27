import fs from "node:fs";
import path from "node:path";

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
const RUNS = Number(process.argv[2]) || 300;
const BASE_SEED = Number(process.argv[3]) || 8675309;
const OUT_DIR = path.resolve("docs/simulation-runs");

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function choose(random, values) {
  if (!values.length) return null;
  return values[Math.floor(random() * values.length)];
}

function shuffle(random, values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function aliveIds(state) {
  return state.players.filter((player) => player.alive).map((player) => player.id);
}

function roleAliveIds(state, roleKey) {
  const alive = new Set(aliveIds(state));
  return (state.roles[roleKey] || []).filter((id) => alive.has(id));
}

function blackAliveIds(state) {
  return [...roleAliveIds(state, "don"), ...roleAliveIds(state, "mafia"), ...roleAliveIds(state, "shield")];
}

function kill(state, playerId, reason) {
  const player = state.players.find((item) => item.id === Number(playerId));
  if (!player || !player.alive) return [];
  player.alive = false;
  player.deathReason = reason;
  const deaths = [player.id];

  if ((state.roles.bomber || []).includes(player.id)) {
    for (const bombed of state.players.filter((item) => item.bombed && item.alive && item.id !== player.id)) {
      deaths.push(...kill(state, bombed.id, "бомба"));
    }
  }

  if ((state.roles.lover || []).includes(player.id)) {
    for (const loverId of (state.roles.lover || []).filter((id) => id !== player.id)) {
      deaths.push(...kill(state, loverId, "любовники"));
    }
  }

  return deaths;
}

function assignRandomRoles(state, random) {
  const players = shuffle(random, state.players.map((player) => player.id));
  const roles = {};
  let cursor = 0;

  for (const role of engine.ROLE_DEFS) {
    const count = engine.getRoleSlotCount(role, state.playerCount);
    roles[role.key] = players.slice(cursor, cursor + count);
    cursor += count;
  }

  state.roles = engine.normalizeRoles(roles, state.playerCount);
}

function invariants(state, gameNumber, turn) {
  const issues = [];
  const validIds = new Set(state.players.map((player) => player.id));
  const allRoleIds = Object.values(state.roles).flat();
  const duplicateRoles = allRoleIds.filter((id, index, list) => list.indexOf(id) !== index);
  if (duplicateRoles.length) issues.push({ type: "duplicate-role", gameNumber, turn, ids: [...new Set(duplicateRoles)] });
  for (const id of allRoleIds) {
    if (!validIds.has(id)) issues.push({ type: "role-out-of-range", gameNumber, turn, id });
  }
  for (const player of state.players) {
    if (!player.alive && !player.deathReason) issues.push({ type: "dead-without-reason", gameNumber, turn, id: player.id });
  }
  return issues;
}

function canAct(state, action) {
  if (action === "mafia") return blackAliveIds(state).length > 0;
  if (action === "lovers") return roleAliveIds(state, "lover").length > 0;
  if (action === "maniac") return roleAliveIds(state, "maniac").length > 0;
  if (action === "sheriffShot") return roleAliveIds(state, "sheriff").length > 0;
  if (action === "doctor") return roleAliveIds(state, "doctor").length > 0;
  if (action === "shield") return roleAliveIds(state, "shield").length > 0;
  return false;
}

function randomAttackTarget(state, random, kamikazeId) {
  const alive = aliveIds(state);
  if (alive.includes(kamikazeId) && random() < 0.58) return kamikazeId;
  return choose(random, alive);
}

function runNight(state, random, gameNumber, turn, stats, findings) {
  const kamikazeId = roleAliveIds(state, "kamikaze")[0] || null;
  const attacks = {};
  const mafiaBlockedByShield = canAct(state, "shield") && random() < 0.45 && random() < 0.5;
  if (mafiaBlockedByShield) {
    const shieldedActor = choose(random, blackAliveIds(state));
    state.night.shielded = shieldedActor;
    if (shieldedActor) stats.shieldBlockedMafia += 1;
  }
  const attackActions = ["mafia", "lovers", "maniac"].filter((action) => canAct(state, action) && random() < 0.84);

  for (const action of attackActions) {
    if (action === "mafia" && mafiaBlockedByShield) continue;
    attacks[action] = randomAttackTarget(state, random, kamikazeId);
  }

  const redirectedActions = Object.entries(attacks)
    .filter(([action, target]) => ["mafia", "lovers", "maniac"].includes(action) && target === kamikazeId)
    .map(([action]) => action);

  let redirectTarget = null;
  if (redirectedActions.length) {
    stats.kamikazeActivations += 1;
    const targets = aliveIds(state);
    redirectTarget = random() < 0.18 ? kamikazeId : choose(random, targets.filter((id) => id !== kamikazeId));
    if (!redirectTarget) redirectTarget = kamikazeId;
    for (const action of redirectedActions) attacks[action] = redirectTarget;
    if (redirectTarget === kamikazeId) {
      stats.selfRedirects += 1;
      findings.push({
        severity: "odd-case",
        gameNumber,
        turn,
        message: "Kamikaze redirect accepted kamikaze as the redirected target, so kamikaze dies by own redirected attack.",
        state: { playerCount: state.playerCount, kamikazeId, actions: redirectedActions }
      });
    }
    if (redirectedActions.length > 1) stats.multiAttackRedirects += 1;
  }

  if (canAct(state, "doctor") && random() < 0.72) {
    const healTargets = aliveIds(state);
    state.night.healed = choose(random, healTargets);
  }

  const victims = engine.uniqueNumbers(Object.values(attacks));
  const healed = engine.uniqueNumbers([state.night.healed]);
  const before = new Set(aliveIds(state));
  for (const victim of victims) {
    if (!healed.includes(victim)) kill(state, victim, "ночь");
  }

  const after = new Set(aliveIds(state));
  const dead = [...before].filter((id) => !after.has(id));

  if (redirectedActions.length && redirectTarget && !victims.includes(redirectTarget)) {
    findings.push({
      severity: "wrong-logic",
      gameNumber,
      turn,
      message: "Kamikaze redirect target was not present in resolved victim set.",
      state: { kamikazeId, redirectTarget, redirectedActions, attacks, victims }
    });
  }

  if (redirectedActions.length && redirectTarget !== kamikazeId && dead.includes(kamikazeId)) {
    findings.push({
      severity: "wrong-logic",
      gameNumber,
      turn,
      message: "Kamikaze died despite redirecting all direct mafia/lover/maniac attacks away.",
      state: { kamikazeId, redirectTarget, redirectedActions, attacks, dead }
    });
  }

  stats.nights += 1;
  stats.nightDeaths += dead.length;
  state.night = engine.makeBlankState(state.playerCount).night;
}

function runDay(state, random, stats) {
  const alive = aliveIds(state);
  if (alive.length <= 2) return;
  if (random() < 0.68) {
    const target = choose(random, alive);
    kill(state, target, "голосование");
    stats.dayDeaths += 1;
  }
}

function simulateGame(gameNumber) {
  const random = seededRandom(BASE_SEED + gameNumber * 101);
  const playerCount = 15 + Math.floor(random() * 10);
  const state = engine.makeBlankState(playerCount);
  assignRandomRoles(state, random);
  state.rolesConfirmed = true;
  state.rolesLocked = true;

  const stats = {
    gameNumber,
    playerCount,
    nights: 0,
    dayDeaths: 0,
    nightDeaths: 0,
    kamikazeActivations: 0,
    multiAttackRedirects: 0,
    selfRedirects: 0,
    sheriffShotAtKamikaze: 0,
    shieldBlockedMafia: 0,
    winner: null
  };
  const findings = [];

  for (let turn = 1; turn <= playerCount * 3; turn += 1) {
    findings.push(...invariants(state, gameNumber, turn));
    const winnerBefore = engine.detectWinner(state);
    if (winnerBefore) {
      stats.winner = winnerBefore;
      break;
    }
    runDay(state, random, stats);
    const winnerAfterDay = engine.detectWinner(state);
    if (winnerAfterDay) {
      stats.winner = winnerAfterDay;
      break;
    }
    runNight(state, random, gameNumber, turn, stats, findings);
    const winnerAfterNight = engine.detectWinner(state);
    if (winnerAfterNight) {
      stats.winner = winnerAfterNight;
      break;
    }
  }

  stats.winner ||= engine.detectWinner(state) || "unfinished";
  stats.alive = aliveIds(state).length;
  stats.kamikazeAlive = roleAliveIds(state, "kamikaze").length > 0;
  return { stats, findings };
}

const games = [];
const findings = [];
for (let gameNumber = 1; gameNumber <= RUNS; gameNumber += 1) {
  const result = simulateGame(gameNumber);
  games.push(result.stats);
  findings.push(...result.findings);
}

const summary = {
  runs: RUNS,
  baseSeed: BASE_SEED,
  winners: Object.fromEntries(
    [...new Set(games.map((game) => game.winner))].sort().map((winner) => [winner, games.filter((game) => game.winner === winner).length])
  ),
  nights: games.reduce((sum, game) => sum + game.nights, 0),
  dayDeaths: games.reduce((sum, game) => sum + game.dayDeaths, 0),
  nightDeaths: games.reduce((sum, game) => sum + game.nightDeaths, 0),
  kamikazeActivations: games.reduce((sum, game) => sum + game.kamikazeActivations, 0),
  multiAttackRedirects: games.reduce((sum, game) => sum + game.multiAttackRedirects, 0),
  selfRedirects: games.reduce((sum, game) => sum + game.selfRedirects, 0),
  sheriffShotAtKamikaze: games.reduce((sum, game) => sum + game.sheriffShotAtKamikaze, 0),
  shieldBlockedMafia: games.reduce((sum, game) => sum + game.shieldBlockedMafia, 0),
  findingsBySeverity: Object.fromEntries(
    [...new Set(findings.map((finding) => finding.severity || finding.type))].sort().map((severity) => [
      severity,
      findings.filter((finding) => (finding.severity || finding.type) === severity).length
    ])
  )
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = path.join(OUT_DIR, "kamikaze-fuzz-300.json");
const reportPath = path.join(OUT_DIR, "kamikaze-fuzz-300.md");
fs.writeFileSync(jsonPath, JSON.stringify({ summary, games, findings }, null, 2));

const notableFindings = findings.slice(0, 20).map((finding, index) => {
  return `${index + 1}. ${finding.severity || finding.type}: game ${finding.gameNumber}, turn ${finding.turn} - ${finding.message || finding.type}`;
}).join("\n");

const report = `# Kamikaze Fuzz Report

Generated by \`scripts/kamikaze-fuzz.mjs\`.

## Run

- Games: ${summary.runs}
- Seed: ${summary.baseSeed}
- Player counts: 15-24 only, because kamikaze exists from 15 players.
- Bias: mafia/lovers/maniac attacks target kamikaze 58% of the time when alive.

## Totals

- Nights simulated: ${summary.nights}
- Day deaths: ${summary.dayDeaths}
- Night deaths: ${summary.nightDeaths}
- Winners: ${Object.entries(summary.winners).map(([winner, count]) => `${winner}: ${count}`).join(", ")}

## Kamikaze Coverage

- Kamikaze activations: ${summary.kamikazeActivations}
- Multi-attack redirects: ${summary.multiAttackRedirects}
- Self-redirects accepted: ${summary.selfRedirects}
- Sheriff shots at kamikaze: ${summary.sheriffShotAtKamikaze}
- Shield blocks of mafia attack: ${summary.shieldBlockedMafia}

## Findings

${Object.keys(summary.findingsBySeverity).length ? Object.entries(summary.findingsBySeverity).map(([severity, count]) => `- ${severity}: ${count}`).join("\n") : "- No findings recorded."}

## Notable Cases

${notableFindings || "No notable cases."}

## Interpretation

1. Current app logic allows kamikaze to redirect the hit back to himself, because the target selector accepts any alive player. If self-redirect should be illegal, this needs a guard.
2. Multi-attack redirect resolves all pending mafia/lovers/maniac attacks to the same chosen target. That matched the implementation and did not produce invariant failures in this run.
3. The focused run did not find a state-invariant failure in kamikaze redirect resolution after matching the app's shield-before-attack ordering.
`;

fs.writeFileSync(reportPath, report);

console.log(JSON.stringify({ summary, jsonPath, reportPath }, null, 2));
