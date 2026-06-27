(function attachMafiaUiFocus(root) {
  function latestLogEntry(state) {
    const entry = String(state?.log?.[0] || "");
    const parts = entry.split(": ");
    return parts.length > 1 ? parts.slice(1).join(": ") : entry;
  }

  function phaseProgress(context) {
    if (context?.phase === "night") {
      const checklist = context.nightChecklist || [];
      const blockedActions = context.blockedActions || {};
      const done = checklist.filter(([, , complete]) => complete).length;
      const pending = checklist.filter(([, , complete]) => !complete).map(([, label]) => label);
      const blocked = checklist.filter(([key]) => blockedActions[key]).map(([, label]) => label);
      const details = [];
      if (pending.length) details.push(`Осталось: ${pending.join(", ")}`);
      if (blocked.length) details.push(`заблокировано: ${blocked.join(", ")}`);
      return {
        label: "Ночь",
        value: `${done} / ${checklist.length}`,
        tone: pending.length ? "pending" : "done",
        detail: details.length ? details.join("; ") : "Все действия завершены"
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
        actionLabel: context.canApply ? "Применить" : "Недоступно",
        nextMissing: context.nextMissingName ? `Осталось: ${context.nextMissingName}` : ""
      };
    }

    return {
      eyebrow: "Текущая фаза",
      title: context?.phaseName || "",
      detail: "",
      actionLabel: context?.blockReason ? "Заблокировано" : "Следующая фаза"
    };
  }

  function formatPlayerList(value) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values.length ? values.map((id) => `#${id}`).join(", ") : "-";
  }

  function nightActionLedger(context) {
    const actions = context?.actions || [];
    const actors = context?.actors || {};
    const targets = context?.targets || {};
    const results = context?.results || {};
    const blockedActions = context?.blockedActions || {};
    return actions.map(([key, label, done]) => {
      const blockedBy = blockedActions[key];
      return {
        key,
        label,
        state: blockedBy ? "blocked" : done ? "done" : "pending",
        actor: formatPlayerList(actors[key]),
        target: formatPlayerList(targets[key]),
        result: blockedBy ? `Заблокировано щитом #${blockedBy}` : results[key] || (done ? "Готово" : "Ожидает")
      };
    });
  }

  function checkReveal(check) {
    const by = String(check?.by || "");
    const target = Number(check?.target);
    const result = String(check?.result || "");
    if (!target || !["Шериф", "Дон"].includes(by)) return null;
    const isSheriff = by === "Шериф";
    const found = isSheriff ? result === "черный" : result === "шериф";
    return {
      by,
      target,
      title: isSheriff ? "Проверка Шерифа" : "Проверка Дона",
      message: isSheriff
        ? found ? "Мафия найдена" : "Мафия не найдена"
        : found ? "Шериф найден" : "Шериф не найден",
      targetLabel: `Игрок #${target}`,
      icon: isSheriff ? "BadgeCheck" : "Crown",
      tone: isSheriff ? found ? "mafia-found" : "mafia-clear" : found ? "sheriff-found" : "sheriff-missing",
      actionKey: isSheriff ? "sheriff" : "don"
    };
  }

  function normalizedDiscoveryAction(actionKey) {
    return ["sheriff", "don"].includes(actionKey) ? actionKey : "";
  }

  function normalizedDiscoveries(discoveries) {
    if (!discoveries || typeof discoveries !== "object") return {};
    return Object.fromEntries(
      Object.entries(discoveries)
        .map(([key, value]) => [normalizedDiscoveryAction(key), Number(value)])
        .filter(([key, value]) => key && value)
    );
  }

  function recordCheckDiscovery(discoveries, actionKey, target, shouldRecord) {
    const key = normalizedDiscoveryAction(actionKey);
    const next = normalizedDiscoveries(discoveries);
    if (!key) return next;
    delete next[key];
    const targetId = Number(target);
    if (shouldRecord && targetId) next[key] = targetId;
    return next;
  }

  function rollbackCheckDiscovery(knownIds, discoveries, actionKey) {
    const key = normalizedDiscoveryAction(actionKey);
    const discoveryId = Number(normalizedDiscoveries(discoveries)[key]);
    const known = uniqueNumberList(knownIds || []);
    return discoveryId ? known.filter((id) => id !== discoveryId) : known;
  }

  function voteAudit(context) {
    const playerId = Number(context?.playerId);
    const votes = context?.votes || {};
    const receivedVotes = Number(context?.receivedVotes) || 0;
    const foulVotes = Number(context?.foulVotes) || 0;
    const targetId = Number(votes[playerId]);
    return {
      choice: targetId ? `#${playerId}: #${targetId}` : `#${playerId}: -`,
      compactChoice: targetId ? `-> #${targetId}` : "-> -",
      compactReceived: `Получил ${receivedVotes}`,
      compactFouls: `Фолы ${foulVotes}`,
      compactTotal: `Итого ${receivedVotes + foulVotes}`,
      received: `Получил: ${receivedVotes}`,
      fouls: `Фолы: ${foulVotes}`,
      total: `Итого: ${receivedVotes + foulVotes}`
    };
  }

  function finalSpeechRequiredDeathIds(context) {
    const done = context?.lastWordsDone || {};
    return (context?.deaths || [])
      .filter((death) => death?.finalSpeech && !done[death.id])
      .map((death) => death.id);
  }

  function uniqueNumberList(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(Number).filter(Boolean))];
  }

  function initialImmunityActiveIds(context) {
    if (context?.startImmunityExpired) return [];
    const ids = uniqueNumberList(context?.startImmunityIds);
    if (!ids.length) return [];
    if (context?.phase === "night" && Number(context?.nightNumber) === 2) return ids;
    if (context?.phase === "speeches" && Number(context?.dayNumber) === 2) return ids;
    if (context?.phase === "voteResults" && Number(context?.dayNumber) === 2) return ids;
    return [];
  }

  function isInitialImmunityAttack(context) {
    if (["mafia", "lovers", "maniac"].includes(context?.actionKey)) return true;
    return context?.actionKey === "sheriff" && context?.sheriffActionMode === "shoot";
  }

  function filterInitialImmunityTargets(options, context) {
    const protectedIds = new Set(initialImmunityActiveIds(context));
    if (!protectedIds.size) return options || [];
    const blocksVote = context?.mode === "vote" && context?.phase === "speeches" && Number(context?.dayNumber) === 2;
    const blocksAttack = context?.phase === "night" && Number(context?.nightNumber) === 2 && isInitialImmunityAttack(context);
    if (!blocksVote && !blocksAttack) return options || [];
    return (options || []).filter((option) => !protectedIds.has(Number(option?.id)));
  }

  function shouldExpireInitialImmunity(context) {
    return !context?.startImmunityExpired && initialImmunityActiveIds(context).length > 0 && context?.phase === "voteResults" && Number(context?.dayNumber) === 2;
  }

  function toggleInitialImmunitySelection(currentIds, playerId, playerCount, limit = 5) {
    const maxPlayer = Number(playerCount) || 0;
    const selectedId = Number(playerId);
    const current = uniqueNumberList(currentIds).filter((id) => id >= 1 && id <= maxPlayer).slice(0, limit);
    if (!selectedId || selectedId < 1 || selectedId > maxPlayer) return current;
    if (current.includes(selectedId)) return current.filter((id) => id !== selectedId);
    if (current.length >= limit) return current;
    return [...current, selectedId];
  }

  function toggleDrawerSet(openDrawers, drawer) {
    const current = Array.isArray(openDrawers) ? openDrawers : [];
    return current.includes(drawer) ? current.filter((item) => item !== drawer) : [...current, drawer];
  }

  function isDrawerVisible(openDrawers, drawer) {
    return Array.isArray(openDrawers) && openDrawers.includes(drawer);
  }

  function rowFlashClass(rowKey, flashKey) {
    return rowKey && flashKey && rowKey === flashKey ? "flash" : "";
  }

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

  root.MafiaUiFocus = {
    checkReveal,
    daySpeakerOrder,
    filterInitialImmunityTargets,
    finalSpeechRequiredDeathIds,
    initialImmunityActiveIds,
    isDrawerVisible,
    latestLogEntry,
    nightActionLedger,
    nextDaySpeaker,
    normalizeDayDirection,
    phaseProgress,
    primaryFocus,
    recordCheckDiscovery,
    rollbackCheckDiscovery,
    rowFlashClass,
    shouldExpireInitialImmunity,
    toggleInitialImmunitySelection,
    toggleDrawerSet,
    voteAudit
  };
})(globalThis);
