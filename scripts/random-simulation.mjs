import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const STORAGE_KEY = "mafia-host-react-state-v1";
const THEME_KEY = "mafia-host-react-theme";

const config = {
  games: Number(process.argv[2]) || 300,
  seed: Number(process.argv[3]) || 20260627,
  maxSteps: Number(process.argv[4]) || 700,
  reportPath: resolve(rootDir, "reports/random-simulation-report.md")
};
const TRACE = process.env.SIM_TRACE === "1";

function trace(...parts) {
  if (TRACE) console.error("[trace]", ...parts);
}

function seededRandom(seed) {
  let value = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function intBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function choose(random, values) {
  if (!values.length) return undefined;
  return values[Math.floor(random() * values.length)];
}

function shuffle(random, values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function sample(random, values, count) {
  return shuffle(random, values).slice(0, count);
}

const hookState = new Map();
const localStore = new Map();
let currentInstance = null;
let currentComponent = null;
let hookIndex = 0;
let rootElement = null;
let tree = null;

globalThis.window = globalThis;
globalThis.document = { getElementById() { return {}; } };
globalThis.localStorage = {
  getItem(key) {
    return localStore.has(key) ? localStore.get(key) : null;
  },
  setItem(key, value) {
    localStore.set(key, String(value));
  },
  removeItem(key) {
    localStore.delete(key);
  }
};
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};
globalThis.lucide = { icons: {} };

function flatten(items) {
  const out = [];
  for (const item of items) {
    if (Array.isArray(item)) out.push(...flatten(item));
    else if (item !== false && item !== true && item !== null && item !== undefined) out.push(item);
  }
  return out;
}

function h(type, props, ...children) {
  return { type, props: props || {}, children: flatten(children) };
}

function renderNode(node, path = "root") {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return flatten(node.map((child, index) => renderNode(child, `${path}.${index}`)));
  if (typeof node.type === "function") {
    const previousInstance = currentInstance;
    const previousComponent = currentComponent;
    const previousHookIndex = hookIndex;
    currentInstance = `${path}/${node.type.name || "Anonymous"}`;
    currentComponent = node.type.name || "Anonymous";
    hookIndex = 0;
    const rendered = node.type({ ...(node.props || {}), children: node.children });
    currentInstance = previousInstance;
    currentComponent = previousComponent;
    hookIndex = previousHookIndex;
    return renderNode(rendered, `${path}/${node.type.name || "Anonymous"}:render`);
  }
  return {
    ...node,
    children: flatten((node.children || []).map((child, index) => renderNode(child, `${path}.${index}`)))
  };
}

function renderRoot() {
  tree = renderNode(rootElement);
}

function useState(initialValue) {
  if (!currentInstance) throw new Error("useState called outside a component");
  const slots = hookState.get(currentInstance) || [];
  if (!(hookIndex in slots)) slots[hookIndex] = typeof initialValue === "function" ? initialValue() : initialValue;
  const instance = currentInstance;
  const index = hookIndex;
  const setter = (value) => {
    const currentSlots = hookState.get(instance);
    currentSlots[index] = typeof value === "function" ? value(currentSlots[index]) : value;
  };
  const value = slots[hookIndex];
  hookState.set(currentInstance, slots);
  hookIndex += 1;
  return [value, setter];
}

globalThis.React = {
  createElement: h,
  useEffect() {},
  useMemo(factory) {
    return factory();
  },
  useState
};

globalThis.ReactDOM = {
  createRoot() {
    return {
      render(element) {
        rootElement = element;
        renderRoot();
      }
    };
  }
};

await import("../src/ui-focus.js");
await import("../src/app.js");

const engine = globalThis.MafiaGameEngine;

function appState() {
  return hookState.get("root/App")?.[0];
}

function textOf(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return (node.children || []).map(textOf).join("");
}

function findAll(node, predicate, out = []) {
  if (node && typeof node === "object") {
    if (predicate(node)) out.push(node);
    for (const child of node.children || []) findAll(child, predicate, out);
  }
  return out;
}

function byTestId(testId) {
  return findAll(tree, (node) => node.props?.["data-testid"] === testId)[0] || null;
}

function buttonsByText(text) {
  return findAll(tree, (node) => node.type === "button" && textOf(node).includes(text));
}

function optionValues(selectNode) {
  if (!selectNode) return [];
  return findAll(selectNode, (node) => node.type === "option")
    .map((node) => node.props?.value)
    .filter((value) => value !== "" && value !== null && value !== undefined)
    .map(Number)
    .filter(Boolean);
}

function stringOptionValues(selectNode) {
  if (!selectNode) return [];
  return findAll(selectNode, (node) => node.type === "option")
    .map((node) => node.props?.value)
    .filter((value) => value !== "" && value !== null && value !== undefined)
    .map(String);
}

function click(node, label = "button") {
  if (!node?.props?.onClick) throw new Error(`Cannot click missing ${label}`);
  if (node.props.disabled) throw new Error(`Cannot click disabled ${label}`);
  node.props.onClick();
  renderRoot();
}

function change(node, value, label = "field") {
  if (!node?.props?.onChange) throw new Error(`Cannot change missing ${label}`);
  if (node.props.disabled) throw new Error(`Cannot change disabled ${label}`);
  node.props.onChange({ target: { value: String(value) } });
  renderRoot();
}

function clickFirstText(text) {
  const node = buttonsByText(text).find((button) => !button.props.disabled);
  if (!node) throw new Error(`Button with text "${text}" not found`);
  click(node, `button ${text}`);
}

function stateSummary(state = appState()) {
  const alive = state.players.filter((player) => player.alive).map((player) => player.id);
  return {
    phase: state.phase,
    day: state.dayNumber,
    night: state.nightNumber,
    aliveCount: alive.length,
    alive: alive.slice(0, 12),
    winner: state.winner,
    detectedWinner: engine.detectWinner(state),
    log: (state.log || []).slice(0, 4)
  };
}

function resetToState(state) {
  localStore.set(STORAGE_KEY, JSON.stringify(state));
  localStore.set(THEME_KEY, "black");
  hookState.clear();
  renderRoot();
}

function randomRoles(random, playerCount) {
  const roles = {};
  const available = shuffle(random, Array.from({ length: playerCount }, (_, index) => index + 1));
  let cursor = 0;
  for (const role of engine.activeRoleDefs(playerCount)) {
    const count = engine.getRoleSlotCount(role, playerCount);
    roles[role.key] = available.slice(cursor, cursor + count);
    cursor += count;
  }
  return roles;
}

function aliveIds(state = appState()) {
  return state.players.filter((player) => player.alive).map((player) => player.id);
}

function playerRoles(state, playerId) {
  return engine.activeRoleDefs(state.playerCount)
    .filter((role) => state.roles[role.key]?.includes(Number(playerId)))
    .map((role) => role.key);
}

function blackIds(state) {
  return new Set([...(state.roles.don || []), ...(state.roles.mafia || []), ...(state.roles.shield || [])].map(Number));
}

function attackActorIds(state, actionKey) {
  if (actionKey === "mafia") return new Set([...(state.roles.don || []), ...(state.roles.mafia || [])].map(Number));
  return new Set((state.roles[engine.actionRoleKey(actionKey)] || []).map(Number));
}

function makeAnomaly(type, severity, message, game, step, details = {}) {
  return {
    type,
    severity,
    message,
    game: game.index,
    step,
    playerCount: game.playerCount,
    seed: game.seed,
    details,
    summary: stateSummary()
  };
}

function validateState(game, step, anomalies) {
  const state = appState();
  const roleIssues = engine.validateRoles(state.roles, state.playerCount);
  if (roleIssues.length) {
    anomalies.push(makeAnomaly("invalid-roles", "high", roleIssues.join("; "), game, step));
  }

  const ids = state.players.map((player) => player.id);
  if (ids.length !== state.playerCount || new Set(ids).size !== ids.length) {
    anomalies.push(makeAnomaly("invalid-player-list", "high", "Player list length or ids do not match playerCount.", game, step));
  }

  const alive = aliveIds(state);
  if (state.phase !== "gameOver" && alive.length === 0) {
    anomalies.push(makeAnomaly("no-alive-non-gameover", "high", "No alive players but game is not over.", game, step));
  }

  const detectedWinner = engine.detectWinner(state);
  if (state.phase === "gameOver" && state.winner !== detectedWinner) {
    anomalies.push(makeAnomaly("winner-mismatch", "high", "Stored winner does not match detectWinner().", game, step, { detectedWinner }));
  }
  if (state.phase !== "gameOver" && detectedWinner) {
    anomalies.push(makeAnomaly("winner-not-applied", "high", "detectWinner() returns a winner before phase is gameOver.", game, step, { detectedWinner }));
  }

  if (state.phase === "speeches" && state.timer.currentSpeaker) {
    const current = state.players.find((player) => player.id === Number(state.timer.currentSpeaker));
    if (!current?.alive && !state.dayEliminationDone) {
      anomalies.push(makeAnomaly("dead-current-speaker", "medium", "Current day speaker is not alive.", game, step));
    }
  }

  if (state.phase === "night") {
    const available = new Set(engine.availableNightActions(state).map((action) => action.key));
    for (const [actionKey] of engine.incompleteNightActions(state)) {
      if (!available.has(actionKey)) {
        anomalies.push(makeAnomaly("missing-night-action-unavailable", "high", "A required night action is not available in the action selector.", game, step, { actionKey }));
      }
    }
  }
}

function observe(observations, type, game, step, message, details = {}) {
  const state = appState();
  const key = `${type}:${state.phase}:${state.dayNumber}:${state.nightNumber}:${JSON.stringify(details)}`;
  if (game.seenObservationKeys?.has(key)) return;
  game.seenObservationKeys?.add(key);
  observations.push({
    type,
    game: game.index,
    step,
    playerCount: game.playerCount,
    seed: game.seed,
    message,
    details,
    summary: stateSummary()
  });
}

function advancePhase(game, step, anomalies) {
  const before = appState().phase;
  const button = byTestId("next-phase");
  click(button, "next phase");
  const confirm = buttonsByText("Перейти").find((node) => !node.props.disabled);
  if (!confirm) return false;
  click(confirm, "confirm next phase");
  const after = appState().phase;
  if (before === after && after === "speeches" && appState().shootout?.active) return true;
  if (before === after && after !== "gameOver") {
    anomalies.push(makeAnomaly("phase-did-not-advance", "medium", "Next phase confirmation left the game in the same phase.", game, step));
  }
  return true;
}

function clearLastWords() {
  let cleared = 0;
  for (;;) {
    const button = findAll(tree, (node) => (
      node.type === "button" &&
      textOf(node).trim() === "Последняя речь" &&
      !node.props.disabled
    ))[0];
    if (!button) return cleared;
    click(button, "last words");
    cleared += 1;
  }
}

function setDayOrder(random) {
  const startSelect = byTestId("day-start-player");
  if (startSelect) {
    const options = optionValues(startSelect);
    const target = choose(random, options);
    if (target) change(startSelect, target, "day start");
  }
  const directionSelect = byTestId("day-direction");
  if (directionSelect) {
    change(directionSelect, random() < 0.5 ? "forward" : "backward", "day direction");
  }
}

function handleShootout(random, game, step, anomalies) {
  let guard = 0;
  while (appState().phase === "speeches" && appState().shootout?.active && guard < 80) {
    guard += 1;
    const state = appState();
    const numberSelect = byTestId("shootout-number");
    if (numberSelect && !state.shootout.number) {
      change(numberSelect, intBetween(random, 1, 10), "shootout number");
    }
    const current = state.shootout.currentPlayer || state.shootout.tied[0];
    const secret = appState().shootout.number || intBetween(random, 1, 10);
    const called = new Set(appState().shootout.called || []);
    const openNumbers = Array.from({ length: 10 }, (_, index) => index + 1).filter((number) => !called.has(number));
    const guess = guard > 12 || random() < 0.28 ? secret : choose(random, openNumbers.filter((number) => number !== secret)) || secret;
    const button = findAll(tree, (node) => (
      node.type === "button" &&
      textOf(node) === String(guess) &&
      !node.props.disabled &&
      typeof node.props.onClick === "function"
    ))[0];
    if (!button) {
      anomalies.push(makeAnomaly("shootout-button-missing", "medium", "Could not find an enabled shootout guess button.", game, step, { current, guess, secret }));
      return;
    }
    click(button, "shootout guess");
    validateState(game, step, anomalies);
  }
  if (appState().shootout?.active) {
    anomalies.push(makeAnomaly("shootout-stalled", "high", "Shootout did not finish within the simulation guard.", game, step));
  }
}

function completeSpeeches(random, game, step, anomalies, observations) {
  if (appState().phase !== "speeches") return;
  trace("completeSpeeches:start", { game: game.index, step, summary: stateSummary() });
  setDayOrder(random);

  let guard = 0;
  while (appState().phase === "speeches" && guard < appState().playerCount * 6) {
    guard += 1;
    const state = appState();
    if (guard % 10 === 1) trace("completeSpeeches:loop", { game: game.index, step, guard, summary: stateSummary(state) });
    if (state.shootout?.active) {
      handleShootout(random, game, step, anomalies);
      if (appState().phase === "gameOver") return;
      break;
    }

    const currentSpeaker = Number(state.timer.currentSpeaker);
    if (!currentSpeaker) break;

    if (engine.hasDayVoting(state)) {
      const voteSelect = byTestId("current-speaker-vote");
      const options = optionValues(voteSelect);
      const target = choose(random, options);
      if (!target) {
        anomalies.push(makeAnomaly("no-vote-target", "high", "Current speaker had no available vote targets, so the day vote could not progress.", game, step, {
          currentSpeaker,
          aliveIds: aliveIds(state),
          activeImmunityIds: globalThis.MafiaUiFocus.initialImmunityActiveIds(state),
          startImmunityIds: state.startImmunityIds || [],
          startImmunityExpired: state.startImmunityExpired
        }));
        game.blocked = true;
        return;
      }
      if (target === currentSpeaker) {
        observe(observations, "day-self-vote", game, step, `Player ${currentSpeaker} voted for themselves.`, {
          voter: currentSpeaker,
          target
        });
      }
      change(voteSelect, target, "current speaker vote");
    }

    const nextButton = byTestId("next-speaker");
    if (!nextButton || nextButton.props.disabled) break;
    click(nextButton, "next speaker");
    validateState(game, step, anomalies);
  }

  const state = appState();
  const alive = state.players.filter((player) => player.alive);
  const flowComplete = alive.length > 0 && alive.every((player) => (
    engine.hasDayVoting(state) ? Boolean(state.votes?.[player.id]) : Boolean(state.speechesDone?.[player.id])
  ));
  if (state.phase === "speeches" && state.timer.currentSpeaker && !flowComplete && !state.dayEliminationDone) {
    anomalies.push(makeAnomaly("speeches-stalled", "medium", "Speeches did not finish within the simulation guard.", game, step));
  }
}

function setActiveAction(actionKey) {
  const actionSelect = byTestId("active-action");
  if (!actionSelect) throw new Error("Missing active-action select");
  const options = stringOptionValues(actionSelect);
  if (!options.includes(actionKey)) throw new Error(`Action ${actionKey} is not selectable`);
  change(actionSelect, actionKey, "active action");
}

function selectNightTarget(random, actionKey, game, step, anomalies, observations) {
  const state = appState();
  const targetSelect = byTestId("target-select");
  const targets = optionValues(targetSelect);
  const target = choose(random, targets);
  if (!target) {
    anomalies.push(makeAnomaly("no-night-target", "high", "Night action had no available target.", game, step, { actionKey }));
    game.blocked = true;
    return false;
  }

  if (["mafia", "lovers", "maniac"].includes(actionKey)) {
    const actors = attackActorIds(state, actionKey);
    if (actors.has(target)) {
      observe(observations, "night-attack-self-or-team", game, step, "A night killing action selected one of its own actors as the kill target.", {
        actionKey,
        target,
        targetRoles: playerRoles(state, target)
      });
    }
  }

  if (actionKey === "mafia" && blackIds(state).has(target)) {
    observe(observations, "mafia-targeted-black-role", game, step, "Mafia shot a black-team role.", {
      target,
      targetRoles: playerRoles(state, target)
    });
  }

  if (actionKey === "kamikaze" && state.night.kamikazeRedirect?.kamikaze === target) {
    observe(observations, "kamikaze-redirected-to-self", game, step, "Kamikaze redirected a hit back to themselves.", {
      target
    });
  }

  change(targetSelect, target, `${actionKey} target`);
  return true;
}

function selectBombTargets(random, game, step, anomalies) {
  const state = appState();
  const required = Math.min(3, aliveIds(state).length);
  const chosen = [];
  for (let index = 1; index <= 3; index += 1) {
    const select = byTestId(`bomb-target-${index}`);
    if (!select) continue;
    const options = optionValues(select).filter((id) => !chosen.includes(id));
    const fallbackOptions = optionValues(select);
    const target = choose(random, options.length ? options : fallbackOptions);
    if (!target && index <= required) {
      anomalies.push(makeAnomaly("no-bomb-target", "high", "Bomb action had no available target.", game, step, { index }));
      game.blocked = true;
      return false;
    }
    if (target) {
      chosen.push(target);
      change(select, target, `bomb target ${index}`);
    }
  }
  return true;
}

function completeNight(random, game, step, anomalies, observations) {
  let guard = 0;
  trace("completeNight:start", { game: game.index, step, summary: stateSummary(), incomplete: engine.incompleteNightActions(appState()) });
  while (appState().phase === "night" && engine.incompleteNightActions(appState()).length && guard < 120) {
    guard += 1;
    const incomplete = engine.incompleteNightActions(appState());
    const [actionKey] = choose(random, incomplete);
    trace("completeNight:action", { game: game.index, step, guard, actionKey, incomplete });

    setActiveAction(actionKey);
    const targetReady = actionKey === "bomb"
      ? selectBombTargets(random, game, step, anomalies)
      : selectNightTarget(random, actionKey, game, step, anomalies, observations);
    if (!targetReady) return;

    const before = JSON.stringify({
      incomplete: engine.incompleteNightActions(appState()),
      night: appState().night,
      activeAction: appState().activeAction
    });
    click(byTestId("apply-action"), `apply ${actionKey}`);
    const afterState = appState();
    const after = JSON.stringify({
      incomplete: engine.incompleteNightActions(afterState),
      night: afterState.night,
      activeAction: afterState.activeAction
    });

    if (afterState.night.blockedActions?.mafia) {
      const blockedBy = Number(afterState.night.blockedActions.mafia);
      const remainingActors = [...attackActorIds(afterState, "mafia")].filter((id) => id !== blockedBy && afterState.players.some((player) => player.id === id && player.alive));
      if (remainingActors.length) {
        observe(observations, "shield-blocked-entire-mafia-team", game, step, "Shield blocked the mafia team action by targeting one mafia-side actor while other mafia actors were alive.", {
          blockedBy,
          remainingActors
        });
      }
    }

    if (before === after && engine.incompleteNightActions(afterState).some(([key]) => key === actionKey)) {
      anomalies.push(makeAnomaly("night-action-no-progress", "medium", "Applying a night action did not change action completion state.", game, step, { actionKey }));
      return;
    }

    validateState(game, step, anomalies);
  }

  if (appState().phase === "night" && engine.incompleteNightActions(appState()).length) {
    anomalies.push(makeAnomaly("night-stalled", "high", "Night actions did not complete within the simulation guard.", game, step, {
      incomplete: engine.incompleteNightActions(appState())
    }));
  }
}

function runGame(index) {
  const random = seededRandom(config.seed + index * 1009);
  const playerCount = intBetween(random, engine.MIN_PLAYERS, engine.MAX_PLAYERS);
  const game = { index, seed: config.seed + index * 1009, playerCount, seenObservationKeys: new Set() };
  const anomalies = [];
  const observations = [];
  const initialState = engine.makeBlankState(playerCount);
  initialState.roles = randomRoles(random, playerCount);
  initialState.rolesConfirmed = true;
  initialState.rolesLocked = true;
  initialState.startImmunityIds = sample(random, Array.from({ length: playerCount }, (_, playerIndex) => playerIndex + 1), intBetween(random, 0, Math.min(5, playerCount)));
  initialState.targetId = choose(random, aliveIds(initialState)) || 1;
  resetToState(initialState);

  let crashed = null;
  let steps = 0;

  try {
    validateState(game, steps, anomalies);
    advancePhase(game, steps, anomalies);
    validateState(game, steps, anomalies);

    for (steps = 1; steps <= config.maxSteps && appState().phase !== "gameOver" && !game.blocked; steps += 1) {
      const state = appState();
      trace("game:step", { game: index, steps, summary: stateSummary(state) });

      if (steps % 17 === 0 && ["speeches", "night"].includes(state.phase)) {
        click(byTestId("next-phase"), "premature next phase");
      }

      if (state.phase === "discussion") {
        clearLastWords();
        advancePhase(game, steps, anomalies);
      } else if (state.phase === "speeches") {
        completeSpeeches(random, game, steps, anomalies, observations);
        if (appState().shootout?.active) handleShootout(random, game, steps, anomalies);
        clearLastWords();
        if (appState().phase === "speeches" && !appState().shootout?.active) advancePhase(game, steps, anomalies);
      } else if (state.phase === "voteResults") {
        clearLastWords();
        advancePhase(game, steps, anomalies);
      } else if (state.phase === "night") {
        completeNight(random, game, steps, anomalies, observations);
        if (appState().phase === "night" && !engine.incompleteNightActions(appState()).length) advancePhase(game, steps, anomalies);
      } else {
        anomalies.push(makeAnomaly("unknown-phase", "high", "Simulation encountered an unknown phase.", game, steps));
        break;
      }

      validateState(game, steps, anomalies);
    }
  } catch (error) {
    crashed = {
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 8).join("\n"),
      summary: stateSummary()
    };
    anomalies.push({
      type: "crash",
      severity: "critical",
      message: error.message,
      game: index,
      step: steps,
      playerCount,
      seed: game.seed,
      summary: stateSummary()
    });
  }

  const finalState = appState();
  if (!crashed && finalState.phase !== "gameOver" && !game.blocked) {
    anomalies.push(makeAnomaly("game-not-finished", "high", "Game did not finish within the max step limit.", game, steps, {
      maxSteps: config.maxSteps
    }));
  }

  return {
    index,
    seed: game.seed,
    playerCount,
    steps,
    winner: finalState.winner || engine.detectWinner(finalState) || null,
    phase: finalState.phase,
    dayNumber: finalState.dayNumber,
    nightNumber: finalState.nightNumber,
    aliveCount: aliveIds(finalState).length,
    initialImmunityCount: initialState.startImmunityIds.length,
    anomalies,
    observations,
    crashed,
    blocked: Boolean(game.blocked)
  };
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
  return [...groupBy(values, keyFn)].sort((left, right) => String(left[0]).localeCompare(String(right[0])));
}

