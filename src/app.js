const { createElement: h, useEffect, useMemo, useState } = React;

const ROLE_DEFS = [
  { key: "don", name: "Дон", icon: "Crown", defaultPlayers: [3], minPlayers: 1 },
  { key: "mafia", name: "Мафия", icon: "Skull", defaultPlayers: [5, 7, 12, 15, 21], minPlayers: 1, dynamic: "mafia" },
  { key: "shield", name: "Щит", icon: "Shield", defaultPlayers: [2], minPlayers: 16 },
  { key: "sheriff", name: "Шериф", icon: "BadgeCheck", defaultPlayers: [4], minPlayers: 1 },
  { key: "maniac", name: "Маньяк", icon: "Swords", defaultPlayers: [6], minPlayers: 1 },
  { key: "lawyer", name: "Адвокат", icon: "Scale", defaultPlayers: [8], minPlayers: 1 },
  { key: "doctor", name: "Врач", icon: "Cross", defaultPlayers: [9], minPlayers: 1 },
  { key: "lover", name: "Любовники", icon: "Heart", defaultPlayers: [10, 18], minPlayers: 16 },
  { key: "bomber", name: "Бомбочка", icon: "Bomb", defaultPlayers: [19], minPlayers: 16 },
  { key: "kamikaze", name: "Камикадзе", icon: "Zap", defaultPlayers: [20], minPlayers: 15 }
];

const STATUS_ICONS = {
  checked: "SearchCheck",
  bomb: "Bomb",
  heal: "Cross",
  alibi: "Scale",
  target: "Crosshair",
  shield: "Shield",
  dead: "CircleX"
};

const MARK_ACTIONS = [
  { key: "dead", label: "Выбыл", icon: STATUS_ICONS.dead },
  { key: "shield", label: "Щит", icon: STATUS_ICONS.shield },
  { key: "bomb", label: "Бомба", icon: STATUS_ICONS.bomb },
  { key: "heal", label: "Лечение", icon: STATUS_ICONS.heal },
  { key: "alibi", label: "Алиби", icon: STATUS_ICONS.alibi }
];

const ACTIONS = [
  { key: "mafia", name: "Выстрел мафии" },
  { key: "don", name: "Дон" },
  { key: "shield", name: "Щит" },
  { key: "sheriff", name: "Шериф" },
  { key: "doctor", name: "Врач" },
  { key: "lawyer", name: "Адвокат" },
  { key: "lovers", name: "Выстрел любовников" },
  { key: "bomb", name: "Бомба" },
  { key: "maniac", name: "Маньяк" },
  { key: "kamikaze", name: "Камикадзе" }
];

const NIGHT_PENDING_TEXT = {
  mafia: "Мафия ещё не выбрала цель для выстрела.",
  don: "Дон ещё не выполнил проверку.",
  shield: "Щит ещё не выбрал, кого заблокировать.",
  sheriff: "Шериф ещё не выполнил действие.",
  doctor: "Врач ещё не выбрал всех, кого лечит.",
  lawyer: "Адвокат ещё не выдал алиби.",
  lovers: "Любовники ещё не выбрали цель.",
  bomb: "Бомбочка ещё не выбрала 3 цели.",
  maniac: "Маньяк ещё не выбрал цель.",
  kamikaze: "Камикадзе ещё не выбрал, куда перевести удар."
};

const NIGHT_ORDER = ["shield", "mafia", "don", "sheriff", "doctor", "lawyer", "lovers", "bomb", "maniac", "kamikaze"];

const DEFAULT_PLAYER_COUNT = 20;
const MIN_PLAYERS = 6;
const MAX_PLAYERS = 24;
const STORAGE_KEY = "mafia-host-react-state-v1";

function clampPlayerCount(value) {
  return Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Number(value) || DEFAULT_PLAYER_COUNT));
}

function getRoleSlotCount(role, playerCount) {
  if (playerCount < role.minPlayers) return 0;
  if (role.dynamic === "mafia") {
    return Math.max(1, Math.round(playerCount * 0.25) - 1);
  }
  return role.defaultPlayers.length;
}

function activeRoleDefs(playerCount) {
  return ROLE_DEFS.filter((role) => getRoleSlotCount(role, playerCount) > 0);
}

function createPlayers(playerCount) {
  return Array.from({ length: playerCount }, (_, index) => ({
    id: index + 1,
    alive: true,
    deathReason: null,
    shielded: false,
    bombed: false,
    healed: false,
    alibi: false
  }));
}

function normalizeRoles(roles, playerCount) {
  const used = new Set();
  const allPlayers = Array.from({ length: playerCount }, (_, index) => index + 1);
  return Object.fromEntries(
    ROLE_DEFS.map((role) => {
      const count = getRoleSlotCount(role, playerCount);
      const source = roles?.[role.key]?.length ? roles[role.key] : [];
      const filled = [];
      [...source, ...role.defaultPlayers, ...allPlayers].forEach((player) => {
        if (filled.length >= count) return;
        if (player >= 1 && player <= playerCount && !used.has(player)) {
          filled.push(player);
          used.add(player);
        }
      });
      return [role.key, filled];
    })
  );
}

