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
const GAMES_PER_ROLE = Number(process.argv[2]) || 100;
const BASE_SEED = Number(process.argv[3]) || 20260627;
const OUT_DIR = path.resolve("docs/simulation-runs");
const REPORT_PATH = path.join(OUT_DIR, "all-roles-100-each.md");
const JSON_PATH = path.join(OUT_DIR, "all-roles-100-each.json");

const ROLE_ACTIONS = {
  don: "don",
  mafia: "mafia",
  shield: "shield",
  sheriff: "sheriff",
  maniac: "maniac",
  lawyer: "lawyer",
  doctor: "doctor",
  lover: "lovers",
  bomber: "bomb",
  kamikaze: "kamikaze"
};

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function intBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
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

function sample(random, values, count) {
  return shuffle(random, values).slice(0, count);
}

function aliveIds(state) {
  return state.players.filter((player) => player.alive).map((player) => player.id);
}

function aliveRoleIds(state, roleKey) {
  const alive = new Set(aliveIds(state));
  return (state.roles[roleKey] || []).filter((id) => alive.has(id));
}

function blackIds(state) {
  return [...(state.roles.don || []), ...(state.roles.mafia || []), ...(state.roles.shield || [])];
}

function aliveBlackIds(state) {
  const alive = new Set(aliveIds(state));
  return blackIds(state).filter((id) => alive.has(id));
}

function roleNamesForPlayer(state, playerId) {
  const names = engine.activeRoleDefs(state.playerCount)
    .filter((role) => state.roles[role.key]?.includes(Number(playerId)))
    .map((role) => role.key);
  return names.length ? names : ["civilian"];
}

function assignRandomRoles(state, random) {
  const available = shuffle(random, state.players.map((player) => player.id));
  const roles = Object.fromEntries(engine.ROLE_DEFS.map((role) => [role.key, []]));
  let cursor = 0;
  for (const role of engine.activeRoleDefs(state.playerCount)) {
    const count = engine.getRoleSlotCount(role, state.playerCount);
    roles[role.key] = available.slice(cursor, cursor + count);
    cursor += count;
  }
  state.roles = engine.normalizeRoles(roles, state.playerCount);
}

function canAct(state, actionKey) {
  if (actionKey === "mafia") return aliveRoleIds(state, "don").length > 0 || aliveRoleIds(state, "mafia").length > 0;
  if (actionKey === "lovers") return aliveRoleIds(state, "lover").length > 0;
  if (actionKey === "bomb") return aliveRoleIds(state, "bomber").length > 0 && (state.nightNumber === 2 || state.nightNumber === 3);
  if (actionKey === "kamikaze") return Boolean(state.night.kamikazeRedirect?.kamikaze && !state.night.kamikazeRedirect.target);
  return aliveRoleIds(state, engine.actionRoleKey(actionKey)).length > 0;
}

function actionActorIds(state, actionKey) {
  return engine.actionActorIds(state, actionKey).filter((id) => state.players.some((player) => player.id === id && player.alive));
}

function isActionBlocked(state, actionKey) {
  const shieldedId = Number(state.night.shielded);
  return Boolean(shieldedId && actionActorIds(state, actionKey).includes(shieldedId));
}

function observe(result, type, message, details = {}) {
  result.observations.push({ type, message, details });
}

function finding(result, severity, type, message, details = {}) {
  result.findings.push({ severity, type, message, details });
}

function addFocusAction(result, actionKey) {
  if (ROLE_ACTIONS[result.focusRole] !== actionKey) return;
  result.focusActions[actionKey] = (result.focusActions[actionKey] || 0) + 1;
}