function exampleLines(items, max = 3) {
  return items.slice(0, max).map((item) => {
    const detail = item.details && Object.keys(item.details).length ? ` Details: \`${JSON.stringify(item.details)}\`.` : "";
    const latest = item.summary?.log?.[0] ? ` Latest log: "${item.summary.log[0]}".` : "";
    return `  - Game ${item.game}, step ${item.step}, ${item.playerCount} players.${detail}${latest}`;
  }).join("\n");
}

function markdownReport(results) {
  const allAnomalies = results.flatMap((result) => result.anomalies);
  const allObservations = results.flatMap((result) => result.observations);
  const completed = results.filter((result) => result.phase === "gameOver" && !result.crashed);
  const crashed = results.filter((result) => result.crashed);
  const unfinished = results.filter((result) => result.phase !== "gameOver");
  const blocked = results.filter((result) => result.blocked);
  const winnerRows = countBy(completed, (result) => result.winner || "none")
    .map(([winner, rows]) => `| ${winner} | ${rows.length} |`)
    .join("\n");
  const playerCounts = countBy(results, (result) => result.playerCount)
    .map(([count, rows]) => `${count}:${rows.length}`)
    .join(", ");
  const immunityCounts = countBy(results, (result) => result.initialImmunityCount)
    .map(([count, rows]) => `${count}:${rows.length}`)
    .join(", ");
  const averageSteps = (results.reduce((sum, result) => sum + result.steps, 0) / results.length).toFixed(1);
  const averageDays = (completed.reduce((sum, result) => sum + result.dayNumber, 0) / Math.max(1, completed.length)).toFixed(1);

  const anomalySections = [...groupBy(allAnomalies, (item) => `${item.severity}:${item.type}`)]
    .sort((left, right) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const [leftSeverity] = left[0].split(":");
      const [rightSeverity] = right[0].split(":");
      return (severityOrder[leftSeverity] ?? 99) - (severityOrder[rightSeverity] ?? 99) || left[0].localeCompare(right[0]);
    })
    .map(([key, items]) => {
      const [severity, type] = key.split(":");
      return `### ${type} (${severity})\n\nCount: ${items.length}\n\n${items[0].message}\n\nExamples:\n${exampleLines(items)}`;
    })
    .join("\n\n");

  const observationSections = [...groupBy(allObservations, (item) => item.type)]
    .sort((left, right) => right[1].length - left[1].length)
    .map(([type, items]) => `### ${type}\n\nCount: ${items.length}\n\n${items[0].message}\n\nExamples:\n${exampleLines(items)}`)
    .join("\n\n");
  const anomalyCounts = new Map([...groupBy(allAnomalies, (item) => item.type)].map(([key, rows]) => [key, rows.length]));
  const observationCounts = new Map([...groupBy(allObservations, (item) => item.type)].map(([key, rows]) => [key, rows.length]));
  const interpretation = [
    crashed.length
      ? `- Runtime crashes were observed in ${crashed.length} game(s).`
      : "- No runtime crashes were observed.",
    anomalyCounts.has("no-vote-target")
      ? `- Blocking bug: ${anomalyCounts.get("no-vote-target")} game(s) reached day 2 with every alive player protected by start immunity. Because immunity expires only after vote results, the vote target list is empty and the game cannot advance.`
      : "- No blocking vote-target state was observed.",
    observationCounts.has("day-self-vote")
      ? `- Rule review: self-voting is currently allowed and occurred ${observationCounts.get("day-self-vote")} time(s).`
      : "- Self-voting was not observed.",
    observationCounts.has("night-attack-self-or-team")
      ? `- Rule review: killing actions can target their own actor/team and did so ${observationCounts.get("night-attack-self-or-team")} time(s).`
      : "- Killing actions did not target their own actor/team in this run.",
    observationCounts.has("shield-blocked-entire-mafia-team")
      ? `- Rule review: Shield can block the whole mafia shot by targeting one mafia-side actor while other mafia actors are alive; observed ${observationCounts.get("shield-blocked-entire-mafia-team")} time(s).`
      : "- Shield did not block a whole mafia team with other actors alive in this run.",
    observationCounts.has("kamikaze-redirected-to-self")
      ? `- Rule review: Kamikaze can redirect a hit back to themselves; observed ${observationCounts.get("kamikaze-redirected-to-self")} time(s).`
      : "- Kamikaze self-redirection was not observed."
  ].join("\n");

  return `# Random Mafia Game Simulation Report

Generated: ${new Date().toISOString()}

Command: \`node scripts/random-simulation.mjs ${config.games} ${config.seed} ${config.maxSteps}\`

## Run Summary

| Metric | Value |
| --- | ---: |
| Games requested | ${config.games} |
| Games completed | ${completed.length} |
| Games crashed | ${crashed.length} |
| Games unfinished | ${unfinished.length} |
| Games blocked by app state | ${blocked.length} |
| Seed | ${config.seed} |
| Max steps per game | ${config.maxSteps} |
| Average steps | ${averageSteps} |
| Average completed-game day | ${averageDays} |

Player-count coverage: ${playerCounts}

Initial-immunity coverage: ${immunityCounts}

## Winner Distribution

| Winner | Games |
| --- | ---: |
${winnerRows || "| none | 0 |"}

## Interpretation

${interpretation}

## Invariant Failures and Runtime Anomalies

${anomalySections || "No crashes, invariant failures, or unfinished games were observed in this run."}

## Rule-Review Observations

These are flows the app currently allows. They did not necessarily crash the game, but they are worth confirming against the intended Mafia rules.

${observationSections || "No rule-review observations were recorded."}

## Notes

- The harness drives the app's rendered event handlers through a minimal React-like renderer. It does not call private transition functions directly.
- Roles are randomized per game while preserving the role counts and uniqueness enforced by \`validateRoles()\`.
- The run intentionally performs occasional premature "next phase" clicks during incomplete day/night phases to exercise blockers.
- Re-run with the same seed to reproduce the same sequence: \`node scripts/random-simulation.mjs ${config.games} ${config.seed} ${config.maxSteps}\`.
`;
}

const results = [];
for (let gameIndex = 1; gameIndex <= config.games; gameIndex += 1) {
  results.push(runGame(gameIndex));
}

const report = markdownReport(results);
await writeFile(config.reportPath, report, "utf8");

const anomalies = results.flatMap((result) => result.anomalies);
const observations = results.flatMap((result) => result.observations);
const completed = results.filter((result) => result.phase === "gameOver" && !result.crashed).length;
console.log(JSON.stringify({
  games: config.games,
  completed,
  anomalies: anomalies.length,
  observations: observations.length,
  reportPath: config.reportPath
}, null, 2));
