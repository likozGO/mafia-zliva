# Random Mafia Game Simulation Report

Generated: 2026-06-27T01:10:58.915Z

Command: `node scripts/random-simulation.mjs 300 20260627 700`

## Run Summary

| Metric | Value |
| --- | ---: |
| Games requested | 300 |
| Games completed | 296 |
| Games crashed | 0 |
| Games unfinished | 4 |
| Games blocked by app state | 4 |
| Seed | 20260627 |
| Max steps per game | 700 |
| Average steps | 20.7 |
| Average completed-game day | 4.9 |

Player-count coverage: 10:14, 11:13, 12:16, 13:13, 14:15, 15:17, 16:17, 17:15, 18:17, 19:17, 20:14, 21:18, 22:17, 23:14, 24:17, 6:18, 7:14, 8:17, 9:17

Initial-immunity coverage: 0:56, 1:48, 2:54, 3:56, 4:46, 5:40

## Winner Distribution

| Winner | Games |
| --- | ---: |
| Маньяк | 19 |
| Мафия | 181 |
| Мирные | 96 |

## Interpretation

- No runtime crashes were observed.
- Blocking bug: 4 game(s) reached day 2 with every alive player protected by start immunity. Because immunity expires only after vote results, the vote target list is empty and the game cannot advance.
- Rule review: self-voting is currently allowed and occurred 1184 time(s).
- Rule review: killing actions can target their own actor/team and did so 426 time(s).
- Rule review: Shield can block the whole mafia shot by targeting one mafia-side actor while other mafia actors are alive; observed 113 time(s).
- Rule review: Kamikaze can redirect a hit back to themselves; observed 17 time(s).

## Invariant Failures and Runtime Anomalies

### no-vote-target (high)

Count: 4

Current speaker had no available vote targets, so the day vote could not progress.

Examples:
  - Game 26, step 6, 6 players. Details: `{"currentSpeaker":5,"aliveIds":[1,2,3,4,5],"activeImmunityIds":[3,2,1,4,5],"startImmunityIds":[3,2,1,4,5],"startImmunityExpired":false}`. Latest log: "День 2: речи игроков: начались речи игроков".
  - Game 116, step 6, 6 players. Details: `{"currentSpeaker":4,"aliveIds":[1,2,3,4,5],"activeImmunityIds":[4,5,3,1,2],"startImmunityIds":[4,5,3,1,2],"startImmunityExpired":false}`. Latest log: "День 2: речи игроков: начались речи игроков".
  - Game 160, step 6, 6 players. Details: `{"currentSpeaker":5,"aliveIds":[1,3,4,5],"activeImmunityIds":[4,3,5,1],"startImmunityIds":[4,3,5,1],"startImmunityExpired":false}`. Latest log: "День 2: речи игроков: начались речи игроков".

## Rule-Review Observations

These are flows the app currently allows. They did not necessarily crash the game, but they are worth confirming against the intended Mafia rules.

### day-self-vote

Count: 1184

Player 6 voted for themselves.

Examples:
  - Game 1, step 6, 14 players. Details: `{"voter":6,"target":6}`. Latest log: "День 2: речи игроков: слово у игрока 6".
  - Game 2, step 6, 14 players. Details: `{"voter":11,"target":11}`. Latest log: "День 2: речи игроков: слово у игрока 11".
  - Game 2, step 6, 14 players. Details: `{"voter":13,"target":13}`. Latest log: "День 2: речи игроков: слово у игрока 13".

### night-attack-self-or-team

Count: 426

A night killing action selected one of its own actors as the kill target.

Examples:
  - Game 3, step 4, 15 players. Details: `{"actionKey":"mafia","target":8,"targetRoles":["mafia"]}`. Latest log: "Ночь 2: Врач: игрок 14".
  - Game 3, step 22, 15 players. Details: `{"actionKey":"mafia","target":12,"targetRoles":["mafia"]}`. Latest log: "Ночь 6: началась ночь 6".
  - Game 4, step 12, 15 players. Details: `{"actionKey":"mafia","target":11,"targetRoles":["mafia"]}`. Latest log: "Ночь 4: Адвокат: игрок 6".

### mafia-targeted-black-role

Count: 323

Mafia shot a black-team role.

Examples:
  - Game 3, step 4, 15 players. Details: `{"target":8,"targetRoles":["mafia"]}`. Latest log: "Ночь 2: Врач: игрок 14".
  - Game 3, step 22, 15 players. Details: `{"target":12,"targetRoles":["mafia"]}`. Latest log: "Ночь 6: началась ночь 6".
  - Game 4, step 12, 15 players. Details: `{"target":11,"targetRoles":["mafia"]}`. Latest log: "Ночь 4: Адвокат: игрок 6".

### shield-blocked-entire-mafia-team

Count: 113

Shield blocked the mafia team action by targeting one mafia-side actor while other mafia actors were alive.

Examples:
  - Game 5, step 4, 16 players. Details: `{"blockedBy":7,"remainingActors":[13,8,16]}`. Latest log: "Ночь 2: Щит: игрок 7".
  - Game 7, step 8, 16 players. Details: `{"blockedBy":1,"remainingActors":[9,10]}`. Latest log: "Ночь 3: Щит: игрок 1".
  - Game 13, step 4, 19 players. Details: `{"blockedBy":11,"remainingActors":[8,13,12,5]}`. Latest log: "Ночь 2: Щит: игрок 11".

### kamikaze-redirected-to-self

Count: 17

Kamikaze redirected a hit back to themselves.

Examples:
  - Game 14, step 27, 19 players. Details: `{"target":9}`. Latest log: "Ночь 7: камикадзе 9 был выбран целью".
  - Game 17, step 27, 21 players. Details: `{"target":6}`. Latest log: "Ночь 7: Дон: игрок 6".
  - Game 66, step 21, 23 players. Details: `{"target":14}`. Latest log: "Ночь 6: Маньяк: игрок 2".

## Notes

- The harness drives the app's rendered event handlers through a minimal React-like renderer. It does not call private transition functions directly.
- Roles are randomized per game while preserving the role counts and uniqueness enforced by `validateRoles()`.
- The run intentionally performs occasional premature "next phase" clicks during incomplete day/night phases to exercise blockers.
- Re-run with the same seed to reproduce the same sequence: `node scripts/random-simulation.mjs 300 20260627 700`.