function kill(state, playerId, reason, result, source = {}) {
  const player = state.players.find((item) => item.id === Number(playerId));
  if (!player || !player.alive) return [];
  player.alive = false;
  player.deathReason = reason;
  const death = { id: player.id, reason, roles: roleNamesForPlayer(state, player.id), source };
  result.deaths.push(death);
  const deaths = [death];

  if ((state.roles.bomber || []).includes(player.id)) {
    const bombedTargets = state.players.filter((item) => item.bombed && item.alive && item.id !== player.id);
    if (bombedTargets.length) observe(result, "bomber-chain", "Bomber death killed bombed players.", { bomber: player.id, targets: bombedTargets.map((item) => item.id) });
    for (const bombed of bombedTargets) {
      deaths.push(...kill(state, bombed.id, "бомба", result, { trigger: player.id }));
    }
  }

  if ((state.roles.lover || []).includes(player.id)) {
    for (const loverId of (state.roles.lover || []).filter((id) => id !== player.id)) {
      const lover = state.players.find((item) => item.id === loverId);
      if (lover?.alive) {
        observe(result, "lover-chain", "Lover death killed the paired lover.", { first: player.id, paired: loverId });
        deaths.push(...kill(state, loverId, "любовники", result, { trigger: player.id }));
      }
    }
  }

  if ((state.roles.don || []).includes(player.id)) {
    const foundSheriffs = engine.uniqueNumbers(state.donSheriffFound || [])
      .filter((id) => (state.roles.sheriff || []).includes(id))
      .filter((id) => state.players.some((item) => item.id === id && item.alive));
    if (foundSheriffs.length) observe(result, "don-revenge", "Dead Don took previously found sheriff.", { don: player.id, sheriffs: foundSheriffs });
    for (const sheriffId of foundSheriffs) {
      deaths.push(...kill(state, sheriffId, "дон", result, { trigger: player.id }));
    }
  }

  return deaths;
}

function validateState(state, result, stage) {
  const issues = engine.validateRoles(state.roles, state.playerCount);
  if (issues.length) finding(result, "high", "invalid-roles", "Role validation failed.", { stage, issues });

  const ids = state.players.map((player) => player.id);
  if (ids.length !== state.playerCount || new Set(ids).size !== ids.length) {
    finding(result, "high", "invalid-player-list", "Player ids no longer match playerCount.", { stage, ids });
  }

  for (const player of state.players) {
    if (!player.alive && !player.deathReason) {
      finding(result, "high", "dead-without-reason", "Dead player has no death reason.", { stage, playerId: player.id });
    }
  }

  const winner = engine.detectWinner(state);
  if (!winner && aliveIds(state).length === 0) {
    finding(result, "high", "no-winner-with-zero-alive", "No winner was detected with zero alive players.", { stage });
  }
}

function chooseTargetForAction(state, random, focusRole, actionKey) {
  const options = engine.nightTargetOptions(state, actionKey).map((option) => option.id);
  if (!options.length) return null;

  if (focusRole === "kamikaze" && ["mafia", "lovers", "maniac"].includes(actionKey)) {
    const kamikaze = aliveRoleIds(state, "kamikaze")[0];
    if (options.includes(kamikaze)) return kamikaze;
  }

  if (focusRole === "lover" && actionKey !== "lovers") {
    const lover = choose(random, aliveRoleIds(state, "lover").filter((id) => options.includes(id)));
    if (lover && random() < 0.28) return lover;
  }

  if (focusRole === "bomber" && actionKey !== "bomb") {
    const bomber = choose(random, aliveRoleIds(state, "bomber").filter((id) => options.includes(id)));
    if (bomber && random() < 0.35) return bomber;
  }

  if (focusRole === "don" && actionKey === "don") {
    const sheriff = choose(random, aliveRoleIds(state, "sheriff").filter((id) => options.includes(id)));
    if (sheriff && random() < 0.65) return sheriff;
  }

  if (focusRole === "sheriff" && actionKey === "sheriff" && state.sheriffActionMode !== "shoot") {
    const black = choose(random, aliveBlackIds(state).filter((id) => options.includes(id)));
    if (black && random() < 0.65) return black;
  }

  return choose(random, options);
}

function runShield(state, random, focusRole, result) {
  if (!canAct(state, "shield")) return;
  const alive = aliveIds(state);
  let target = choose(random, alive);

  if (focusRole === "shield") {
    const blockableActions = ["mafia", "don", "sheriff", "doctor", "lawyer", "lovers", "bomb", "maniac"]
      .filter((actionKey) => canAct(state, actionKey))
      .flatMap((actionKey) => actionActorIds(state, actionKey).map((actorId) => ({ actionKey, actorId })));
    const block = choose(random, blockableActions);
    if (block) target = block.actorId;
  }

  state.night.shielded = target;
  state.players.forEach((player) => {
    player.shielded = player.id === target;
  });
  addFocusAction(result, "shield");

  for (const actionKey of ["mafia", "don", "sheriff", "doctor", "lawyer", "lovers", "bomb", "maniac"]) {
    if (canAct(state, actionKey) && isActionBlocked(state, actionKey)) {
      state.night.blockedActions[actionKey] = target;
      observe(result, "shield-block", "Shield blocked a night action.", { shielded: target, actionKey });
      if (actionKey === "mafia") {
        const remainingActors = actionActorIds(state, "mafia").filter((id) => id !== target);
        if (remainingActors.length) {
          observe(result, "shield-blocked-entire-mafia-team", "Shield blocked mafia shot by targeting one mafia-side actor while other mafia actors were alive.", { shielded: target, remainingActors });
        }
      }
    }
  }
}