function makeBlankState(playerCount = DEFAULT_PLAYER_COUNT) {
  const count = clampPlayerCount(playerCount);
  return {
    playerCount: count,
    phase: "introNight",
    dayNumber: 1,
    dayStartPlayerId: 1,
    dayDirection: "forward",
    nightNumber: 1,
    timer: {
      discussionMinutes: 4,
      speechSeconds: 60,
      remainingSeconds: 0,
      running: false,
      currentSpeaker: 1
    },
    view: "status",
    statusFilter: "all",
    rolesLocked: false,
    rolesConfirmed: false,
    setupError: "",
    winner: null,
    nominations: [],
    votes: {},
    foulVotes: {},
    abstained: {},
    speechesDone: {},
    lastWordsDone: {},
    publicNightSummary: [],
    nightResultDeaths: [],
    dayResult: null,
    sheriffMafiaFound: [],
    donSheriffFound: [],
    dayEliminationDone: false,
    shootout: {
      active: false,
      tied: [],
      number: null,
      called: [],
      guesses: {},
      calledBy: {},
      roundShots: [],
      turnOrder: [],
      currentPlayer: null
    },
    activeMark: null,
    activeAction: "mafia",
    sheriffActionMode: "check",
    targetId: 1,
    bombTargetIds: [1, 2, 3],
    kamikazeTargetId: 1,
    voterId: 1,
    roles: normalizeRoles(Object.fromEntries(ROLE_DEFS.map((role) => [role.key, [...role.defaultPlayers]])), count),
    players: createPlayers(count),
    log: [],
    night: {
      mafiaTarget: null,
      loversTarget: null,
      maniacTarget: null,
      sheriffShotTarget: null,
      healed: null,
      lastHealed: null,
      alibi: null,
      shielded: null,
      checks: [],
      bombed: [],
      previousBombed: null,
      blockedActions: {},
      kamikazeRedirect: null
    }
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.players?.length && saved.phase && saved.timer) {
      const playerCount = clampPlayerCount(saved.playerCount || saved.players.length || DEFAULT_PLAYER_COUNT);
      const blank = makeBlankState(playerCount);
      const phase = ["nominations", "voting"].includes(saved.phase)
        ? "speeches"
        : ["introNight", "discussion", "speeches", "voteResults", "night", "gameOver"].includes(saved.phase)
          ? saved.phase
          : blank.phase;
      const loaded = {
        ...blank,
        ...saved,
        phase,
        playerCount,
        timer: { ...blank.timer, ...saved.timer },
        night: {
          ...blank.night,
          ...(saved.night || {}),
          bombed: Array.isArray(saved.night?.bombed) ? saved.night.bombed : saved.night?.bombed ? [saved.night.bombed] : [],
          blockedActions: saved.night?.blockedActions && typeof saved.night.blockedActions === "object" ? saved.night.blockedActions : {}
        },
        bombTargetIds: Array.isArray(saved.bombTargetIds) ? saved.bombTargetIds : blank.bombTargetIds,
        players: createPlayers(playerCount).map((player) => ({
          ...player,
          ...(saved.players.find((savedPlayer) => savedPlayer.id === player.id) || {})
        })),
        roles: normalizeRoles(saved.roles, playerCount),
        statusFilter: ["all", "alive", "dead", "roles", "marked"].includes(saved.statusFilter) ? saved.statusFilter : "all",
        rolesLocked: Boolean(saved.rolesLocked),
        rolesConfirmed: Boolean(saved.rolesConfirmed),
        setupError: saved.setupError || "",
        winner: saved.winner || null,
        nominations: Array.isArray(saved.nominations) ? saved.nominations : [],
        votes: saved.votes && typeof saved.votes === "object" ? saved.votes : {},
        foulVotes: saved.foulVotes && typeof saved.foulVotes === "object" ? saved.foulVotes : {},
        abstained: saved.abstained && typeof saved.abstained === "object" ? saved.abstained : {},
        speechesDone: saved.speechesDone && typeof saved.speechesDone === "object" ? saved.speechesDone : {},
        lastWordsDone: saved.lastWordsDone && typeof saved.lastWordsDone === "object" ? saved.lastWordsDone : {},
        publicNightSummary: sanitizePublicSummary(saved.publicNightSummary),
        nightResultDeaths: Array.isArray(saved.nightResultDeaths) ? saved.nightResultDeaths : [],
        dayResult: saved.dayResult && typeof saved.dayResult === "object" ? saved.dayResult : null,
        sheriffMafiaFound: Array.isArray(saved.sheriffMafiaFound) ? saved.sheriffMafiaFound : [],
        donSheriffFound: Array.isArray(saved.donSheriffFound) ? saved.donSheriffFound : [],
        sheriffActionMode: ["check", "shoot"].includes(saved.sheriffActionMode) ? saved.sheriffActionMode : "check",
        dayEliminationDone: Boolean(saved.dayEliminationDone),
        dayStartPlayerId: blank.dayStartPlayerId,
        dayDirection: window.MafiaUiFocus?.normalizeDayDirection(saved.dayDirection) || "forward",
        shootout: {
          ...blank.shootout,
          ...(saved.shootout && typeof saved.shootout === "object" ? saved.shootout : {}),
          calledBy: saved.shootout?.calledBy && typeof saved.shootout.calledBy === "object" ? saved.shootout.calledBy : {},
          roundShots: Array.isArray(saved.shootout?.roundShots) ? saved.shootout.roundShots : [],
          turnOrder: Array.isArray(saved.shootout?.turnOrder) ? saved.shootout.turnOrder : [],
          currentPlayer: saved.shootout?.currentPlayer || saved.shootout?.tied?.[0] || null
        },
        activeMark: MARK_ACTIONS.some((mark) => mark.key === saved.activeMark) ? saved.activeMark : null,
        log: Array.isArray(saved.log) ? saved.log : []
      };
      const savedDayStartPlayerId = Number(saved.dayStartPlayerId);
      loaded.dayStartPlayerId = loaded.players.some((player) => player.id === savedDayStartPlayerId && player.alive)
        ? savedDayStartPlayerId
        : firstAlivePlayerId(loaded);
      if (loaded.phase === "speeches") {
        loaded.timer.currentSpeaker = resolveCurrentDaySpeaker(loaded, Number(loaded.timer.currentSpeaker));
        loaded.timer.running = Boolean(loaded.timer.running && loaded.timer.currentSpeaker);
      }
      return normalizeLoadedGameOver(loaded);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return makeBlankState();
}

function roleSlotsFromRoles(roles, playerCount = DEFAULT_PLAYER_COUNT) {
  return Object.fromEntries(
    ROLE_DEFS.map((role) => [
      role.key,
      Array.from({ length: getRoleSlotCount(role, playerCount) }, (_, index) => String(roles[role.key]?.[index] || ""))
    ])
  );
}

function normalizeLoadedGameOver(state) {
  if (state.phase !== "gameOver") return state;
  const winner = detectWinner(state);
  if (winner) {
    state.winner = winner;
    return state;
  }
  state.winner = null;
  state.phase = state.dayResult ? "voteResults" : state.publicNightSummary.length || state.nightResultDeaths.length ? "discussion" : "speeches";
  state.timer.running = false;
  state.log = [`${phaseName(state)}: партия восстановлена после обновления условий победы`, ...state.log].slice(0, 80);
  return state;
}

function sanitizeDigits(value) {
  return String(value).replace(/\D/g, "").slice(0, 2);
}

function parseRoleSlots(slots, playerCount) {
  return Object.fromEntries(
    ROLE_DEFS.map((role) => [
      role.key,
      (slots[role.key] || [])
        .map((value) => Number(value))
        .filter((number) => Number.isInteger(number) && number >= 1 && number <= playerCount)
    ])
  );
}

function validateRoles(roles, playerCount) {
  const issues = [];
  const allPlayers = [];
  activeRoleDefs(playerCount).forEach((role) => {
    const players = roles[role.key] || [];
    const required = getRoleSlotCount(role, playerCount);
    if (players.length !== required) {
      issues.push(`${role.name}: заполните ${required}`);
    }
    players.forEach((player) => {
      if (player < 1 || player > playerCount) issues.push(`${role.name}: номер ${player} вне диапазона`);
      allPlayers.push(player);
    });
  });
  const duplicates = allPlayers.filter((player, index, list) => list.indexOf(player) !== index);
  if (duplicates.length) {
    issues.push(`Повторы: ${[...new Set(duplicates)].join(", ")}`);
  }
  return issues;
}

function phaseName(state) {
  if (state.phase === "gameOver") return `Игра окончена: ${state.winner || ""}`;
  if (state.phase === "introNight") return "Ночь 1: знакомство";
  if (state.phase === "discussion") return `День ${state.dayNumber}: Балаган`;
  if (state.phase === "speeches") return `День ${state.dayNumber}: речи игроков`;
  if (state.phase === "voteResults") return `День ${state.dayNumber}: итоги голосования`;
  return `Ночь ${state.nightNumber}`;
}

function shootoutColorClass(state, playerId) {
  const index = Math.max(0, (state.shootout?.tied || []).indexOf(Number(playerId)));
  return `shootout-color-${(index % 6) + 1}`;
}

function shootoutOrderedPlayers(state) {
  const tied = state.shootout?.tied || [];
  const savedOrder = (state.shootout?.turnOrder || []).filter((playerId, index, list) => tied.includes(playerId) && list.indexOf(playerId) === index);
  return savedOrder.concat(tied.filter((playerId) => !savedOrder.includes(playerId)));
}

function shootoutAvailablePlayers(state) {
  const ordered = shootoutOrderedPlayers(state);
  const roundShots = state.shootout?.roundShots || [];
  const available = ordered.filter((playerId) => !roundShots.includes(playerId));
  return available.length ? available : ordered;
}

function hasDayVoting(state) {
  return state.dayNumber >= 2;
}

function canUseNightActions(state) {
  return state.phase === "night" && state.nightNumber >= 2;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function nextAliveSpeaker(state, currentSpeaker) {
  const alive = state.players.filter((player) => player.alive).map((player) => player.id);
  if (!alive.length) return 1;
  return alive.find((id) => id > currentSpeaker) || alive[0];
}

function dayOrder(state) {
  return window.MafiaUiFocus?.daySpeakerOrder?.(state) || nextAliveSpeakerFallbackOrder(state);
}

function nextAliveSpeakerFallbackOrder(state) {
  const aliveIds = state.players.filter((player) => player.alive).map((player) => player.id);
  if (!aliveIds.length) return [];
  const direction = window.MafiaUiFocus?.normalizeDayDirection?.(state.dayDirection) || (state.dayDirection === "backward" ? "backward" : "forward");
  const orderedIds = direction === "backward" ? [...aliveIds].reverse() : aliveIds;
  const requestedStart = Number(state.dayStartPlayerId);
  const startId = orderedIds.includes(requestedStart) ? requestedStart : orderedIds[0];
  const startIndex = orderedIds.indexOf(startId);
  return orderedIds.slice(startIndex).concat(orderedIds.slice(0, startIndex));
}

function completeSpeechIds(state) {
  const votingOpen = hasDayVoting(state);
  return state.players
    .filter((player) => player.alive)
    .map((player) => player.id)
    .filter((id) => votingOpen ? Boolean(state.votes?.[id]) : Boolean(state.speechesDone?.[id]));
}

function nextOrderedSpeaker(state, currentSpeaker) {
  const completeIds = completeSpeechIds(state);
  if (window.MafiaUiFocus?.nextDaySpeaker) {
    return window.MafiaUiFocus.nextDaySpeaker({
      ...state,
      currentSpeaker,
      completeIds
    }) || 0;
  }
  const order = dayOrder(state);
  if (!order.length || order.every((id) => completeIds.includes(id))) return 0;
  const currentIndex = order.indexOf(Number(currentSpeaker));
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  for (let offset = 0; offset < order.length; offset += 1) {
    const id = order[(startIndex + offset) % order.length];
    if (!completeIds.includes(id)) return id;
  }
  return 0;
}

function firstAlivePlayerId(state) {
  return state.players.find((player) => player.alive)?.id || 1;
}

function resolveCurrentDaySpeaker(state, preferredSpeaker) {
  const speakerId = Number(preferredSpeaker);
  const completeIds = new Set(completeSpeechIds(state));
  const speakerPending = state.players.some((player) => player.id === speakerId && player.alive) && !completeIds.has(speakerId);
  if (speakerPending) return speakerId;
  return nextOrderedSpeaker(state, speakerId) || nextOrderedSpeaker(state, 0);
}

function resetDayOrder(draft) {
  const firstAlive = firstAlivePlayerId(draft);
  draft.dayStartPlayerId = firstAlive;
  draft.dayDirection = "forward";
  draft.timer.currentSpeaker = firstAlive;
}

function actionName(actionKey) {
  return ACTIONS.find((action) => action.key === actionKey)?.name || actionKey;
}

function actionRoleKey(actionKey) {
  return { lovers: "lover", bomb: "bomber" }[actionKey] || actionKey;
}

function actionActorIds(state, actionKey) {
  if (actionKey === "mafia") return uniqueNumbers([...(state.roles.don || []), ...(state.roles.mafia || [])]);
  return uniqueNumbers(state.roles[actionRoleKey(actionKey)] || []);
}

function isActionBlockedByShield(state, actionKey) {
  const shieldedId = Number(state.night.shielded);
  return Boolean(shieldedId && actionActorIds(state, actionKey).includes(shieldedId));
}

function resolveBombTargets(state) {
  const aliveIds = state.players.filter((player) => player.alive).map((player) => player.id);
  const currentMarks = state.players.filter((player) => player.alive && player.bombed).map((player) => player.id);
  const selected = uniqueNumbers([...(state.bombTargetIds || []), ...(state.night.bombed || []), ...currentMarks, ...aliveIds])
    .filter((id) => aliveIds.includes(id));
  return selected.slice(0, 3);
}

function bombRequiredTargetCount(state) {
  return Math.min(3, state.players.filter((player) => player.alive).length);
}

function canPlantBombs(state) {
  return state.nightNumber === 2 || state.nightNumber === 3;
}

function availableActions(playerCount) {
  const activeKeys = new Set(activeRoleDefs(playerCount).map((role) => role.key));
  return ACTIONS.filter((action) => activeKeys.has(actionRoleKey(action.key))).sort((left, right) => NIGHT_ORDER.indexOf(left.key) - NIGHT_ORDER.indexOf(right.key));
}

function availableNightActions(state) {
  if (!canUseNightActions(state)) return availableActions(state.playerCount);
  return availableActions(state.playerCount).filter((action) => {
    const roleKey = actionRoleKey(action.key);
    if (action.key === "mafia") return hasAliveRole(state, "don") || hasAliveRole(state, "mafia");
    if (action.key === "kamikaze") return Boolean(state.night.kamikazeRedirect?.kamikaze && !state.night.kamikazeRedirect.target);
    if (action.key === "bomb") return canPlantBombs(state) && hasAliveRole(state, roleKey);
    return hasAliveRole(state, roleKey);
  });
}

function isNightActionDone(state, actionKey) {
  if (state.night.blockedActions?.[actionKey]) return true;
  if (actionKey === "mafia") return Boolean(state.night.mafiaTarget);
  if (actionKey === "don") return state.night.checks.some((check) => check.by === "Дон");
  if (actionKey === "shield") return Boolean(state.night.shielded);
  if (actionKey === "sheriff") return Boolean(state.night.sheriffShotTarget) || state.night.checks.some((check) => check.by === "Шериф");
  if (actionKey === "doctor") return healedIds(state).length >= doctorRequiredHeals(state);
  if (actionKey === "lawyer") return Boolean(state.night.alibi);
  if (actionKey === "lovers") return Boolean(state.night.loversTarget);
  if (actionKey === "bomb" && !canPlantBombs(state)) return true;
  if (actionKey === "bomb") return Array.isArray(state.night.bombed) && state.night.bombed.length === bombRequiredTargetCount(state);
  if (actionKey === "maniac") return Boolean(state.night.maniacTarget);
  if (actionKey === "kamikaze") return !state.night.kamikazeRedirect?.kamikaze || Boolean(state.night.kamikazeRedirect.target);
  return false;
}

function orderedNightActions(state) {
  const available = availableNightActions(state);
  return NIGHT_ORDER.map((key) => available.find((action) => action.key === key)).filter(Boolean);
}

function nextNightActionKey(state, afterKey = null) {
  const actions = orderedNightActions(state);
  const startIndex = afterKey ? Math.max(0, actions.findIndex((action) => action.key === afterKey) + 1) : 0;
  return actions.slice(startIndex).find((action) => !isNightActionDone(state, action.key))?.key || actions.find((action) => !isNightActionDone(state, action.key))?.key || actions[0]?.key || "mafia";
}

function aliveRolePlayers(state, roleKey) {
  return (state.roles[roleKey] || []).filter((id) => state.players.some((player) => player.id === id && player.alive));
}

function hasAliveRole(state, roleKey) {
  return aliveRolePlayers(state, roleKey).length > 0;
}

function requiredNightActions(state) {
  if (!canUseNightActions(state)) return [];
  return orderedNightActions(state).map((action) => [action.key, action.name, isNightActionDone(state, action.key)]);
}

function incompleteNightActions(state) {
  return requiredNightActions(state).filter(([, , done]) => !done);
}

function doctorHealLimit(state) {
  return state.playerCount >= 16 && state.nightNumber <= 3 ? 2 : 1;
}

function doctorRequiredHeals(state) {
  const blocked = new Set(lastHealedIds(state));
  const available = state.players.filter((player) => player.alive && !blocked.has(player.id)).length;
  return Math.min(doctorHealLimit(state), available);
}

function healedIds(state) {
  return uniqueNumbers(Array.isArray(state.night?.healed) ? state.night.healed : state.night?.healed ? [state.night.healed] : []);
}

function lastHealedIds(state) {
  return uniqueNumbers(Array.isArray(state.night?.lastHealed) ? state.night.lastHealed : state.night?.lastHealed ? [state.night.lastHealed] : []);
}

function aliveKnownSheriffMafia(state) {
  return uniqueNumbers(state.sheriffMafiaFound || []).filter((id) => state.players.some((player) => player.id === id && player.alive));
}

function phaseBlockReason(state, roleDrafts) {
  if (state.phase === "gameOver") return "Игра уже завершена.";
  if (state.phase === "introNight" && !state.rolesConfirmed) {
    const issues = validateRoles(parseRoleSlots(roleDrafts, state.playerCount), state.playerCount);
    return issues[0] || "Подтвердите выбранные роли перед началом игры.";
  }
  if (state.phase === "speeches") {
    if (state.shootout?.active) {
      if (!state.shootout.number) return "Выберите секретное число для перестрелки.";
      return "Завершите перестрелку перед переходом к ночи.";
    }
    const aliveIds = state.players.filter((player) => player.alive).map((player) => player.id);
    if (!hasDayVoting(state)) {
      const missingSpeeches = aliveIds.filter((id) => !state.speechesDone?.[id]);
      if (missingSpeeches.length === 1) return `Игрок #${missingSpeeches[0]} ещё не завершил речь.`;
      if (missingSpeeches.length > 1) return `Не все живые игроки завершили речь: ${missingSpeeches.map((id) => `#${id}`).join(", ")}.`;
      return "";
    }
    const missingVotes = aliveIds.filter((id) => !state.votes?.[id]);
    if (missingVotes.length === 1) return `Игрок #${missingVotes[0]} ещё не проголосовал.`;
    if (missingVotes.length > 1) return `Не все живые игроки проголосовали: ${missingVotes.map((id) => `#${id}`).join(", ")}.`;
  }
  if (state.phase === "night") {
    const missing = incompleteNightActions(state);
    if (missing.length) return NIGHT_PENDING_TEXT[missing[0][0]] || `Действие "${missing[0][1]}" ещё не завершено.`;
  }
  if (state.phase === "voteResults") {
    const pendingLastWords = finalSpeechRequiredIds(state);
    if (pendingLastWords.length === 1) return `Игрок #${pendingLastWords[0]} ещё не сказал последнюю речь.`;
    if (pendingLastWords.length > 1) return `Последняя речь ещё нужна игрокам: ${pendingLastWords.map((id) => `#${id}`).join(", ")}.`;
  }
  return "";
}

function roleSummaryForPlayer(state, playerId) {
  return activeRoleDefs(state.playerCount)
    .filter((role) => state.roles[role.key]?.includes(playerId))
    .map((role) => role.name)
    .join(", ") || "Мирный";
}

function hasNoFinalSpeech(state, playerId) {
  return [...(state.roles.don || []), ...(state.roles.mafia || []), ...(state.roles.shield || []), ...(state.roles.sheriff || [])].includes(Number(playerId));
}

function finalSpeechRequiredIds(state) {
  return uniqueNumbers(state.dayResult?.lastWordsRequired || []).filter((id) => !state.lastWordsDone?.[id]);
}

function makeDeathDetails(state, beforeAliveIds, afterAliveIds, sourceMap = {}) {
  return [...beforeAliveIds]
    .filter((id) => !afterAliveIds.has(id))
    .map((id) => {
      const player = state.players.find((item) => item.id === id);
      const reason = player?.deathReason || "выбыл";
      return {
        id,
        role: roleSummaryForPlayer(state, id),
        reason,
        source: reason === "ночь"
          ? sourceMap[id] || deathReasonSource(reason)
          : sourceMap[id]
            ? `${deathReasonSource(reason)} Также по этому игроку было ночное действие: ${sourceMap[id]}`
            : deathReasonSource(reason),
        finalSpeech: !hasNoFinalSpeech(state, id)
      };
    });
}

function formatDeathDetails(deaths) {
  if (!deaths?.length) return "";
  return deaths.map((death) => `игрок ${death.id} (${death.role}, ${death.reason})`).join("; ");
}

function deathReasonLabel(reason) {
  const labels = {
    голосование: "Решение стола",
    перестрелка: "Перестрелка",
    ночь: "Ночная атака",
    бомба: "Взрыв Бомбочки",
    любовники: "Одно сердце Любовников",
    дон: "Последний ход Дона",
    "ручная отметка": "Отметка ведущего"
  };
  return labels[reason] || reason || "Выбыл";
}

function deathReasonSource(reason) {
  const sources = {
    голосование: "Игрок выбыл по решению дневного голосования.",
    перестрелка: "Игрок выбыл после перестрелки.",
    ночь: "Игрок умер от прямого ночного действия.",
    бомба: "Игрок был заминирован и умер после смерти Бомбочки.",
    любовники: "Игрок умер вслед за вторым Любовником.",
    дон: "Дон ранее нашёл Шерифа и забрал его с собой.",
    "ручная отметка": "Игрок был отмечен ведущим вручную."
  };
  return sources[reason] || "Причина выбытия зафиксирована ведущим.";
}

function deathReasonIcon(reason) {
  if (reason === "бомба") return "Bomb";
  if (reason === "любовники") return "Heart";
  if (reason === "дон") return "Crown";
  if (reason === "перестрелка") return "Target";
  if (reason === "голосование") return "Vote";
  return "CircleX";
}

function detectWinner(state) {
  const alive = state.players.filter((player) => player.alive);
  const aliveIds = alive.map((player) => player.id);
  const aliveManiacs = (state.roles.maniac || []).filter((id) => aliveIds.includes(id));
  const blackIds = [...(state.roles.don || []), ...(state.roles.mafia || []), ...(state.roles.shield || [])];
  const blackAlive = blackIds.filter((id) => aliveIds.includes(id)).length;
  const maniacAlive = aliveManiacs.length;
  const nonBlackAlive = alive.length - blackAlive;
  if (blackAlive > 0 && blackAlive >= nonBlackAlive) return "Мафия";
  if (blackAlive === 0 && maniacAlive === 0) return "Мирные";
  if (blackAlive === 0 && maniacAlive > 0 && alive.length <= 2) return "Маньяк";
  return null;
}

function voteTally(votes, foulVotes = {}, isValidTarget = () => true) {
  const tally = {};
  Object.values(votes || {}).forEach((targetId) => {
    const id = Number(targetId);
    if (!isValidTarget(id)) return;
    tally[id] = (tally[id] || 0) + 1;
  });
  Object.entries(foulVotes || {}).forEach(([targetId, count]) => {
    const id = Number(targetId);
    const value = Math.max(0, Number(count) || 0);
    if (!value || !isValidTarget(id)) return;
    tally[id] = (tally[id] || 0) + value;
  });
  return tally;
}

function voteLeaders(votes, foulVotes = {}, isValidTarget = () => true) {
  const tally = voteTally(votes, foulVotes, isValidTarget);
  const entries = Object.entries(tally);
  if (!entries.length) return [];
  const maxVotes = Math.max(...entries.map(([, count]) => count));
  return entries.filter(([, count]) => count === maxVotes).map(([id]) => Number(id));
}

function uniqueNumbers(values) {
  return [...new Set(values.filter(Boolean).map(Number))];
}

function formatPlayers(ids) {
  const list = uniqueNumbers(ids);
  if (!list.length) return "";
  return list.map((id) => `игрок ${id}`).join(", ");
}

function makePublicNightSummary(draft, attackedIds, deadIds, healedIds, immuneIds, bombExploded) {
  const lines = [];
  if (healedIds.length) lines.push(`Получили помощь и выжили: ${formatPlayers(healedIds)}.`);
  if (draft.night.kamikazeRedirect?.kamikaze) lines.push("Камикадзе был активирован этой ночью.");
  if (bombExploded) lines.push("Бомба взорвалась.");
  if (deadIds.length) lines.push(`Выбыли ночью: ${formatPlayers(deadIds)}.`);
  else lines.push("Ночью никто не выбыл.");
  return lines;
}

function sanitizePublicSummary(lines) {
  return (Array.isArray(lines) ? lines : []).filter((line) => !/дневн(ой|ый) иммунитет|иммунитет адвоката/i.test(line));
}

function applyWinCondition(draft) {
  const winner = detectWinner(draft);
  if (!winner) return false;
  draft.phase = "gameOver";
  draft.winner = winner;
  draft.timer.running = false;
  draft.timer.remainingSeconds = 0;
  draft.log = [`${phaseName(draft)}: победа ${winner}`, ...draft.log].slice(0, 80);
  return true;
}

function Icon({ name, label }) {
  const iconNode = window.lucide?.icons?.[name] || window.lucide?.[name];
  if (!iconNode) return h("span", { "aria-hidden": label ? undefined : "true" }, "");
  const renderNode = ([tag, attrs = {}, children = []], index = 0) => {
    const { class: className, ...svgAttrs } = attrs;
    const childNodes = Array.isArray(children) ? children : [];
    return h(
      tag,
      { ...svgAttrs, key: `${tag}-${index}`, className },
      ...childNodes.map((child, childIndex) => renderNode(child, childIndex))
    );
  };
  return h(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": label ? undefined : "true",
      "aria-label": label,
      role: label ? "img" : undefined
    },
    ...iconNode.map((node, index) => renderNode(node, index))
  );
}

function App() {
  const [state, setState] = useState(loadState);
  const [roleDrafts, setRoleDrafts] = useState(() => roleSlotsFromRoles(state.roles, state.playerCount));
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!state.timer.running) return undefined;
    const timerId = window.setInterval(() => {
      setState((current) => {
        if (!current.timer.running || current.timer.remainingSeconds <= 0) return current;
        const draft = structuredClone(current);
        draft.timer.remainingSeconds -= 1;
        if (draft.timer.remainingSeconds <= 0) {
          draft.timer.remainingSeconds = 0;
          draft.timer.running = false;
          if (draft.phase === "discussion") {
            draft.phase = "speeches";
            resetDayOrder(draft);
            draft.timer.remainingSeconds = draft.timer.speechSeconds;
            draft.speechesDone = {};
            draft.shootout = makeBlankState(draft.playerCount).shootout;
            draft.log = [`${phaseName(draft)}: Балаган завершен, начались речи`, ...draft.log].slice(0, 80);
          } else if (draft.phase === "speeches") {
            draft.log = [`${phaseName(draft)}: время игрока ${draft.timer.currentSpeaker} истекло`, ...draft.log].slice(0, 80);
          }
        }
        return draft;
      });
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [state.timer.running]);

  const aliveOptions = useMemo(
    () => state.players.map((player) => ({ id: player.id, label: `Игрок ${player.id}${player.alive ? "" : " (выбыл)"}` })),
    [state.players]
  );

  const addLog = (draft, text) => {
    draft.log = [`${phaseName(draft)}: ${text}`, ...draft.log].slice(0, 80);
  };

  const updateState = (updater) => {
    setState((current) => {
      const draft = structuredClone(current);
      updater(draft);
      return draft;
    });
  };

  const getPlayer = (draft, playerId) => draft.players.find((player) => player.id === Number(playerId));
  const rolesForPlayer = (playerId) => activeRoleDefs(state.playerCount).filter((role) => state.roles[role.key]?.includes(playerId));
  const isMafiaVisible = (playerId) => state.roles.don.includes(playerId) || state.roles.mafia.includes(playerId);
  const isSheriffBlack = (draft, playerId) => {
    const aliveIds = draft.players.filter((player) => player.alive).map((player) => player.id);
    const blackIds = [...draft.roles.don, ...draft.roles.mafia, ...(draft.roles.shield || [])];
    const aliveBlack = blackIds.some((id) => aliveIds.includes(id));
    return blackIds.includes(playerId) || (draft.roles.maniac.includes(playerId) && !aliveBlack);
  };

  const saveRoles = () => {
    updateState((draft) => {
      if (draft.rolesLocked) {
        addLog(draft, "роли закреплены, изменения закрыты");
        return;
      }
      const roles = parseRoleSlots(roleDrafts, draft.playerCount);
      const issues = validateRoles(roles, draft.playerCount);
      if (issues.length) {
        draft.rolesConfirmed = false;
        draft.rolesLocked = false;
        draft.setupError = issues.join("; ");
        return;
      }
      draft.roles = roles;
      draft.rolesConfirmed = true;
      draft.rolesLocked = true;
      draft.setupError = "";
      addLog(draft, "роли подтверждены");
    });
  };

  const updatePlayerCount = (value) => {
    const nextCount = clampPlayerCount(value);
    updateState((draft) => {
      if (draft.rolesLocked) return;
      draft.playerCount = nextCount;
      draft.players = createPlayers(nextCount).map((player) => draft.players.find((current) => current.id === player.id) || player);
      draft.roles = normalizeRoles(draft.roles, nextCount);
      draft.targetId = Math.min(draft.targetId, nextCount);
      draft.bombTargetIds = (draft.bombTargetIds || [1, 2, 3]).map((id) => Math.min(Number(id) || 1, nextCount));
      draft.kamikazeTargetId = Math.min(draft.kamikazeTargetId, nextCount);
      draft.voterId = Math.min(draft.voterId, nextCount);
      if (!availableActions(nextCount).some((action) => action.key === draft.activeAction)) {
        draft.activeAction = "mafia";
      }
      draft.rolesConfirmed = false;
      draft.setupError = "";
      draft.night = makeBlankState(nextCount).night;
    });
    setRoleDrafts((drafts) => roleSlotsFromRoles(normalizeRoles(parseRoleSlots(drafts, nextCount), nextCount), nextCount));
  };

  const setExclusive = (draft, field, targetId) => {
    draft.players.forEach((player) => {
      player[field] = player.id === targetId;
    });
  };

  const setHealedIds = (draft, ids) => {
    const nextIds = uniqueNumbers(ids).filter((id) => getPlayer(draft, id)?.alive);
    draft.players.forEach((player) => {
      player.healed = nextIds.includes(player.id);
    });
    draft.night.healed = nextIds.length > 1 ? nextIds : nextIds[0] || null;
  };

  const setManualShield = (draft, targetId, enabled) => {
    if (!enabled) {
      draft.night.shielded = null;
      draft.night.blockedActions = {};
      draft.players.forEach((item) => {
        item.shielded = false;
      });
      return;
    }
    setExclusive(draft, "shielded", targetId);
    if (draft.phase === "night") {
      draft.night.shielded = targetId;
      draft.night.blockedActions = {};
      NIGHT_ORDER.filter((key) => key !== "shield" && key !== "kamikaze" && isActionBlockedByShield(draft, key)).forEach((key) => {
        clearNightActionEffect(draft, key);
        draft.night.blockedActions[key] = targetId;
      });
    }
  };

  const setManualAlibi = (draft, targetId, enabled) => {
    draft.players.forEach((item) => {
      item.alibi = enabled && item.id === targetId;
    });
    if (draft.phase === "night") {
      draft.night.alibi = enabled ? targetId : null;
    }
  };

  const setNightCheck = (draft, by, target, result) => {
    draft.night.checks = draft.night.checks.filter((check) => check.by !== by);
    draft.night.checks.push({ by, target, result });
  };

  const clearKamikazeRedirectAction = (draft, actionKey) => {
    const redirect = draft.night.kamikazeRedirect;
    if (!redirect?.actions?.includes(actionKey)) return;
    const actions = redirect.actions.filter((key) => key !== actionKey);
    if (actions.length) {
      draft.night.kamikazeRedirect = { ...redirect, actions };
    } else {
      draft.night.kamikazeRedirect = null;
    }
  };

  const clearNightActionEffect = (draft, actionKey) => {
    if (actionKey === "mafia") {
      draft.night.mafiaTarget = null;
      clearKamikazeRedirectAction(draft, actionKey);
    }
    if (actionKey === "lovers") {
      draft.night.loversTarget = null;
      clearKamikazeRedirectAction(draft, actionKey);
    }
    if (actionKey === "maniac") {
      draft.night.maniacTarget = null;
      clearKamikazeRedirectAction(draft, actionKey);
    }
    if (actionKey === "doctor") {
      draft.night.healed = null;
      draft.players.forEach((player) => {
        player.healed = false;
      });
    }
    if (actionKey === "lawyer") {
      draft.night.alibi = null;
      draft.players.forEach((player) => {
        player.alibi = false;
      });
    }
    if (actionKey === "sheriff") {
      draft.night.sheriffShotTarget = null;
      draft.night.checks = draft.night.checks.filter((check) => check.by !== "Шериф");
    }
    if (actionKey === "don") draft.night.checks = draft.night.checks.filter((check) => check.by !== "Дон");
    if (actionKey === "shield") {
      draft.night.shielded = null;
      draft.night.blockedActions = {};
      draft.players.forEach((player) => {
        player.shielded = false;
      });
    }
    if (actionKey === "bomb") {
      const restoreTargets = Array.isArray(draft.night.previousBombed)
        ? draft.night.previousBombed
        : draft.players.filter((player) => player.bombed).map((player) => player.id);
      draft.night.bombed = [];
      draft.players.forEach((player) => {
        player.bombed = restoreTargets.includes(player.id);
      });
      draft.bombTargetIds = restoreTargets.length ? restoreTargets : draft.bombTargetIds;
    }
    if (actionKey === "kamikaze" && draft.night.kamikazeRedirect) {
      draft.night.kamikazeRedirect.target = null;
    }
  };

  const donRevengeTargets = (draft, donId) => {
    if (!draft.roles.don.includes(donId)) return [];
    return uniqueNumbers(draft.donSheriffFound || [])
      .filter((id) => draft.roles.sheriff.includes(id))
      .filter((sheriffId) => getPlayer(draft, sheriffId)?.alive);
  };

  const applyDonRevenge = (draft, donId) => {
    const taken = donRevengeTargets(draft, donId);
    taken.forEach((sheriffId) => killPlayer(draft, sheriffId, "дон"));
    return taken;
  };

  const killPlayer = (draft, playerId, reason) => {
    const player = getPlayer(draft, playerId);
    if (!player || !player.alive) return;
    player.alive = false;
    player.deathReason = reason;
    addLog(draft, `игрок ${playerId} выбыл: ${reason}`);

    if (draft.roles.bomber.includes(playerId)) {
      draft.players
        .filter((item) => item.bombed && item.alive && item.id !== playerId)
        .forEach((item) => killPlayer(draft, item.id, "бомба"));
    }

    if (draft.roles.lover.includes(playerId)) {
      draft.roles.lover
        .filter((id) => id !== playerId)
        .forEach((loverId) => {
          const lover = getPlayer(draft, loverId);
          if (lover?.alive) killPlayer(draft, loverId, "любовники");
        });
    }

    if (draft.roles.don.includes(playerId)) applyDonRevenge(draft, playerId);
  };

  const applyAction = () => {
    updateState((draft) => {
      if (!canUseNightActions(draft)) {
        addLog(draft, "ночные действия пока недоступны");
        return;
      }
      const action = availableNightActions(draft).some((item) => item.key === draft.activeAction) ? draft.activeAction : nextNightActionKey(draft);
      draft.activeAction = action;
      if (!availableNightActions(draft).some((item) => item.key === action)) {
        addLog(draft, "эта роль недоступна или уже выбыла");
        return;
      }
      let targetId = Number(draft.targetId);
      if (action === "doctor") {
        const unavailable = new Set([...lastHealedIds(draft), ...healedIds(draft)]);
        const doctorTargets = draft.players.filter((player) => player.alive && !unavailable.has(player.id)).map((player) => player.id);
        if (!doctorTargets.includes(targetId)) targetId = doctorTargets[0] || targetId;
        draft.targetId = targetId;
      }
      if (action === "sheriff" && draft.sheriffActionMode === "shoot") {
        const knownTargets = aliveKnownSheriffMafia(draft);
        if (!knownTargets.includes(targetId)) targetId = knownTargets[0] || targetId;
        draft.targetId = targetId;
      }
      if (action !== "bomb") {
        const aliveTargets = draft.players.filter((player) => player.alive).map((player) => player.id);
        if (!aliveTargets.includes(targetId)) {
          targetId = aliveTargets[0] || targetId;
          draft.targetId = targetId;
        }
      }
      const target = getPlayer(draft, targetId);
      if (action !== "bomb" && (!target || !target.alive)) {
        addLog(draft, "Выберите живого игрока для действия.");
        return;
      }
      if (!draft.night.blockedActions || typeof draft.night.blockedActions !== "object") draft.night.blockedActions = {};
      delete draft.night.blockedActions[action];

      if (action === "kamikaze") {
        const redirect = draft.night.kamikazeRedirect;
        if (!redirect?.kamikaze) {
          addLog(draft, "камикадзе не был целью этой ночью");
          return;
        }
        redirect.target = targetId;
        (redirect.actions || []).forEach((attackAction) => {
          draft.night[`${attackAction}Target`] = targetId;
        });
        addLog(draft, `камикадзе ${redirect.kamikaze} перевел удар на игрока ${targetId}`);
        draft.activeAction = nextNightActionKey(draft, action);
        return;
      }

      if (action !== "shield" && isActionBlockedByShield(draft, action)) {
        draft.night.blockedActions[action] = draft.night.shielded;
        clearNightActionEffect(draft, action);
        addLog(draft, `щит заблокировал действие "${actionName(action)}" игрока ${draft.night.shielded}`);
        draft.activeAction = nextNightActionKey(draft, action);
        return;
      }

      if (draft.roles.kamikaze.includes(targetId) && ["mafia", "lovers", "maniac"].includes(action)) {
        clearKamikazeRedirectAction(draft, action);
        draft.night[`${action}Target`] = targetId;
        if (draft.night.kamikazeRedirect) {
          if (!draft.night.kamikazeRedirect.actions.includes(action)) draft.night.kamikazeRedirect.actions.push(action);
          addLog(draft, `камикадзе ${targetId}: повторный удар ждет выбора камикадзе`);
        } else {
          draft.night.kamikazeRedirect = { kamikaze: targetId, target: null, actions: [action] };
          addLog(draft, `камикадзе ${targetId} был выбран целью`);
        }
        draft.activeAction = nextNightActionKey(draft, action);
        return;
      }

      if (action === "mafia") {
        clearKamikazeRedirectAction(draft, action);
        draft.night.mafiaTarget = targetId;
      }
      if (action === "lovers") {
        clearKamikazeRedirectAction(draft, action);
        draft.night.loversTarget = targetId;
      }
      if (action === "maniac") {
        clearKamikazeRedirectAction(draft, action);
        draft.night.maniacTarget = targetId;
      }
      if (action === "doctor") {
        const previousHeals = lastHealedIds(draft);
        const currentHeals = healedIds(draft);
        const healLimit = doctorRequiredHeals(draft);
        if (previousHeals.includes(targetId)) {
          addLog(draft, `врач не может лечить игрока ${targetId} две ночи подряд`);
          return;
        }
        if (currentHeals.includes(targetId)) {
          addLog(draft, `врач уже выбрал игрока ${targetId} этой ночью`);
          return;
        }
        if (currentHeals.length >= healLimit) {
          addLog(draft, healLimit > 1 ? "врач уже выбрал двух игроков этой ночью" : "врач уже выбрал цель этой ночью");
          return;
        }
        const nextHeals = [...currentHeals, targetId].slice(0, healLimit);
        draft.players.forEach((player) => {
          player.healed = nextHeals.includes(player.id);
        });
        draft.night.healed = healLimit === 1 ? targetId : nextHeals;
      }
      if (action === "lawyer") {
        setExclusive(draft, "alibi", targetId);
        draft.night.alibi = targetId;
      }
      if (action === "shield") {
        setExclusive(draft, "shielded", targetId);
        draft.night.shielded = targetId;
        draft.night.blockedActions = {};
        NIGHT_ORDER.filter((key) => key !== "shield" && key !== "kamikaze" && isActionBlockedByShield(draft, key)).forEach((key) => {
          clearNightActionEffect(draft, key);
          draft.night.blockedActions[key] = targetId;
        });
      }
      if (action === "bomb") {
        const requiredBombTargets = bombRequiredTargetCount(draft);
        const bombTargets = resolveBombTargets(draft);
        if (bombTargets.length !== requiredBombTargets) {
          addLog(draft, `Бомбочка должна выбрать ${requiredBombTargets} цели.`);
          return;
        }
        draft.night.previousBombed = draft.players.filter((player) => player.bombed).map((player) => player.id);
        draft.players.forEach((player) => {
          player.bombed = bombTargets.includes(player.id);
        });
        draft.bombTargetIds = bombTargets;
        draft.night.bombed = bombTargets;
      }
      if (action === "sheriff") {
        if (draft.sheriffActionMode === "shoot") {
          const knownTargets = aliveKnownSheriffMafia(draft);
          if (!knownTargets.includes(targetId)) {
            addLog(draft, "шериф может стрелять только в найденную живую мафию");
            return;
          }
          draft.night.sheriffShotTarget = targetId;
          draft.night.checks = draft.night.checks.filter((check) => check.by !== "Шериф");
          addLog(draft, `Шериф выбрал выстрел по игроку ${targetId}`);
        } else {
        const black = isSheriffBlack(draft, targetId);
        setNightCheck(draft, "Шериф", targetId, black ? "черный" : "красный");
        addLog(draft, `Шериф проверил игрока ${targetId}: ${black ? "черный" : "красный"}`);
          if (black) draft.sheriffMafiaFound = uniqueNumbers([...(draft.sheriffMafiaFound || []), targetId]);
        }
      }
      if (action === "don") {
        const sheriff = draft.roles.sheriff.includes(targetId);
        setNightCheck(draft, "Дон", targetId, sheriff ? "шериф" : "не шериф");
        addLog(draft, `Дон проверил игрока ${targetId}: ${sheriff ? "шериф" : "не шериф"}`);
        if (sheriff) draft.donSheriffFound = uniqueNumbers([...(draft.donSheriffFound || []), targetId]);
      }
      addLog(draft, `${actionName(action)}: игрок ${targetId}`);
      draft.activeAction = isNightActionDone(draft, action) ? nextNightActionKey(draft, action) : action;
    });
  };

  const clearCurrentNightAction = () => {
    updateState((draft) => {
      if (draft.phase !== "night") return;
      const action = availableNightActions(draft).some((item) => item.key === draft.activeAction) ? draft.activeAction : nextNightActionKey(draft);
      clearNightActionEffect(draft, action);
      draft.activeAction = action;
      addLog(draft, `${actionName(action)}: действие очищено`);
    });
  };

  const applyMark = (playerId) => {
    updateState((draft) => {
      if (draft.phase === "gameOver") return;
      const player = getPlayer(draft, playerId);
      if (!player || !draft.activeMark) return;
      if (draft.activeMark === "dead" && draft.shootout?.active) {
        addLog(draft, "завершите перестрелку перед ручным выбытием");
        return;
      }
      if (draft.activeMark === "dead") killPlayer(draft, player.id, "ручная отметка");
      if (draft.activeMark === "shield") setManualShield(draft, player.id, !player.shielded);
      if (draft.activeMark === "bomb") player.bombed = !player.bombed;
      if (draft.activeMark === "heal") {
        if (draft.phase === "night") {
          const currentHeals = healedIds(draft);
          setHealedIds(draft, player.healed ? currentHeals.filter((id) => id !== player.id) : [...currentHeals, player.id]);
        } else {
          player.healed = !player.healed;
        }
      }
      if (draft.activeMark === "alibi") setManualAlibi(draft, player.id, !player.alibi);
      const labels = { dead: "выбыл", shield: "щит", bomb: "бомба", heal: "лечение", alibi: "алиби" };
      addLog(draft, `игрок ${player.id}: ${labels[draft.activeMark]}`);
      if (draft.activeMark === "dead" && applyWinCondition(draft)) {
        draft.activeMark = null;
      }
    });
  };

  const nextPhase = () => {
    updateState((draft) => {
      if (draft.phase === "gameOver") return;
      draft.timer.running = false;
      if (draft.phase === "introNight") {
        if (!draft.rolesConfirmed) {
          addLog(draft, "Сначала подтвердите роли.");
          return;
        }
        draft.phase = "discussion";
        draft.dayNumber = 1;
        draft.timer.remainingSeconds = draft.timer.discussionMinutes * 60;
        addLog(draft, "начался первый Балаган");
        return;
      }

      if (draft.phase === "discussion") {
        draft.phase = "speeches";
        draft.timer.remainingSeconds = draft.timer.speechSeconds;
        resetDayOrder(draft);
        draft.speechesDone = {};
        draft.lastWordsDone = {};
        draft.dayResult = null;
        draft.shootout = makeBlankState(draft.playerCount).shootout;
        addLog(draft, "начались речи игроков");
        return;
      }

      if (draft.phase === "speeches") {
        const aliveIds = draft.players.filter((player) => player.alive).map((player) => player.id);
        const missingSpeeches = aliveIds.filter((id) => !draft.speechesDone?.[id]);
        if (!hasDayVoting(draft) && missingSpeeches.length) {
          addLog(draft, `Не все игроки завершили речь: ${missingSpeeches.join(", ")}.`);
          return;
        }
        const missingVotes = aliveIds.filter((id) => !draft.votes[id]);
        if (hasDayVoting(draft) && missingVotes.length) {
          addLog(draft, `Не все игроки проголосовали: ${missingVotes.join(", ")}.`);
          return;
        }
        if (hasDayVoting(draft) && !draft.dayEliminationDone) {
          if (draft.shootout.active) {
            addLog(draft, "Сначала завершите перестрелку.");
            return;
          }
          const isAliveTarget = (targetId) => Boolean(getPlayer(draft, targetId)?.alive);
          const activeVotes = Object.fromEntries(
            Object.entries(draft.votes).filter(([voterId, targetId]) => {
              const voter = getPlayer(draft, voterId);
              const target = getPlayer(draft, targetId);
              return voter?.alive && target?.alive;
            })
          );
          const leaders = voteLeaders(activeVotes, draft.foulVotes, isAliveTarget);
          if (leaders.length > 1) {
            draft.shootout = {
              active: true,
              tied: leaders,
              number: null,
              called: [],
              guesses: {},
              calledBy: {},
              roundShots: [],
              turnOrder: [],
              currentPlayer: leaders[0] || null
            };
            addLog(draft, `перестрелка: игроки ${leaders.join(", ")}, выберите секретное число`);
            return;
          }
          if (leaders.length === 1) {
            const votedOut = leaders[0];
            const player = getPlayer(draft, votedOut);
            if (player?.alibi) {
              addLog(draft, `игрок ${votedOut} остался в игре: у него было алиби`);
              draft.publicNightSummary = [`По итогам голосования игрок ${votedOut} остается в игре: у него было алиби.`];
              draft.dayResult = {
                type: "alibi",
                playerId: votedOut,
                message: `Игрок ${votedOut} набрал больше всего голосов, но остается в игре: у него было алиби.`
              };
              draft.lastWordsDone = {};
              draft.dayEliminationDone = true;
            } else {
              const role = roleSummaryForPlayer(draft, votedOut);
              const aliveBeforeVote = new Set(draft.players.filter((playerItem) => playerItem.alive).map((playerItem) => playerItem.id));
              const donTook = donRevengeTargets(draft, votedOut);
              addLog(draft, `роль игрока ${votedOut}: ${role}`);
              killPlayer(draft, votedOut, "голосование");
              const aliveAfterVote = new Set(draft.players.filter((playerItem) => playerItem.alive).map((playerItem) => playerItem.id));
              const deaths = makeDeathDetails(draft, aliveBeforeVote, aliveAfterVote);
              const lastWordsRequired = deaths.filter((death) => death.finalSpeech).map((death) => death.id);
              draft.dayResult = {
                type: "eliminated",
                playerId: votedOut,
                role,
                deaths,
                lastWordsRequired,
                message: `По итогам голосования выбывает игрок ${votedOut}. Роль: ${role}.${donTook.length ? ` Дон забирает за собой: ${formatPlayers(donTook)}.` : ""}${deaths.length > 1 ? ` Дополнительно выбыли: ${formatDeathDetails(deaths.filter((death) => death.id !== votedOut))}.` : ""}`
              };
              draft.lastWordsDone = {};
              draft.dayEliminationDone = true;
              if (applyWinCondition(draft)) return;
            }
          }
        }
        if (!hasDayVoting(draft)) {
          draft.dayResult = {
            type: "noVote",
            message: "В первый день голосования нет. И наступает ночь."
          };
          draft.lastWordsDone = {};
        } else if (!draft.dayResult) {
          draft.dayResult = {
            type: "none",
            message: "Голосование завершено. Никто не выбыл."
          };
          draft.lastWordsDone = {};
        }
        draft.phase = "voteResults";
        draft.timer.remainingSeconds = 0;
        draft.timer.running = false;
        addLog(draft, "ведущий объявляет итоги голосования");
        return;
      }

      if (draft.phase === "voteResults") {
        const pendingLastWords = finalSpeechRequiredIds(draft);
        if (pendingLastWords.length) {
          addLog(draft, `Последняя речь ещё нужна игрокам: ${pendingLastWords.join(", ")}.`);
          return;
        }
        draft.phase = "night";
        draft.nightNumber = draft.dayNumber + 1;
        draft.players.forEach((player) => {
          player.alibi = false;
        });
        draft.timer.remainingSeconds = 0;
        draft.timer.running = false;
        draft.targetId = draft.players.find((player) => player.alive)?.id || draft.targetId;
        draft.activeAction = nextNightActionKey(draft);
        addLog(draft, `началась ночь ${draft.nightNumber}`);
        return;
      }

      if (draft.phase === "night") {
        const missing = incompleteNightActions(draft);
        if (missing.length) {
          addLog(draft, `Ночные действия ещё не завершены: ${missing.map(([key, label]) => NIGHT_PENDING_TEXT[key] || label).join(" ")}`);
          return;
        }
        const nightSourceMap = {};
        const addNightSource = (targetId, label) => {
          if (!targetId) return;
          nightSourceMap[targetId] = nightSourceMap[targetId] ? `${nightSourceMap[targetId]} ${label}` : label;
        };
        addNightSource(draft.night.mafiaTarget, "Мафия выбрала этого игрока для выстрела.");
        addNightSource(draft.night.loversTarget, "Любовники выбрали этого игрока для выстрела.");
        addNightSource(draft.night.maniacTarget, "Маньяк выбрал этого игрока для убийства.");
        addNightSource(draft.night.sheriffShotTarget, "Шериф стрелял в ранее найденного чёрного игрока.");
        const victims = uniqueNumbers([draft.night.mafiaTarget, draft.night.loversTarget, draft.night.maniacTarget, draft.night.sheriffShotTarget]);
        const aliveBeforeNight = new Set(draft.players.filter((player) => player.alive).map((player) => player.id));
        const doctorSavedIds = healedIds(draft);
        const savedByDoctor = victims.filter((id) => doctorSavedIds.includes(id));
        victims.forEach((id) => {
          if (!doctorSavedIds.includes(id)) killPlayer(draft, id, "ночь");
          else addLog(draft, `врач спас игрока ${id}`);
        });
        const aliveAfterNight = new Set(draft.players.filter((player) => player.alive).map((player) => player.id));
        const deadThisNight = [...aliveBeforeNight].filter((id) => !aliveAfterNight.has(id));
        const bombExploded = deadThisNight.some((id) => draft.roles.bomber.includes(id));
        const lastHealed = doctorSavedIds;
        draft.nightResultDeaths = makeDeathDetails(draft, aliveBeforeNight, aliveAfterNight, nightSourceMap);
        draft.publicNightSummary = makePublicNightSummary(
          draft,
          victims,
          deadThisNight,
          savedByDoctor,
          draft.night.alibi ? [draft.night.alibi] : [],
          bombExploded
        );
        if (applyWinCondition(draft)) return;
        draft.players.forEach((player) => {
          player.healed = false;
          player.shielded = false;
        });
        draft.night = makeBlankState(draft.playerCount).night;
        draft.night.lastHealed = lastHealed;
        draft.nominations = [];
        draft.votes = {};
        draft.foulVotes = {};
        draft.speechesDone = {};
        draft.lastWordsDone = {};
        draft.dayEliminationDone = false;
        draft.dayResult = null;
        draft.shootout = makeBlankState(draft.playerCount).shootout;
        draft.phase = "discussion";
        draft.dayNumber += 1;
        draft.timer.remainingSeconds = draft.timer.discussionMinutes * 60;
        addLog(draft, `начался Балаган дня ${draft.dayNumber}`);
      }
    });
  };

  const markLastWordsDone = (playerId) => {
    updateState((draft) => {
      if (draft.phase !== "voteResults") return;
      const id = Number(playerId);
      if (!finalSpeechRequiredIds(draft).includes(id)) return;
      draft.lastWordsDone[id] = true;
      addLog(draft, `игрок ${id} сказал последнюю речь`);
    });
  };

  const addNomination = (playerId) => {
    updateState((draft) => {
      if (draft.phase !== "speeches") return;
      const targetId = Number(playerId || draft.targetId);
      const target = getPlayer(draft, targetId);
      if (!target?.alive) return;
      if (!draft.nominations.includes(targetId)) {
        draft.nominations.push(targetId);
        addLog(draft, `номинирован игрок ${targetId}`);
      }
    });
  };

  const castVote = (voterValue, targetValue) => {
    updateState((draft) => {
      if (draft.phase !== "speeches") return;
      const voterId = Number(voterValue || draft.voterId);
      const targetId = Number(targetValue || draft.targetId);
      const voter = getPlayer(draft, voterId);
      const target = getPlayer(draft, targetId);
      if (!voter?.alive || !target?.alive) return;
      if (!draft.nominations.includes(targetId)) draft.nominations.push(targetId);
      draft.votes[voterId] = targetId;
      draft.speechesDone[voterId] = true;
      addLog(draft, `игрок ${voterId} голосует за ${targetId}`);
    });
  };

  const updateFoulVote = (targetValue, delta) => {
    updateState((draft) => {
      if (draft.phase !== "speeches" || !hasDayVoting(draft) || draft.dayEliminationDone || draft.shootout?.active) return;
      const targetId = Number(targetValue);
      const target = getPlayer(draft, targetId);
      if (!target?.alive) return;
      const current = Math.max(0, Number(draft.foulVotes?.[targetId]) || 0);
      const next = Math.max(0, current + Number(delta));
      if (!draft.foulVotes || typeof draft.foulVotes !== "object") draft.foulVotes = {};
      if (next) draft.foulVotes[targetId] = next;
      else delete draft.foulVotes[targetId];
      if (!draft.nominations.includes(targetId)) draft.nominations.push(targetId);
      addLog(draft, next > current ? `фол: игрок ${targetId} получает штрафной голос` : `фол: штрафной голос игрока ${targetId} снят`);
    });
  };

  const setShootoutNumber = (number) => {
    updateState((draft) => {
      if (!draft.shootout.active) return;
      draft.shootout.number = Number(number) || null;
      draft.shootout.called = [];
      draft.shootout.guesses = {};
      draft.shootout.calledBy = {};
      draft.shootout.roundShots = [];
      draft.shootout.turnOrder = [];
      draft.shootout.currentPlayer = draft.shootout.tied[0] || null;
      if (draft.shootout.number) addLog(draft, `перестрелка: секретное число ${draft.shootout.number}`);
    });
  };

  const setShootoutPlayer = (playerId) => {
    updateState((draft) => {
      const nextPlayer = Number(playerId);
      if (!draft.shootout.active || !draft.shootout.tied.includes(nextPlayer)) return;
      if ((draft.shootout.roundShots || []).includes(nextPlayer)) {
        addLog(draft, `перестрелка: игрок ${nextPlayer} уже стрелял в этом круге`);
        return;
      }
      draft.shootout.currentPlayer = nextPlayer;
      addLog(draft, `перестрелка: ход игрока ${nextPlayer}`);
    });
  };

  const recordShootoutGuess = (playerId, guess) => {
    updateState((draft) => {
      if (!draft.shootout.active || !draft.shootout.tied.includes(playerId)) return;
      if (draft.shootout.currentPlayer && draft.shootout.currentPlayer !== playerId) {
        addLog(draft, `сейчас ход игрока ${draft.shootout.currentPlayer}`);
        return;
      }
      if (!draft.shootout.number) {
        addLog(draft, "Сначала выберите секретное число для перестрелки.");
        return;
      }
      const player = getPlayer(draft, playerId);
      if (!player?.alive) return;
      if ((draft.shootout.roundShots || []).includes(playerId)) {
        addLog(draft, `перестрелка: игрок ${playerId} уже стрелял в этом круге`);
        return;
      }
      const number = Number(guess);
      if (!draft.shootout.called.includes(number)) draft.shootout.called.push(number);
      draft.shootout.calledBy[number] = playerId;
      draft.shootout.guesses[playerId] = number;
      if (!(draft.shootout.turnOrder || []).includes(playerId)) {
        draft.shootout.turnOrder = [...(draft.shootout.turnOrder || []), playerId];
      }
      addLog(draft, `перестрелка: игрок ${playerId} назвал ${number}`);
      if (number !== draft.shootout.number) {
        draft.shootout.roundShots = [...(draft.shootout.roundShots || []), playerId];
        const savedOrder = (draft.shootout.turnOrder || []).filter((id, index, list) => (draft.shootout.tied || []).includes(id) && list.indexOf(id) === index);
        let tied = savedOrder.concat((draft.shootout.tied || []).filter((id) => !savedOrder.includes(id)));
        let available = tied.filter((id) => !(draft.shootout.roundShots || []).includes(id));
        if (!available.length) {
          draft.shootout.roundShots = [];
          available = tied;
          addLog(draft, "перестрелка: новый круг");
        }
        const currentIndex = tied.indexOf(playerId);
        draft.shootout.currentPlayer = tied.slice(currentIndex + 1).concat(tied.slice(0, currentIndex + 1)).find((id) => available.includes(id)) || available[0] || playerId;
        return;
      }
      const role = roleSummaryForPlayer(draft, playerId);
      const aliveBeforeShootout = new Set(draft.players.filter((playerItem) => playerItem.alive).map((playerItem) => playerItem.id));
      const donTook = donRevengeTargets(draft, playerId);
      addLog(draft, `роль игрока ${playerId}: ${role}`);
      killPlayer(draft, playerId, "перестрелка");
      const aliveAfterShootout = new Set(draft.players.filter((playerItem) => playerItem.alive).map((playerItem) => playerItem.id));
      const deaths = makeDeathDetails(draft, aliveBeforeShootout, aliveAfterShootout);
      const lastWordsRequired = deaths.filter((death) => death.finalSpeech).map((death) => death.id);
      draft.dayResult = {
        type: "shootout",
        playerId,
        role,
        deaths,
        lastWordsRequired,
        message: `После перестрелки выбывает игрок ${playerId}. Роль: ${role}.${donTook.length ? ` Дон забирает за собой: ${formatPlayers(donTook)}.` : ""}${deaths.length > 1 ? ` Дополнительно выбыли: ${formatDeathDetails(deaths.filter((death) => death.id !== playerId))}.` : ""}`
      };
      draft.lastWordsDone = {};
      draft.dayEliminationDone = true;
      draft.shootout.active = false;
      draft.shootout.tied = [];
      draft.shootout.roundShots = [];
      draft.shootout.turnOrder = [];
      draft.shootout.currentPlayer = null;
      if (applyWinCondition(draft)) return;
    });
  };

  const updateTimerSetting = (field, value) => {
    updateState((draft) => {
      const number = Math.max(1, Number(value) || 1);
      draft.timer[field] = number;
      if (draft.phase === "discussion" && field === "discussionMinutes" && !draft.timer.running) {
        draft.timer.remainingSeconds = number * 60;
      }
      if (draft.phase === "speeches" && field === "speechSeconds" && !draft.timer.running) {
        draft.timer.remainingSeconds = number;
      }
    });
  };

  const toggleTimer = () => {
    updateState((draft) => {
      if (!["discussion", "speeches"].includes(draft.phase)) return;
      if (draft.timer.remainingSeconds <= 0) {
        draft.timer.remainingSeconds = draft.phase === "discussion" ? draft.timer.discussionMinutes * 60 : draft.timer.speechSeconds;
      }
      draft.timer.running = !draft.timer.running;
    });
  };

  const resetTimer = () => {
    updateState((draft) => {
      draft.timer.running = false;
      draft.timer.remainingSeconds = draft.phase === "discussion" ? draft.timer.discussionMinutes * 60 : draft.phase === "speeches" ? draft.timer.speechSeconds : 0;
    });
  };

  const nextSpeaker = () => {
    updateState((draft) => {
      if (draft.phase !== "speeches") return;
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
    });
  };

  const updateDayOrder = (field, value) => {
    updateState((draft) => {
      if (draft.phase !== "speeches") return;
      if (field === "dayStartPlayerId") {
        const selectedId = Number(value);
        if (!draft.players.some((player) => player.id === selectedId && player.alive)) return;
        draft.dayStartPlayerId = selectedId;
        draft.timer.currentSpeaker = resolveCurrentDaySpeaker(draft, selectedId);
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

  const resetGame = () => {
    const currentRoles = state.rolesLocked
      ? structuredClone(state.roles)
      : parseRoleSlots(roleDrafts, state.playerCount);
    const blank = makeBlankState(state.playerCount);
    blank.roles = normalizeRoles(currentRoles, state.playerCount);
    blank.rolesLocked = false;
    blank.rolesConfirmed = false;
    blank.setupError = "";
    blank.winner = null;
    blank.speechesDone = {};
    blank.lastWordsDone = {};
    blank.foulVotes = {};
    blank.publicNightSummary = [];
    blank.nightResultDeaths = [];
    blank.dayResult = null;
    blank.dayEliminationDone = false;
    blank.shootout = makeBlankState(state.playerCount).shootout;
    blank.log = [`${phaseName(blank)}: новая партия, роли сохранены`];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blank));
    setState(blank);
    setRoleDrafts(roleSlotsFromRoles(blank.roles, blank.playerCount));
  };

  const selectPlayer = (playerId) => {
    if (state.phase === "gameOver") return;
    if (!state.players.some((player) => player.id === playerId && player.alive)) return;
    if (state.activeMark) applyMark(playerId);
    else updateState((draft) => {
      draft.targetId = playerId;
    });
  };

  const blockReason = phaseBlockReason(state, roleDrafts);
  const confirmConfig = confirmAction === "nextPhase"
    ? {
        title: "Перейти к следующей фазе?",
        body: `Текущая фаза: ${phaseName(state)}. Проверьте, что ведущий объявил все нужные результаты.`,
        confirmText: "Перейти",
        action: () => {
          setConfirmAction(null);
          nextPhase();
        }
      }
    : confirmAction === "reset"
      ? {
          title: "Сбросить партию?",
          body: "Текущая партия, голоса, метки и ночные действия будут очищены. Роли останутся в полях настройки.",
          confirmText: "Сбросить",
          danger: true,
          action: () => {
            setConfirmAction(null);
            resetGame();
          }
        }
      : null;

  return h(
    "main",
    { className: "app" },
    h(
      "header",
      { className: "topbar" },
      h("div", { className: `phase-hero phase-${state.phase}` }, h("span", null, state.phase === "night" || state.phase === "introNight" ? "Ночь" : state.phase === "gameOver" ? "Итог" : "День"), h("h1", { className: "phase-label" }, phaseName(state))),
      h(
        "div",
        { className: "top-actions-wrap" },
        h(
          "div",
          { className: "top-actions" },
          h("button", { type: "button", className: "icon-text", onClick: () => setConfirmAction("nextPhase"), disabled: Boolean(blockReason), title: blockReason || "Следующая фаза", "aria-label": "Следующая фаза", "data-testid": "next-phase" }, h("span", null, "→"), h("span", null, "Следующая фаза")),
          h("button", { type: "button", className: "icon-text muted", onClick: () => setConfirmAction("reset"), title: "Сбросить партию", "aria-label": "Сбросить партию", "data-testid": "reset-game" }, h("span", null, "↺"), h("span", null, "Сброс"))
        ),
        blockReason && h("p", { className: "phase-block-reason", "data-testid": "phase-block-reason" }, blockReason)
      )
    ),
    h("section", { className: "role-strip", "aria-label": "Роли" }, h("div", { className: "role-grid" }, activeRoleDefs(state.playerCount).map((role) => h(RolePill, { key: role.key, role, players: state.roles[role.key] })))),
    h(
      "section",
      { className: `workspace ${state.phase === "introNight" ? "" : "game-workspace"}` },
      state.phase === "introNight" && h(RolePanel, { state, roleDrafts, setRoleDrafts, saveRoles, updatePlayerCount, clearRolesConfirmed: () => updateState((draft) => { draft.rolesConfirmed = false; draft.rolesLocked = false; }) }),
      h(MainColumn, { state, aliveOptions, updateState, castVote, updateFoulVote, setShootoutNumber, setShootoutPlayer, recordShootoutGuess, nextSpeaker, updateDayOrder, markLastWordsDone, selectPlayer, setView: (view) => updateState((draft) => { draft.view = view; }), rolesForPlayer, isMafiaVisible }),
      h(ActionPanel, { state, aliveOptions, updateState, applyAction, clearCurrentNightAction, updateTimerSetting, toggleTimer, resetTimer })
    ),
    confirmConfig && h(ConfirmModal, { config: confirmConfig, onCancel: () => setConfirmAction(null) })
  );
}

function ConfirmModal({ config, onCancel }) {
  return h(
    "div",
    { className: "modal-backdrop", role: "presentation" },
    h(
      "div",
      { className: "confirm-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "confirm-title" },
      h("h2", { id: "confirm-title" }, config.title),
      h("p", null, config.body),
      h(
        "div",
        { className: "modal-actions" },
        h("button", { type: "button", className: "muted", onClick: onCancel }, "Отмена"),
        h("button", { type: "button", className: config.danger ? "danger-action" : "primary-action", onClick: config.action }, config.confirmText)
      )
    )
  );
}

function RolePill({ role, players }) {
  return h(
    "div",
    { className: `role-pill role-${role.key}` },
    h("strong", null, h("span", { className: "role-icon", "aria-hidden": "true" }, h(Icon, { name: role.icon })), role.name),
    h("span", null, players?.length ? players.join(", ") : "нет")
  );
}

function RolePanel({ state, roleDrafts, setRoleDrafts, saveRoles, updatePlayerCount, clearRolesConfirmed }) {
  const visibleRoles = activeRoleDefs(state.playerCount);
  const liveRoleIssues = state.rolesLocked ? [] : validateRoles(parseRoleSlots(roleDrafts, state.playerCount), state.playerCount);
  const roleError = state.setupError || liveRoleIssues.join("; ");
  return h(
    "aside",
    { className: "panel setup-panel" },
    h(
      "div",
      { className: "panel-head" },
      h("h2", null, "Роли"),
      h(
        "div",
        { className: "role-actions" },
        h("button", { type: "button", onClick: saveRoles, disabled: state.rolesLocked, title: "Подтвердить роли", "data-testid": "confirm-roles" }, "✓")
      )
    ),
    h(
      "label",
      { className: "player-count-field" },
      h("span", null, "Игроков"),
      h("input", {
        type: "number",
        min: String(MIN_PLAYERS),
        max: String(MAX_PLAYERS),
        inputMode: "numeric",
        value: state.playerCount,
        disabled: state.rolesLocked,
        onChange: (event) => updatePlayerCount(event.target.value)
      })
    ),
    h(
      "p",
      { className: `role-lock-note ${state.rolesConfirmed ? "confirmed" : ""}` },
      state.rolesLocked
        ? "Роли подтверждены и закреплены до конца игры."
        : state.phase === "introNight" && state.rolesConfirmed
          ? "Роли подтверждены. Можно начинать игру."
          : state.phase === "introNight"
            ? "Подтвердите роли перед началом игры."
            : state.rolesConfirmed
              ? "Роли подтверждены. Можно закрепить роли до конца игры."
              : "Роли изменены. Подтвердите их снова."
    ),
    roleError && h("p", { className: "setup-error" }, roleError),
    h(
      "div",
      { className: "role-editors" },
      visibleRoles.map((role) =>
        h(
          "div",
          { className: "role-row", key: role.key },
          h("label", null, role.name),
          h(
            "div",
            { className: `role-slot-grid slots-${getRoleSlotCount(role, state.playerCount)}` },
            Array.from({ length: getRoleSlotCount(role, state.playerCount) }, (_, index) =>
              h("input", {
                key: `${role.key}-${index}`,
                "aria-label": `${role.name} ${index + 1}`,
                inputMode: "numeric",
                pattern: "[0-9]*",
                maxLength: 2,
                disabled: state.rolesLocked,
                value: roleDrafts[role.key]?.[index] || "",
                onChange: (event) => {
                  const nextValue = sanitizeDigits(event.target.value);
                  if (state.rolesConfirmed) {
                    clearRolesConfirmed();
                  }
                  setRoleDrafts((drafts) => {
                    const nextSlots = [...(drafts[role.key] || [])];
                    nextSlots[index] = nextValue;
                    return { ...drafts, [role.key]: nextSlots };
                  });
                }
              })
            )
          )
        )
      )
    )
  );
}

function MainColumn({ state, aliveOptions, updateState, castVote, updateFoulVote, setShootoutNumber, setShootoutPlayer, recordShootoutGuess, nextSpeaker, updateDayOrder, markLastWordsDone, selectPlayer, setView, rolesForPlayer, isMafiaVisible }) {
  const publicSummaryLines = sanitizePublicSummary(state.publicNightSummary);
  return h(
    "section",
    { className: "main-column" },
    state.phase === "gameOver" && h(GameOverHero, { state }),
    state.phase === "discussion" && publicSummaryLines.length > 0 && h(NightResultsCard, { state, lines: publicSummaryLines }),
    state.phase === "speeches" && h(DayFlowCard, { state, aliveOptions, castVote, updateFoulVote, setShootoutNumber, setShootoutPlayer, recordShootoutGuess, nextSpeaker, updateDayOrder }),
    state.phase === "voteResults" && h(VoteResultsCard, { state, markLastWordsDone }),
    h(LogBox, { state, updateState }),
    h(Board, { state, updateState, setView, selectPlayer, rolesForPlayer, isMafiaVisible })
  );
}

function GameOverHero({ state }) {
  const alivePlayers = state.players.filter((player) => player.alive);
  const deadPlayers = state.players.filter((player) => !player.alive);
  return h(
    "section",
    { className: `game-over-hero winner-${state.winner || "none"}` },
    h("div", { className: "game-over-emblem" }, h(Icon, { name: state.winner === "Мирные" ? "Sun" : state.winner === "Маньяк" ? "Swords" : "Crown" })),
    h("div", { className: "game-over-copy" }, h("span", null, "Партия завершена"), h("h2", null, `Победа: ${state.winner || "не определена"}`), h("p", null, alivePlayers.length ? `Выжившие: ${formatPlayers(alivePlayers.map((player) => player.id))}.` : "За столом не осталось живых игроков.")),
    h(
      "div",
      { className: "game-over-lists" },
      h("div", null, h("strong", null, "Выжившие"), alivePlayers.length ? alivePlayers.map((player) => h("span", { key: player.id }, `Игрок ${player.id}: ${roleSummaryForPlayer(state, player.id)}`)) : h("span", null, "Никого")),
      h("div", null, h("strong", null, "Выбыли"), deadPlayers.length ? deadPlayers.slice(0, 8).map((player) => h("span", { key: player.id }, `Игрок ${player.id}: ${roleSummaryForPlayer(state, player.id)} (${player.deathReason || "выбыл"})`)) : h("span", null, "Никого"))
    )
  );
}

function NightResultsCard({ state, lines }) {
  const hasDeaths = lines.some((line) => /Выбыли ночью/i.test(line));
  const icon = hasDeaths ? "MoonStar" : "Megaphone";
  const deaths = Array.isArray(state.nightResultDeaths) ? state.nightResultDeaths : [];
  return h(
    "div",
    { className: `vote-results-card night-results-card ${hasDeaths ? "result-eliminated" : "result-night"}` },
    h(
      "div",
      { className: "vote-results-head" },
      h("span", null, h(Icon, { name: icon })),
      h("div", null, h("h3", null, "Итоги ночи"), h("p", null, `Ночь ${Math.max(1, state.dayNumber - 1)}`))
    ),
    h("strong", null, "Ведущий объявляет столу публичные итоги ночи."),
    h(
      "div",
      { className: "day-result-details night-result-details" },
      lines.map((line, index) =>
        h(
          "div",
          { key: `${line}-${index}`, className: "day-result-row night-result-row" },
          h("span", { className: "night-result-icon" }, h(Icon, { name: line.includes("Выбыли") ? "CircleX" : line.includes("Бомба") ? "Bomb" : line.includes("Камикадзе") ? "Zap" : "Info" })),
          h("span", null, line)
        )
      )
    ),
    deaths.length > 0 && h(DeathChainCard, { deaths, title: "Служебно для ведущего: цепочка ночи", compact: true }),
    h("p", { className: "host-note" }, "После объявления можно начинать Балаган.")
  );
}

function VoteResultsCard({ state, markLastWordsDone }) {
  const result = state.dayResult || { type: "none", message: "Голосование завершено. И наступает ночь." };
  const icon = result.type === "eliminated" || result.type === "shootout" ? "CircleX" : result.type === "alibi" ? "Scale" : "Megaphone";
  const fallbackDeathAllowed = ["eliminated", "shootout"].includes(result.type);
  const deaths = Array.isArray(result.deaths) ? result.deaths : fallbackDeathAllowed && result.playerId ? [{ id: result.playerId, role: result.role, reason: result.type === "shootout" ? "перестрелка" : "голосование", finalSpeech: !hasNoFinalSpeech(state, result.playerId) }] : [];
  const blockedLastWords = deaths.filter((death) => !death.finalSpeech);
  const pendingLastWords = finalSpeechRequiredIds(state);
  return h(
    "div",
    { className: `vote-results-card result-${result.type}` },
    h(
      "div",
      { className: "vote-results-head" },
      h("span", null, h(Icon, { name: icon })),
      h("div", null, h("h3", null, "Итоги голосования"), h("p", null, `День ${state.dayNumber}`))
    ),
    h("strong", null, result.message),
    result.role && h("p", { className: "revealed-role" }, `Роль раскрыта: ${result.role}`),
    deaths.length > 0 &&
      h(
        "div",
        { className: "day-result-details" },
        h("h4", null, "Выбыли по итогам дня"),
        deaths.map((death) =>
          h(
            "div",
            { key: death.id, className: `day-result-row ${death.finalSpeech ? "" : "no-last-word"}` },
            h("strong", null, `Игрок ${death.id}`),
            h("span", null, death.role || roleSummaryForPlayer(state, death.id)),
            h("em", null, death.reason || "выбыл"),
            death.finalSpeech
              ? h("button", { type: "button", className: state.lastWordsDone?.[death.id] ? "muted done-action" : "primary-action", onClick: () => markLastWordsDone(death.id), disabled: Boolean(state.lastWordsDone?.[death.id]) }, state.lastWordsDone?.[death.id] ? "Речь сказана" : "Последняя речь")
              : h("span", { className: "no-last-word-note" }, "Последнего слова нет")
          )
        )
      ),
    deaths.length > 1 && h(DeathChainCard, { deaths, title: "Цепочка выбытия" }),
    blockedLastWords.length > 0 &&
      h("p", { className: "host-note no-last-word-summary" }, `Без последнего слова: ${blockedLastWords.map((death) => `игрок ${death.id}`).join(", ")}. У мафии, Дона, Щита и шерифа последнего слова нет.`),
    pendingLastWords.length > 0
      ? h("p", { className: "host-note warning-note" }, `Перед ночью нужно дать последнюю речь: ${pendingLastWords.map((id) => `игрок ${id}`).join(", ")}.`)
      : h("p", { className: "host-note" }, "И наступает ночь.")
  );
}

function DeathChainCard({ deaths, title, compact = false }) {
  return h(
    "div",
    { className: `death-chain-card ${compact ? "compact" : ""}` },
    h("h4", null, title),
    deaths.map((death) =>
      h(
        "div",
        { key: `${death.id}-${death.reason}`, className: `death-chain-row reason-${death.reason || "unknown"}` },
        h("span", { className: "death-chain-icon" }, h(Icon, { name: deathReasonIcon(death.reason) })),
        h("strong", null, `Игрок ${death.id}`),
        h("span", { className: "death-chain-role" }, death.role || "Роль не указана", h("small", null, death.source || deathReasonSource(death.reason))),
        h("em", null, deathReasonLabel(death.reason))
      )
    )
  );
}

function playerHasVisibleMark(player, state) {
  return Boolean(
    player.healed ||
    player.alibi ||
    player.shielded ||
    player.bombed ||
    state.night.checks.some((check) => check.target === player.id) ||
    [state.night.mafiaTarget, state.night.loversTarget, state.night.maniacTarget].includes(player.id)
  );
}

function Board({ state, updateState, setView, selectPlayer, rolesForPlayer, isMafiaVisible }) {
  const statusFilters = [
    ["all", "Все"],
    ["alive", "Живые"],
    ["dead", "Выбывшие"],
    ["roles", "С ролями"],
    ["marked", "Под метками"]
  ];
  const visiblePlayers = state.players.filter((player) => {
    if (state.view !== "status") return true;
    if (state.statusFilter === "alive") return player.alive;
    if (state.statusFilter === "dead") return !player.alive;
    if (state.statusFilter === "roles") return rolesForPlayer(player.id).length > 0;
    if (state.statusFilter === "marked") return playerHasVisibleMark(player, state);
    return true;
  });
  return h(
    "section",
    { className: "board-shell" },
    h(
      "div",
      { className: "board-toolbar" },
      h(
        "div",
        { className: "segmented", role: "group", "aria-label": "Режим" },
        h("button", { type: "button", className: state.view === "status" ? "active" : "", onClick: () => setView("status") }, "Статус"),
        h("button", { type: "button", className: state.view === "roles" ? "active" : "", onClick: () => setView("roles") }, "Роли")
      )
    ),
    state.view === "status" &&
      h(
        "div",
        { className: "status-filter-bar", role: "group", "aria-label": "Фильтр игроков" },
        statusFilters.map(([key, label]) =>
          h(
            "button",
            {
              key,
              type: "button",
              className: state.statusFilter === key ? "active" : "",
              onClick: () => updateState((draft) => { draft.statusFilter = key; })
            },
            label
          )
        ),
        h("span", null, `${visiblePlayers.length} / ${state.players.length}`)
      ),
    visiblePlayers.length
      ? h("div", { className: "players-grid", "aria-label": "Игроки" }, visiblePlayers.map((player) => h(PlayerCard, { key: player.id, player, state, rolesForPlayer, isMafiaVisible, onSelect: selectPlayer })))
      : h("div", { className: "empty-filter" }, "Нет игроков для этого фильтра")
  );
}

function DayFlowCard({ state, aliveOptions, castVote, updateFoulVote, setShootoutNumber, setShootoutPlayer, recordShootoutGuess, nextSpeaker, updateDayOrder }) {
  const aliveVoteOptions = aliveOptions.filter((option) => state.players.some((player) => player.id === option.id && player.alive));
  const votes = state.votes && typeof state.votes === "object" ? state.votes : {};
  const alivePlayers = state.players.filter((player) => player.alive);
  const speakerOrder = window.MafiaUiFocus?.daySpeakerOrder?.(state) || alivePlayers.map((player) => player.id);
  const orderPreview = speakerOrder.map((id) => `#${id}`).join(" -> ");
  const selectedDayStartPlayerId = alivePlayers.some((player) => player.id === Number(state.dayStartPlayerId)) ? Number(state.dayStartPlayerId) : alivePlayers[0]?.id || "";
  const votingOpen = hasDayVoting(state);
  const foulVotes = state.foulVotes && typeof state.foulVotes === "object" ? state.foulVotes : {};
  const voteCounts = voteTally(votes, foulVotes, (id) => state.players.some((player) => player.id === id && player.alive));
  const normalVoteCounts = voteTally(votes, {}, (id) => state.players.some((player) => player.id === id && player.alive));
  const completedVotes = alivePlayers.filter((player) => Boolean(votes[player.id])).length;
  const speechesComplete = alivePlayers.filter((player) => state.speechesDone?.[player.id]).length;
  const shootoutOrdered = shootoutOrderedPlayers(state);
  const shootoutAvailable = shootoutAvailablePlayers(state);
  const currentShootoutPlayer = shootoutAvailable.includes(Number(state.shootout.currentPlayer)) ? Number(state.shootout.currentPlayer) : shootoutAvailable[0];
  const currentVoteTarget = (playerId) => (votes[playerId] && aliveVoteOptions.some((option) => option.id === Number(votes[playerId])) ? votes[playerId] : "");
  const flowComplete = alivePlayers.length > 0 && alivePlayers.every((player) => votingOpen ? Boolean(votes[player.id]) : Boolean(state.speechesDone?.[player.id]));
  const currentSpeaker = state.timer.currentSpeaker && !flowComplete ? state.timer.currentSpeaker : null;
  const currentSpeakerPlayer = state.players.find((player) => player.id === currentSpeaker && player.alive);
  const tablePlayers = currentSpeakerPlayer ? state.players.filter((player) => player.id !== currentSpeakerPlayer.id) : state.players;
  const currentSpeakerDone = currentSpeakerPlayer ? votingOpen ? Boolean(votes[currentSpeakerPlayer.id]) : Boolean(state.speechesDone?.[currentSpeakerPlayer.id]) : false;
  return h(
    "div",
    { className: "day-flow-card main-day-flow" },
    h(
      "div",
      { className: "day-flow-head" },
      h("div", null, h("h3", null, votingOpen ? "Речи и голосование" : "Речи игроков"), h("span", null, votingOpen ? `${completedVotes} / ${alivePlayers.length} голосов` : `${speechesComplete} / ${alivePlayers.length} речей`))
    ),
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
            value: selectedDayStartPlayerId,
            onChange: (event) => updateDayOrder("dayStartPlayerId", event.target.value),
            "data-testid": "day-start-player"
          },
          alivePlayers.map((player) => h("option", { key: player.id, value: player.id }, `#${player.id}`))
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
    h(
      "div",
      { className: `current-speaker-card ${currentSpeakerDone ? "done" : ""}` },
      currentSpeakerPlayer
        ? [
            h(
              "div",
              { key: "speaker", className: "current-speaker-main" },
              h("span", null, "Говорит"),
              h("strong", null, `Игрок ${currentSpeakerPlayer.id}`),
              h("em", null, votingOpen ? currentSpeakerDone ? "голос принят" : "ожидает голос" : currentSpeakerDone ? "речь завершена" : "идет речь")
            ),
            votingOpen
              ? h(
                  "label",
                  { key: "vote", className: "quick-vote" },
                  h("span", null, "Быстрый голос"),
                  h(
                    "select",
                    {
                      disabled: state.dayEliminationDone,
                      value: currentVoteTarget(currentSpeakerPlayer.id),
                      onChange: (event) => castVote(currentSpeakerPlayer.id, Number(event.target.value)),
                      "data-testid": "current-speaker-vote"
                    },
                    h("option", { value: "" }, "Выберите игрока"),
                    aliveVoteOptions.map((option) => h("option", { key: option.id, value: option.id }, option.label))
                  )
                )
              : h("div", { key: "no-vote", className: "quick-vote-note" }, "Первый день без голосования"),
            h("button", { key: "next", type: "button", className: "primary-action icon-action", onClick: nextSpeaker, disabled: votingOpen && !currentSpeakerDone, "data-testid": "next-speaker" }, h(Icon, { name: currentSpeakerDone ? "ArrowRight" : votingOpen ? "Vote" : "Check" }), currentSpeakerDone ? "Следующий игрок" : votingOpen ? "Сначала выберите голос" : "Завершить речь")
          ]
        : h("div", { className: "current-speaker-main complete" }, h("span", null, "Речи"), h("strong", null, h("span", { className: "complete-icon" }, h(Icon, { name: "CheckCircle2" })), "Завершены"), h("em", null, "можно переходить дальше"))
    ),
    h(
      "div",
      { className: "day-player-list" },
      tablePlayers.map((player) =>
        h(
          "div",
          { key: player.id, className: `day-player-row ${state.speechesDone?.[player.id] ? "done" : ""} ${currentSpeaker === player.id ? "current" : ""} ${player.alive ? "" : "dead"}` },
          h("strong", null, `Игрок ${player.id}`),
          player.alive
            ? h(
                "span",
                { className: state.speechesDone?.[player.id] || Number(votes[player.id]) ? "dead-pill vote-done status-with-icon" : "day-note status-with-icon" },
                h(Icon, { name: votingOpen ? Number(votes[player.id]) ? "Vote" : "CircleDashed" : state.speechesDone?.[player.id] ? "CheckCircle2" : "Mic" }),
                votingOpen ? Number(votes[player.id]) ? "Голос" : "Ожидает" : state.speechesDone?.[player.id] ? "Речь" : "Ждет"
              )
            : h("span", { className: "dead-pill status-with-icon" }, h(Icon, { name: STATUS_ICONS.dead }), "Выбыл"),
          player.alive
            ? votingOpen
              ? h(
                "select",
                {
                  className: Number(votes[player.id]) ? "has-vote" : "",
                  disabled: state.dayEliminationDone,
                  value: currentVoteTarget(player.id),
                  onChange: (event) => castVote(player.id, Number(event.target.value))
                },
                h("option", { value: "" }, "Голос"),
                aliveVoteOptions.map((option) => h("option", { key: option.id, value: option.id }, option.label))
              )
              : h("span", { className: "day-note" }, "Без голосования")
            : h("span", { className: "day-note" }, player.deathReason || "Выбыл"),
          player.alive && votingOpen
            ? h(
                "div",
                { className: "foul-controls", "aria-label": `Фолы игрока ${player.id}` },
                h("button", { type: "button", className: "foul-button", disabled: state.dayEliminationDone || state.shootout.active || !Number(foulVotes[player.id]), onClick: () => updateFoulVote(player.id, -1), title: `Снять фол игроку ${player.id}` }, "-"),
                h("span", null, Number(foulVotes[player.id]) || 0),
                h("button", { type: "button", className: "foul-button", disabled: state.dayEliminationDone || state.shootout.active, onClick: () => updateFoulVote(player.id, 1), title: `Добавить фол игроку ${player.id}` }, "+")
              )
            : h("span", { className: "day-note" }, "-"),
          h(
            "div",
            { className: `vote-breakdown ${Number(foulVotes[player.id]) ? "with-foul" : ""}` },
            votingOpen
              ? [
                  h("span", { key: "votes" }, h("em", null, "Голоса"), h("strong", null, normalVoteCounts[player.id] || 0)),
                  h("span", { key: "fouls" }, h("em", null, "Фолы"), h("strong", null, Number(foulVotes[player.id]) || 0)),
                  h("span", { key: "total", className: "total" }, h("em", null, "Итого"), h("strong", null, voteCounts[player.id] || 0))
                ]
              : state.speechesDone?.[player.id] ? "✓" : "-"
          )
        )
      )
    ),
    h("div", { className: "vote-progress" }, votingOpen ? `${completedVotes} / ${alivePlayers.length} голосов` : `${speechesComplete} / ${alivePlayers.length} речей завершено`),
    state.shootout.active &&
      h(
        "div",
        { className: "shootout-card" },
        h("h3", null, "Перестрелка"),
        h("p", null, `Очередь: ${shootoutOrdered.join(" → ")}`),
        h(
          "div",
          { className: "shootout-legend" },
          shootoutOrdered.map((playerId) =>
            {
              const alreadyShot = (state.shootout.roundShots || []).includes(playerId);
              return (
            h(
              "button",
              {
                key: playerId,
                type: "button",
                className: `shootout-player-chip ${shootoutColorClass(state, playerId)} ${currentShootoutPlayer === playerId ? "active" : ""} ${alreadyShot ? "spent" : ""}`,
                disabled: alreadyShot,
                title: alreadyShot ? `Игрок ${playerId} уже стрелял в этом круге` : `Ход игрока ${playerId}`,
                onClick: () => setShootoutPlayer(playerId)
              },
              alreadyShot ? `Игрок ${playerId} ✓` : `Игрок ${playerId}`
            )
              );
            }
          )
        ),
        h(
          "label",
          { className: "shootout-turn" },
          h("span", null, "Кто выбирает число"),
          h(
            "select",
            { value: currentShootoutPlayer || "", onChange: (event) => setShootoutPlayer(Number(event.target.value)), "data-testid": "shootout-player" },
            shootoutAvailable.map((playerId) => h("option", { key: playerId, value: playerId }, `Игрок ${playerId}`))
          )
        ),
        h(
          "label",
          { className: "shootout-secret" },
          h("span", null, "Секретное число"),
          h(
            "select",
            { value: state.shootout.number || "", onChange: (event) => setShootoutNumber(event.target.value), "data-testid": "shootout-number" },
            h("option", { value: "" }, "Выбрать"),
            Array.from({ length: 10 }, (_, index) => index + 1).map((number) => h("option", { key: number, value: number }, number))
          )
        ),
        shootoutOrdered.map((playerId) =>
          h(
            "div",
            { key: playerId, className: `shootout-row ${currentShootoutPlayer === playerId ? "active" : ""} ${(state.shootout.roundShots || []).includes(playerId) ? "spent" : ""}` },
            h("strong", { className: shootoutColorClass(state, playerId) }, `Игрок ${playerId}`),
            Array.from({ length: 10 }, (_, index) => {
              const number = index + 1;
              const calledBy = Number(state.shootout.calledBy?.[number]);
              const calledClass = calledBy ? shootoutColorClass(state, calledBy) : "";
              const isActivePlayer = currentShootoutPlayer === playerId;
              return h(
                "button",
                {
                  key: number,
                  type: "button",
                  className: [state.shootout.called?.includes(number) ? "called" : "", calledClass].filter(Boolean).join(" "),
                  disabled: !state.shootout.number || state.shootout.called?.includes(number) || !isActivePlayer,
                  title: calledBy ? `Число ${number} назвал игрок ${calledBy}` : isActivePlayer ? `Игрок ${playerId} называет ${number}` : `Сейчас выбирает игрок ${currentShootoutPlayer}`,
                  onClick: () => recordShootoutGuess(playerId, number)
                },
                number
              );
            })
          )
        )
      )
  );
}

function splitLogEntry(entry) {
  const parts = String(entry || "").split(": ");
  const first = parts[0] || "События";
  const second = parts[1] || "";
  if (first.startsWith("День ")) {
    const hasPhase = ["обсуждение", "Балаган", "речи игроков"].includes(second);
    return {
      group: hasPhase ? `${first}: ${second}` : first,
      text: (hasPhase ? parts.slice(2) : parts.slice(1)).join(": ") || entry
    };
  }
  if (first.startsWith("Ночь ")) {
    const hasIntro = second === "знакомство";
    return {
      group: hasIntro ? `${first}: ${second}` : first,
      text: (hasIntro ? parts.slice(2) : parts.slice(1)).join(": ") || entry
    };
  }
  if (first.startsWith("Игра окончена")) {
    return { group: second ? `${first}: ${second}` : first, text: parts.slice(second ? 2 : 1).join(": ") || entry };
  }
  return { group: first, text: parts.slice(1).join(": ") || entry };
}

function logEntryMeta(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("выбыл") || lower.includes("победа")) return { icon: "CircleX", tone: "danger" };
  if (lower.includes("голос")) return { icon: "Vote", tone: "vote" };
  if (lower.includes("провер")) return { icon: "SearchCheck", tone: "check" };
  if (lower.includes("врач") || lower.includes("леч")) return { icon: "Cross", tone: "heal" };
  if (lower.includes("перестрел")) return { icon: "Target", tone: "shootout" };
  if (lower.includes("ноч") || lower.includes("маф") || lower.includes("маньяк")) return { icon: "Moon", tone: "night" };
  if (lower.includes("алиби") || lower.includes("адвокат")) return { icon: "Scale", tone: "alibi" };
  if (lower.includes("роль") || lower.includes("роли")) return { icon: "BadgeCheck", tone: "setup" };
  return { icon: "Dot", tone: "plain" };
}

function groupedLogEntries(entries) {
  const groups = [];
  (entries || []).forEach((entry, index) => {
    const parsed = splitLogEntry(entry);
    const last = groups[groups.length - 1];
    const item = { ...parsed, raw: entry, index, ...logEntryMeta(parsed.text) };
    if (last && last.title === parsed.group) last.items.push(item);
    else groups.push({ title: parsed.group, items: [item] });
  });
  return groups;
}

function LogBox({ state, updateState }) {
  const groups = groupedLogEntries(state.log);
  const latest = groups[0]?.items[0];
  return h(
    "div",
    { className: "log-box log-card" },
    h(
      "div",
      { className: "panel-head compact log-head" },
      h("h3", null, h(Icon, { name: "ListTree" }), " Журнал"),
      h("button", { type: "button", onClick: () => updateState((draft) => { draft.log = []; }), title: "Очистить журнал" }, h(Icon, { name: "Trash2", label: "Очистить журнал" }))
    ),
    latest &&
      h(
        "div",
        { className: `latest-log latest-${latest.tone}` },
        h("span", null, h(Icon, { name: latest.icon })),
        h("div", null, h("strong", null, "Последнее событие"), h("p", null, latest.text))
      ),
    groups.length
      ? h(
          "div",
          { className: "log-group-list" },
          groups.map((group) =>
            h(
              "section",
              { key: `${group.title}-${group.items[0]?.index}`, className: "log-group" },
              h("div", { className: "log-group-title" }, h("strong", null, group.title), h("span", null, group.items.length)),
              h(
                "ol",
                { className: "log-list" },
                group.items.map((item) =>
                  h(
                    "li",
                    { key: `${item.raw}-${item.index}`, className: `log-entry log-${item.tone}` },
                    h("span", { className: "log-entry-icon" }, h(Icon, { name: item.icon })),
                    h("span", null, item.text)
                  )
                )
              )
            )
          )
        )
      : h("div", { className: "empty-log" }, "Журнал пуст")
  );
}

function PlayerCard({ player, state, rolesForPlayer, isMafiaVisible, onSelect }) {
  const classNames = ["player-card"];
  const playerRoles = rolesForPlayer(player.id);
  if (isMafiaVisible(player.id)) classNames.push("mafia");
  if (state.roles.shield.includes(player.id)) classNames.push("shield-role");
  if (player.shielded) classNames.push("shielded");
  if (player.bombed) classNames.push("bombed");
  if (!player.alive) classNames.push("dead");
  if (player.alive && Number(state.targetId) === player.id) classNames.push("selected");
  const roleContent =
    state.view === "roles"
      ? playerRoles.length
        ? playerRoles.map((role) =>
            h("span", { key: role.key, className: `player-role-chip role-${role.key}` }, h(Icon, { name: role.icon }), role.name)
          )
        : "Мирный"
      : statusText(player);
  return h(
    "button",
    { type: "button", className: classNames.join(" "), disabled: !player.alive, onClick: () => onSelect(player.id), title: player.alive ? `Выбрать игрока ${player.id}` : `Игрок ${player.id} выбыл` },
    h(
      "div",
      { className: "badges" },
      badgesFor(player, state, playerRoles).map(([className, iconName, title]) =>
        h("span", { key: `${className}-${iconName}-${title}`, className: `badge ${className}`, title }, h(Icon, { name: iconName, label: title }))
      )
    ),
    h("div", { className: "player-number" }, player.id),
    !player.alive && h("div", { className: "dead-label" }, "Выбыл"),
    h("div", { className: "player-role" }, roleContent)
  );
}

function statusText(player) {
  if (!player.alive) return "Выбыл";
  const parts = [];
  if (player.healed) parts.push("лечение");
  if (player.alibi) parts.push("алиби");
  if (player.shielded) parts.push("щит");
  if (player.bombed) parts.push("бомба");
  return parts.join(", ") || "в игре";
}

function badgesFor(player, state, playerRoles) {
  const badges = playerRoles.map((role) => [`role-badge role-${role.key}`, role.icon, role.name]);
  if (state.night.checks.some((check) => check.by === "Шериф" && check.target === player.id)) {
    badges.push(["checked", STATUS_ICONS.checked, "Проверен шерифом"]);
  }
  if ([state.night.mafiaTarget, state.night.loversTarget, state.night.maniacTarget].includes(player.id)) {
    badges.push(["target", STATUS_ICONS.target, "Цель выстрела"]);
  }
  if (player.shielded) badges.push(["shield", STATUS_ICONS.shield, "Заблокирован щитом"]);
  if (player.bombed) badges.push(["bomb", STATUS_ICONS.bomb, "Отмечен бомбой"]);
  if (player.healed) badges.push(["heal", STATUS_ICONS.heal, "Защищен врачом"]);
  if (player.alibi) badges.push(["alibi", STATUS_ICONS.alibi, "Иммунитет адвоката"]);
  if (!player.alive) badges.push(["dead", STATUS_ICONS.dead, "Выбыл"]);
  return badges;
}

function ActionPanel({ state, aliveOptions, updateState, applyAction, clearCurrentNightAction, updateTimerSetting, toggleTimer, resetTimer }) {
  const actionsAvailable = canUseNightActions(state);
  const actionOptions = availableNightActions(state);
  const activeAction = actionOptions.some((action) => action.key === state.activeAction) ? state.activeAction : canUseNightActions(state) ? nextNightActionKey(state) : actionOptions[0]?.key || "mafia";
  const timerVisible = ["discussion", "speeches"].includes(state.phase);
  const nightChecklist = requiredNightActions(state);
  const aliveVoteOptions = aliveOptions.filter((option) => state.players.some((player) => player.id === option.id && player.alive));
  const alivePlayers = state.players.filter((player) => player.alive);
  const votingOpen = hasDayVoting(state);
  const doctorUnavailable = new Set([...lastHealedIds(state), ...healedIds(state)]);
  const sheriffKnownTargets = aliveKnownSheriffMafia(state);
  const sheriffCanShoot = activeAction === "sheriff" && sheriffKnownTargets.length > 0;
  const nightTargetOptions = activeAction === "doctor"
    ? aliveVoteOptions.filter((option) => !doctorUnavailable.has(option.id))
    : activeAction === "sheriff" && state.sheriffActionMode === "shoot"
      ? aliveVoteOptions.filter((option) => sheriffKnownTargets.includes(option.id))
      : aliveVoteOptions;
  const bombTargets = resolveBombTargets(state);
  const speechesFlowComplete = state.phase === "speeches" && alivePlayers.length > 0 && alivePlayers.every((player) => hasDayVoting(state) ? Boolean(state.votes?.[player.id]) : Boolean(state.speechesDone?.[player.id]));

  return h(
    "aside",
    { className: "panel action-panel" },
    h(
      "div",
      { className: "phase-card" },
      h("h3", null, "Текущая фаза"),
      h("strong", null, phaseName(state)),
      h("p", null, state.phase === "introNight" ? "Первая ночь: ведущий знакомит роли, игровые действия закрыты." : state.phase === "discussion" ? "Балаган: свободный разговор за столом. Таймер задается ведущим." : state.phase === "speeches" ? votingOpen ? "Речи и голосование." : "Первый день: только речи игроков, без голосования." : state.phase === "voteResults" ? "Ведущий объявляет итог голосования перед ночью." : state.phase === "gameOver" ? "Партия завершена." : "Ночные действия доступны.")
    ),
    h(
      "div",
      { className: "mark-card" },
      h(
        "div",
        { className: "panel-head compact" },
        h("h3", null, "Метки ведущего"),
        state.activeMark && h("button", { type: "button", className: "mark-clear", onClick: () => updateState((draft) => { draft.activeMark = null; }), title: "Снять режим метки" }, h(Icon, { name: "X", label: "Снять режим метки" }))
      ),
      h(
        "div",
        { className: "mark-buttons", role: "group", "aria-label": "Метки ведущего" },
        MARK_ACTIONS.map((mark) =>
          h(
            "button",
            {
              key: mark.key,
              type: "button",
              className: state.activeMark === mark.key ? "active" : "",
              disabled: state.phase === "gameOver",
              onClick: () => updateState((draft) => {
                draft.activeMark = draft.activeMark === mark.key ? null : mark.key;
              }),
              title: mark.label,
              "aria-pressed": state.activeMark === mark.key
            },
            h(Icon, { name: mark.icon }),
            h("span", null, mark.label)
          )
        )
      )
    ),
    timerVisible &&
      h(
      "div",
      { className: "timer-card" },
      h(
        "div",
        { className: "timer-display" },
        h("span", null, formatTime(state.timer.remainingSeconds)),
        h("strong", null, state.phase === "speeches" ? speechesFlowComplete ? "Речи завершены" : `Речь игрока ${state.timer.currentSpeaker || "-"}` : "Балаган")
      ),
      h(
        "div",
        { className: "timer-settings" },
        state.phase === "speeches"
          ? h(NumberField, { label: "Речь, сек", value: state.timer.speechSeconds, onChange: (value) => updateTimerSetting("speechSeconds", value) })
          : h(NumberField, { label: "Балаган, мин", value: state.timer.discussionMinutes, onChange: (value) => updateTimerSetting("discussionMinutes", value) })
      ),
      h(
        "div",
        { className: "timer-buttons discussion-only" },
        h("button", { type: "button", onClick: toggleTimer, disabled: !timerVisible, "data-testid": "timer-toggle" }, state.timer.running ? "Пауза" : "Старт"),
        h("button", { type: "button", className: "muted", onClick: resetTimer, disabled: !timerVisible, "data-testid": "timer-reset" }, "↺")
      )
    ),
    state.phase === "gameOver" &&
      h(
        "div",
        { className: "game-over-card" },
        h("h3", null, `Победа: ${state.winner}`),
        h("p", null, `Выжившие: ${alivePlayers.length ? alivePlayers.map((player) => `игрок ${player.id}`).join(", ") : "никого"}.`),
        h(
          "div",
          { className: "night-summary-body" },
          alivePlayers.map((player) =>
            h("div", { key: player.id, className: "summary-line" }, h("strong", null, `Игрок ${player.id}`), h("span", null, roleSummaryForPlayer(state, player.id)))
          )
        )
      ),
    state.phase === "night" &&
      h(
        "div",
        { className: "night-action-card" },
        h(
          "div",
          { className: "panel-head" },
          h("h2", null, "Ход"),
          h(
            "select",
            {
              title: "Активная роль",
              "data-testid": "active-action",
              disabled: !actionsAvailable,
              value: activeAction,
              onChange: (event) => updateState((draft) => {
                draft.activeAction = event.target.value;
              })
            },
            actionOptions.map((action) => h("option", { key: action.key, value: action.key }, action.name))
          )
        ),
        sheriffCanShoot &&
          h(
            "label",
            { className: "mini-field action-mode-field" },
            h("span", null, "Действие шерифа"),
            h(
              "select",
              {
                value: state.sheriffActionMode || "check",
                onChange: (event) => updateState((draft) => {
                  draft.sheriffActionMode = event.target.value;
                  if (event.target.value === "shoot") {
                    draft.targetId = sheriffKnownTargets.includes(Number(draft.targetId)) ? Number(draft.targetId) : sheriffKnownTargets[0];
                  }
                })
              },
              h("option", { value: "check" }, "Проверить игрока"),
              h("option", { value: "shoot" }, "Выстрелить в найденную мафию")
            )
        ),
        activeAction === "bomb"
          ? h(BombTargetFields, { targets: bombTargets, options: aliveVoteOptions, disabled: !actionsAvailable || aliveVoteOptions.length < bombRequiredTargetCount(state), updateState })
          : h(PlayerSelectField, { label: "Цель", testId: "target-select", value: nightTargetOptions.some((option) => option.id === Number(state.targetId)) ? state.targetId : nightTargetOptions[0]?.id || "", options: nightTargetOptions, disabled: !actionsAvailable || !nightTargetOptions.length, onChange: (value) => updateState((draft) => { draft.targetId = Number(value); }) }),
        h(
          "div",
          { className: "action-buttons two-actions" },
          h("button", { type: "button", className: "primary-action", onClick: applyAction, disabled: !actionsAvailable, "data-testid": "apply-action" }, "Применить"),
          h("button", { type: "button", className: "muted", onClick: clearCurrentNightAction, disabled: !actionsAvailable, "data-testid": "clear-action" }, "Очистить")
        )
      ),
    state.phase === "night" &&
      h(
        "div",
        { className: "night-summary" },
        h("h3", null, "Обязательные действия"),
        h("div", { className: "night-summary-body" }, nightChecklist.map(([key, label, done]) => h(NightChecklistRow, { key, label, done, blocked: Boolean(state.night.blockedActions?.[key]) })))
      ),
    null
  );
}

function NightChecklistRow({ label, done, blocked }) {
  return h(
    "div",
    { className: `summary-line checklist-line ${done ? "done" : "pending"} ${blocked ? "blocked" : ""}` },
    h("strong", null, label),
    h(
      "span",
      { className: "summary-status" },
      h(Icon, { name: done ? blocked ? "ShieldOff" : "CheckCircle2" : "CircleDashed" }),
      blocked ? "заблокировано" : done ? "готово" : "ожидает"
    )
  );
}

function NumberField({ label, value, onChange }) {
  return h(
    "label",
    { className: "mini-field" },
    h("span", null, label),
    h("input", { type: "number", min: "1", value, onChange: (event) => onChange(event.target.value) })
  );
}

function BombTargetFields({ targets, options, disabled, updateState }) {
  return h(
    "div",
    { className: "bomb-target-grid" },
    [0, 1, 2].map((index) =>
      h(PlayerSelectField, {
        key: index,
        label: `Цель ${index + 1}`,
        testId: `bomb-target-${index + 1}`,
        value: options.some((option) => option.id === Number(targets[index])) ? targets[index] : options[index]?.id || "",
        options,
        disabled,
        onChange: (value) => updateState((draft) => {
          const nextTargets = resolveBombTargets(draft);
          nextTargets[index] = Number(value);
          draft.bombTargetIds = nextTargets;
        })
      })
    )
  );
}

function PlayerSelectField({ label, testId, value, options, disabled, onChange }) {
  return h(
    "label",
    { className: "field" },
    h("span", null, label),
    h("select", { value, disabled, "data-testid": testId, onChange: (event) => onChange(event.target.value) }, options.map((option) => h("option", { key: option.id, value: option.id }, option.label)))
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
