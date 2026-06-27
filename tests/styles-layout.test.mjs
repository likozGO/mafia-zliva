import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const APP = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("five-slot role editors wrap instead of overflowing the setup panel", () => {
  assert.doesNotMatch(CSS, /\.role-slot-grid\.slots-5\s*\{[^}]*repeat\(5,/s);
  assert.match(CSS, /\.role-slot-grid\.slots-5\s*\{[^}]*auto-fit/s);
});

test("day speech panel supports compact and detailed density modes", () => {
  assert.match(APP, /dayFlowDensity/);
  assert.match(APP, /dayFlowDensity === "detailed"/);
  assert.match(APP, /Лаконично/);
  assert.match(APP, /Подробнее/);
  assert.match(CSS, /\.day-density-toggle/);
});

test("compact speech mode hides the full player table even before voting days", () => {
  assert.match(APP, /className: "day-flow-tools"/);
  assert.doesNotMatch(APP, /votingOpen && h\(\s*"div",\s*\{\s*className: "day-flow-tools"/s);
  assert.match(APP, /dayFlowDensity === "detailed" && h\(\s*"div",\s*\{\s*className: `day-player-list/s);
});

test("speech timer is compact inside the current speaker card", () => {
  assert.match(APP, /function DayFlowCard\([^)]*toggleTimer[^)]*resetTimer/);
  assert.match(APP, /speech-mini-timer/);
  assert.match(APP, /data-testid": "speech-timer-toggle"/);
  assert.match(APP, /const timerVisible = state\.phase === "discussion"/);
  assert.match(CSS, /\.speech-mini-timer/);
  assert.match(CSS, /\.speech-mini-time/);
});

test("phase blockers are not duplicated below the phase button or current phase card", () => {
  assert.match(APP, /blockerTooltipOpen/);
  assert.match(APP, /title: blockReason \|\| "Следующая фаза"/);
  assert.match(APP, /phase-blocker-tooltip/);
  assert.match(APP, /onMouseEnter: \(\) => blockReason && setBlockerTooltipOpen\(true\)/);
  assert.match(APP, /onClick: \(\) => \{\s*if \(blockReason\) \{\s*setBlockerTooltipOpen\(true\)/s);
  assert.match(APP, /blockReason && h\(AuditChip, \{ icon: "Lock", label: "Блокер", value: blockReason/);
  assert.doesNotMatch(APP, /data-testid": "phase-block-reason"/);
  assert.doesNotMatch(APP, /focus\?\.detail \|\| \(blockReason \|\| "Готово к следующему действию"\)/);
  assert.match(CSS, /\.blocked-action:hover \.phase-blocker-tooltip/);
  assert.match(CSS, /\.blocked-action:focus-visible \.phase-blocker-tooltip/);
  assert.match(CSS, /\.phase-blocker-tooltip\.visible/);
  assert.match(CSS, /\.phase-blocker-tooltip\s*\{[\s\S]*z-index:\s*1000/s);
  assert.match(CSS, /\.phase-blocker-tooltip\s*\{[\s\S]*width:\s*min\(320px,/s);
  assert.match(CSS, /\.topbar\s*\{[\s\S]*position:\s*relative[\s\S]*z-index:\s*100/s);
  assert.match(CSS, /\.modal-backdrop\s*\{[\s\S]*z-index:\s*2000/s);
});

test("day order controls are only shown before the day order starts", () => {
  assert.match(APP, /dayOrderStarted/);
  assert.match(APP, /!dayOrderStarted && h\(\s*"div",\s*\{\s*className: "day-order-controls"/s);
});

test("day speeches require explicit start player and direction before actions unlock", () => {
  assert.match(APP, /isDayOrderReady/);
  assert.match(APP, /dayStartPlayerId: null/);
  assert.match(APP, /dayDirection: ""/);
  assert.match(APP, /currentSpeaker: 0/);
  assert.match(APP, /Выберите старт/);
  assert.match(APP, /Сначала выберите, кто открывает стол, и направление/);
  assert.match(APP, /h\("option", \{ value: "" \}, "Выберите игрока"\)/);
  assert.match(APP, /h\("option", \{ value: "" \}, "Выберите"\)/);
});

test("completed shootout result does not reopen day order prompts", () => {
  assert.match(APP, /const dayResultFinalized = Boolean\(state\.dayEliminationDone && state\.dayResult\)/);
  assert.match(APP, /const dayOrderStarted = dayResultFinalized \|\|/);
  assert.match(APP, /!dayResultFinalized && !dayOrderReady/);
  assert.match(APP, /if \(state\.dayEliminationDone && state\.dayResult\) return "";/);
});

test("detailed vote mode always shows the full audit without a separate audit toggle", () => {
  assert.doesNotMatch(APP, /Показать аудит голосов|Скрыть аудит|setShowVoteAudit|showVoteAudit/);
  assert.match(APP, /dayFlowDensity === "detailed"[\s\S]*vote-breakdown/);
});

test("compact vote mode shows only players with received votes or fouls", () => {
  assert.match(APP, /compactVoteSummaryPlayers/);
  assert.match(APP, /normalVotes \|\| fouls/);
  assert.match(APP, /compact-vote-lines/);
  assert.match(CSS, /\.compact-vote-ledger/);
  assert.match(CSS, /\.compact-vote-chip/);
  assert.match(CSS, /\.compact-vote-lines/);
});

test("compact vote summary follows the first vote order instead of vote totals", () => {
  assert.match(APP, /voteTargetOrder/);
  assert.match(APP, /orderedVoteSummaryIds/);
  assert.doesNotMatch(APP, /b\.totalVotes - a\.totalVotes/);
});

test("completed vote status uses a dedicated compact style instead of the dead pill", () => {
  assert.match(APP, /vote-status-pill/);
  assert.match(CSS, /\.vote-status-pill/);
  assert.doesNotMatch(APP, /dead-pill vote-done status-with-icon/);
});

test("black theme is available as a persisted floating toggle", () => {
  const blackThemeCss = CSS.slice(CSS.indexOf(".theme-black {"), CSS.indexOf("@media", CSS.indexOf(".theme-black {")));
  assert.match(APP, /THEME_KEY/);
  assert.match(APP, /loadTheme/);
  assert.match(APP, /className: `app theme-\$\{theme\}`/);
  assert.match(APP, /data-testid": "theme-toggle"/);
  assert.match(APP, /aria-pressed": theme === "black"/);
  assert.ok(APP.includes('Crown: "/src/assets/roles/don.png"'));
  assert.doesNotMatch(APP, /\/src\/assets\/roles\/(?:light|dark)\//);
  assert.match(CSS, /\.theme-black\s*\{/);
  assert.match(CSS, /body:has\(\.theme-black\)/);
  assert.match(CSS, /\.theme-black \.topbar/);
  assert.match(CSS, /\.theme-black \.player-card/);
  assert.match(CSS, /\.theme-black \.day-result-row/);
  assert.match(CSS, /\.theme-black \.vote-results-card > strong/);
  assert.match(blackThemeCss, /--accent:\s*#f0b429/);
  assert.doesNotMatch(blackThemeCss, /#2f81f7|#58a6ff|#79c0ff|rgba\(47,\s*129,\s*247/);
  assert.doesNotMatch(blackThemeCss, /#26313f|#101820|#111823|#303b49|#121821|#151b23|#111821|#101827|#1a2330/);
});

test("theme switch is an icon next to the floating journal", () => {
  assert.match(APP, /const toggleTheme = \(\) => setTheme/);
  assert.match(APP, /h\(FloatingLogPanel, \{[\s\S]*theme,[\s\S]*toggleTheme/s);
  assert.match(APP, /function FloatingLogPanel\(\{[^}]*theme,[^}]*toggleTheme[^}]*\}\)/);
  assert.match(APP, /className: "floating-log-actions"/);
  assert.match(APP, /className: "floating-theme-button theme-toggle"/);
  assert.match(APP, /h\(Icon, \{ name: theme === "black" \? "Sun" : "Moon" \}\)/);
  assert.doesNotMatch(APP, /className: "icon-text muted theme-toggle"/);
  assert.match(CSS, /\.floating-log\.open\s*\{[\s\S]*z-index:\s*3000/s);
  assert.match(CSS, /\.floating-log-actions/);
  assert.match(CSS, /\.floating-theme-button/);
  assert.match(CSS, /\.floating-theme-button\s*\{[\s\S]*background:\s*#f8fafc[\s\S]*color:\s*#1d2228/s);
  assert.match(CSS, /\.theme-black \.floating-theme-button\s*\{[\s\S]*background:\s*#181715[\s\S]*color:\s*var\(--ink\)/s);
  assert.doesNotMatch(CSS, /\.floating-theme-button\s*\{[\s\S]*background:\s*#f3b61f/s);
  assert.doesNotMatch(CSS, /\.theme-black \.floating-theme-button\s*\{[\s\S]*background:\s*#f0b429/s);
});

test("black theme keeps alive players brighter than dead players", () => {
  assert.match(CSS, /\.theme-black \.player-card:not\(\.dead\)\s*\{[\s\S]*background:\s*#1d1b17[\s\S]*border-color:\s*#4a4438/s);
  assert.match(CSS, /\.theme-black \.player-card:not\(\.dead\) \.player-number\s*\{[\s\S]*color:\s*#f8fafc/s);
  assert.match(CSS, /\.theme-black \.player-card\.dead,[\s\S]*\.theme-black \.day-player-row\.dead\s*\{[\s\S]*background:\s*#151411[\s\S]*border-color:\s*#3b3832[\s\S]*opacity:\s*0\.66/s);
  assert.match(CSS, /\.theme-black \.player-card\.dead \.dead-label\s*\{[\s\S]*background:\s*#1d1b17/s);
});

test("game over presentation stays above app chrome and remains readable in black theme", () => {
  assert.match(CSS, /\.game-over-overlay\s*\{[\s\S]*z-index:\s*10000/s);
  assert.match(CSS, /\.game-over-emblem \.asset-icon\s*\{[\s\S]*width:\s*56px[\s\S]*height:\s*56px/s);
  assert.match(CSS, /\.theme-black \.game-over-copy h2\s*\{[\s\S]*color:\s*#f8fafc/s);
});