function runChecks(state, random, focusRole, result) {
  if (canAct(state, "don") && !state.night.blockedActions.don) {
    const target = chooseTargetForAction(state, random, focusRole, "don");
    if (target) {
      const isSheriff = (state.roles.sheriff || []).includes(target);
      state.night.checks.push({ by: "Дон", target, result: isSheriff ? "шериф" : "не шериф" });
      if (isSheriff) state.donSheriffFound = engine.uniqueNumbers([...(state.donSheriffFound || []), target]);
      addFocusAction(result, "don");
      observe(result, isSheriff ? "don-found-sheriff" : "don-check-clear", "Don performed a check.", { target });
    }
  }

  if (canAct(state, "sheriff") && !state.night.blockedActions.sheriff) {
    const knownBlack = engine.uniqueNumbers(state.sheriffMafiaFound || []).filter((id) => aliveIds(state).includes(id));
    state.sheriffActionMode = focusRole === "sheriff" && knownBlack.length && random() < 0.5 ? "shoot" : "check";
    const target = chooseTargetForAction(state, random, focusRole, "sheriff");
    if (target) {
      if (state.sheriffActionMode === "shoot") {
        state.night.sheriffShotTarget = target;
        observe(result, "sheriff-shot", "Sheriff shot a known black target.", { target });
      } else {
        const aliveBlack = aliveBlackIds(state);
        const isBlack = blackIds(state).includes(target) || ((state.roles.maniac || []).includes(target) && aliveBlack.length === 0);
        state.night.checks.push({ by: "Шериф", target, result: isBlack ? "черный" : "красный" });
        if (isBlack) state.sheriffMafiaFound = engine.uniqueNumbers([...(state.sheriffMafiaFound || []), target]);
        observe(result, isBlack ? "sheriff-found-black" : "sheriff-check-clear", "Sheriff performed a check.", { target });
      }
      addFocusAction(result, "sheriff");
    }
  }
}

function runSupportActions(state, random, focusRole, result, attacks) {
  if (canAct(state, "doctor") && !state.night.blockedActions.doctor) {
    const currentVictims = engine.uniqueNumbers([...Object.values(attacks), state.night.sheriffShotTarget]);
    let options = engine.nightTargetOptions(state, "doctor").map((option) => option.id);
    const healLimit = engine.doctorRequiredHeals(state);
    if (focusRole === "doctor") {
      const attacked = currentVictims.filter((id) => options.includes(id));
      if (attacked.length) options = [...attacked, ...options.filter((id) => !attacked.includes(id))];
    }
    const healed = sample(random, options, healLimit);
    state.night.healed = healLimit === 1 ? healed[0] || null : healed;
    state.players.forEach((player) => {
      player.healed = healed.includes(player.id);
    });
    addFocusAction(result, "doctor");
    observe(result, "doctor-heal", "Doctor selected heal target(s).", { healed });
  }

  if (canAct(state, "lawyer") && !state.night.blockedActions.lawyer) {
    const options = engine.nightTargetOptions(state, "lawyer").map((option) => option.id);
    const target = choose(random, options);
    if (target) {
      state.night.alibi = target;
      state.players.forEach((player) => {
        player.alibi = player.id === target;
      });
      addFocusAction(result, "lawyer");
      observe(result, "lawyer-alibi", "Lawyer gave alibi.", { target });
    }
  }

  if (canAct(state, "bomb") && !state.night.blockedActions.bomb && (focusRole === "bomber" || random() < 0.7)) {
    const options = engine.nightTargetOptions(state, "bomb").map((option) => option.id);
    const targets = sample(random, options, Math.min(3, options.length));
    state.night.previousBombed = state.players.filter((player) => player.bombed).map((player) => player.id);
    state.night.bombed = targets;
    state.bombTargetIds = targets;
    state.players.forEach((player) => {
      player.bombed = targets.includes(player.id);
    });
    addFocusAction(result, "bomb");
    observe(result, "bomber-marked", "Bomber marked targets.", { targets });
  }
}

function runAttacks(state, random, focusRole, result) {
  const attacks = {};
  for (const actionKey of ["mafia", "lovers", "maniac"]) {
    if (!canAct(state, actionKey) || state.night.blockedActions[actionKey]) continue;
    const focusAction = ROLE_ACTIONS[focusRole] === actionKey;
    if (!focusAction && random() < 0.18) continue;
    const target = chooseTargetForAction(state, random, focusRole, actionKey);
    if (!target) continue;
    attacks[actionKey] = target;
    addFocusAction(result, actionKey);
    if (actionActorIds(state, actionKey).includes(target)) {
      observe(result, "night-attack-self-or-team", "A killing action targeted one of its own actors.", { actionKey, target, roles: roleNamesForPlayer(state, target) });
    }
    if (actionKey === "mafia" && blackIds(state).includes(target)) {
      observe(result, "mafia-targeted-black-role", "Mafia targeted a black-team role.", { target, roles: roleNamesForPlayer(state, target) });
    }
  }
  return attacks;
}

function resolveKamikaze(state, random, focusRole, result, attacks) {
  const kamikazeId = aliveRoleIds(state, "kamikaze")[0];
  const redirectedActions = Object.entries(attacks)
    .filter(([, target]) => target === kamikazeId)
    .map(([actionKey]) => actionKey);
  if (!redirectedActions.length) return attacks;

  state.night.kamikazeRedirect = { kamikaze: kamikazeId, target: null, actions: redirectedActions };
  state.activeAction = "kamikaze";
  const options = engine.nightTargetOptions(state, "kamikaze").map((option) => option.id);
  if (options.includes(kamikazeId)) {
    finding(result, "high", "kamikaze-self-target-option", "Kamikaze redirect options include kamikaze.", { kamikazeId, options });
  }
  if (!options.length) {
    finding(result, "medium", "kamikaze-no-redirect-target", "Kamikaze was hit but had no redirect target options.", { kamikazeId, redirectedActions });
    return attacks;
  }
  const target = choose(random, options);
  state.night.kamikazeRedirect.target = target;
  for (const actionKey of redirectedActions) attacks[actionKey] = target;
  addFocusAction(result, "kamikaze");
  observe(result, redirectedActions.length > 1 ? "kamikaze-multi-redirect" : "kamikaze-redirect", "Kamikaze redirected incoming attack(s).", { kamikazeId, target, redirectedActions });
  if (target === kamikazeId) {
    finding(result, "high", "kamikaze-self-redirect", "Kamikaze redirected to themself.", { kamikazeId, redirectedActions });
  }
  return attacks;
}

function resolveNightDeaths(state, result, attacks) {
  const victims = engine.uniqueNumbers([...Object.values(attacks), state.night.sheriffShotTarget]);
  const healed = engine.healedIds(state);
  for (const victim of victims) {
    if (healed.includes(victim)) {
      observe(result, "doctor-save", "Doctor saved a night victim.", { victim });
      continue;
    }
    kill(state, victim, "ночь", result, { attacks: Object.entries(attacks).filter(([, target]) => target === victim).map(([actionKey]) => actionKey) });
  }
}

function runNight(state, random, focusRole, result) {
  const previousHealed = engine.healedIds(state);
  state.players.forEach((player) => {
    player.alibi = false;
    player.healed = false;
    player.shielded = false;
  });
  state.night = engine.makeBlankState(state.playerCount).night;
  state.night.lastHealed = previousHealed;

  runShield(state, random, focusRole, result);
  const attacks = runAttacks(state, random, focusRole, result);
  runChecks(state, random, focusRole, result);
  runSupportActions(state, random, focusRole, result, attacks);
  resolveKamikaze(state, random, focusRole, result, attacks);
  resolveNightDeaths(state, result, attacks);

  state.nightNumber += 1;
}

function runDay(state, random, focusRole, result) {
  if (state.dayNumber <= 1) {
    state.dayNumber += 1;
    return;
  }
  if (aliveIds(state).length <= 2 || random() < 0.22) {
    state.dayNumber += 1;
    return;
  }

  const alive = aliveIds(state);
  let target = choose(random, alive);
  const alibiTarget = state.players.find((player) => player.alive && player.alibi)?.id;
  const bomber = choose(random, aliveRoleIds(state, "bomber"));
  const lover = choose(random, aliveRoleIds(state, "lover"));
  const don = choose(random, aliveRoleIds(state, "don"));

  if (focusRole === "lawyer" && alibiTarget && random() < 0.75) target = alibiTarget;
  if (focusRole === "bomber" && bomber && state.players.some((player) => player.bombed && player.alive) && random() < 0.7) target = bomber;
  if (focusRole === "lover" && lover && random() < 0.45) target = lover;
  if (focusRole === "don" && don && (state.donSheriffFound || []).length && random() < 0.45) target = don;

  if (!target) {
    state.dayNumber += 1;
    return;
  }

  const player = state.players.find((item) => item.id === target);
  if (player?.alibi) {
    observe(result, "lawyer-alibi-save", "A voted player stayed alive because of lawyer alibi.", { target });
    state.dayNumber += 1;
    return;
  }

  kill(state, target, "голосование", result, { phase: "day" });
  state.dayNumber += 1;
}

function simulateGame(focusRole, gameIndex, roleIndex) {
  const roleDef = engine.ROLE_DEFS.find((role) => role.key === focusRole);
  const seed = BASE_SEED + roleIndex * 100000 + gameIndex * 1009;
  const random = seededRandom(seed);
  const minPlayers = Math.max(engine.MIN_PLAYERS, roleDef.minPlayers);
  const playerCount = intBetween(random, minPlayers, engine.MAX_PLAYERS);
  const state = engine.makeBlankState(playerCount);
  state.phase = "discussion";
  state.dayNumber = 1;
  state.nightNumber = 2;
  assignRandomRoles(state, random);
  state.rolesConfirmed = true;
  state.rolesLocked = true;
  state.targetId = choose(random, aliveIds(state)) || 1;
  state.startImmunityIds = sample(random, aliveIds(state), intBetween(random, 0, Math.min(5, playerCount)));

  const result = {
    focusRole,
    gameIndex,
    seed,
    playerCount,
    focusPlayers: state.roles[focusRole] || [],
    focusActions: {},
    deaths: [],
    findings: [],
    observations: [],
    winner: null,
    turns: 0,
    finalAlive: 0
  };

  validateState(state, result, "initial");

  for (let turn = 1; turn <= playerCount * 3; turn += 1) {
    result.turns = turn;
    const winnerBefore = engine.detectWinner(state);
    if (winnerBefore) {
      result.winner = winnerBefore;
      break;
    }

    runDay(state, random, focusRole, result);
    validateState(state, result, `day-${turn}`);
    const winnerAfterDay = engine.detectWinner(state);
    if (winnerAfterDay) {
      result.winner = winnerAfterDay;
      break;
    }

    runNight(state, random, focusRole, result);
    validateState(state, result, `night-${turn}`);
    const winnerAfterNight = engine.detectWinner(state);
    if (winnerAfterNight) {
      result.winner = winnerAfterNight;
      break;
    }
  }

  result.winner ||= engine.detectWinner(state) || "unfinished";
  result.finalAlive = aliveIds(state).length;
  if (result.winner === "unfinished") finding(result, "high", "unfinished-game", "Game did not reach a winner inside the turn guard.", { turns: result.turns });
  return result;
}

function groupBy(values, keyFn) {
  const groups = new Map();
  for (const value of values) {
    const key = keyFn(value);
    groups.set(key, [...(groups.get(key) || []), value]);
  }
  return groups;
}

function countBy(values, keyFn) {
  return Object.fromEntries([...groupBy(values, keyFn)].sort((left, right) => String(left[0]).localeCompare(String(right[0]))).map(([key, rows]) => [key, rows.length]));
}

function sum(values, keyFn) {
  return values.reduce((total, value) => total + Number(keyFn(value) || 0), 0);
}

function examples(items, max = 5) {
  return items.slice(0, max).map((item) => `  - ${item.focusRole} game ${item.gameIndex}, ${item.playerCount} players, seed ${item.seed}: ${item.message}`).join("\n");
}

const results = [];
engine.ROLE_DEFS.forEach((role, roleIndex) => {
  for (let gameIndex = 1; gameIndex <= GAMES_PER_ROLE; gameIndex += 1) {
    results.push(simulateGame(role.key, gameIndex, roleIndex + 1));
  }
});

const allFindings = results.flatMap((result) => result.findings.map((item) => ({ ...item, focusRole: result.focusRole, gameIndex: result.gameIndex, playerCount: result.playerCount, seed: result.seed })));
const allObservations = results.flatMap((result) => result.observations.map((item) => ({ ...item, focusRole: result.focusRole, gameIndex: result.gameIndex, playerCount: result.playerCount, seed: result.seed })));
const roleSummaries = engine.ROLE_DEFS.map((role) => {
  const rows = results.filter((result) => result.focusRole === role.key);
  return {
    role: role.key,
    name: role.name,
    games: rows.length,
    winners: countBy(rows, (row) => row.winner),
    playerCounts: countBy(rows, (row) => row.playerCount),
    averageTurns: Number((sum(rows, (row) => row.turns) / rows.length).toFixed(1)),
    focusActions: sum(rows, (row) => Object.values(row.focusActions).reduce((total, count) => total + count, 0)),
    deaths: sum(rows, (row) => row.deaths.length),
    findings: rows.reduce((total, row) => total + row.findings.length, 0),
    observations: rows.reduce((total, row) => total + row.observations.length, 0)
  };
});

const summary = {
  gamesPerRole: GAMES_PER_ROLE,
  totalGames: results.length,
  baseSeed: BASE_SEED,
  winners: countBy(results, (result) => result.winner),
  findings: countBy(allFindings, (item) => `${item.severity}:${item.type}`),
  observations: countBy(allObservations, (item) => item.type),
  roleSummaries
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(JSON_PATH, JSON.stringify({ summary, results, findings: allFindings, observations: allObservations }, null, 2));

const roleRows = roleSummaries.map((role) => (
  `| ${role.role} | ${role.games} | ${role.focusActions} | ${role.findings} | ${role.observations} | ${role.averageTurns} | ${Object.entries(role.winners).map(([winner, count]) => `${winner}:${count}`).join(", ")} |`
)).join("\n");

const findingSections = [...groupBy(allFindings, (item) => `${item.severity}:${item.type}`)]
  .sort((left, right) => left[0].localeCompare(right[0]))
  .map(([key, items]) => {
    const [severity, type] = key.split(":");
    return `### ${type} (${severity})\n\nCount: ${items.length}\n\n${items[0].message}\n\nExamples:\n${examples(items)}`;
  })
  .join("\n\n");

const observationSections = [...groupBy(allObservations, (item) => item.type)]
  .sort((left, right) => right[1].length - left[1].length)
  .map(([type, items]) => `### ${type}\n\nCount: ${items.length}\n\n${items[0].message}\n\nExamples:\n${examples(items, 3)}`)
  .join("\n\n");

const report = `# All Roles Fuzz Report

Generated: ${new Date().toISOString()}

Command: \`node scripts/all-roles-fuzz.mjs ${GAMES_PER_ROLE} ${BASE_SEED}\`

## Run Summary

- Roles covered: ${engine.ROLE_DEFS.map((role) => role.key).join(", ")}
- Games per role: ${GAMES_PER_ROLE}
- Total games: ${results.length}
- Seed: ${BASE_SEED}
- Player counts: random within each role's supported range
- Focus bias: each role cohort biases actions and deaths toward that role's mechanics while still running random day/night events.

Winner distribution: ${Object.entries(summary.winners).map(([winner, count]) => `${winner}: ${count}`).join(", ")}

## Role Matrix

| Role | Games | Focus actions | Findings | Observations | Avg turns | Winners |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${roleRows}

## Findings

${findingSections || "No invariant failures or wrong-logic findings were recorded."}

## Rule-Review Observations

These are legal flows under the current app logic, but worth confirming against the intended table rules.

${observationSections || "No rule-review observations were recorded."}

## Notes

- This harness imports the current app engine and UI helper exports, including \`nightTargetOptions()\`.
- Kamikaze redirect target options are checked against the current self-target exclusion.
- Death chains model the app's bomber, lovers, and Don revenge behavior.
- Raw data is in \`${JSON_PATH}\`.
`;

fs.writeFileSync(REPORT_PATH, report);

console.log(JSON.stringify({ summary, reportPath: REPORT_PATH, jsonPath: JSON_PATH }, null, 2));
