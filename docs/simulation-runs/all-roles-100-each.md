# All Roles Fuzz Report

Generated: 2026-06-27T15:09:43.799Z

Command: `node scripts/all-roles-fuzz.mjs 100 20260627`

## Run Summary

- Roles covered: don, mafia, shield, sheriff, maniac, lawyer, doctor, lover, bomber, kamikaze
- Games per role: 100
- Total games: 1000
- Seed: 20260627
- Player counts: random within each role's supported range
- Focus bias: each role cohort biases actions and deaths toward that role's mechanics while still running random day/night events.

Winner distribution: Маньяк: 73, Мафия: 584, Мирные: 343

## Role Matrix

| Role | Games | Focus actions | Findings | Observations | Avg turns | Winners |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| don | 100 | 231 | 0 | 1852 | 5.8 | Маньяк:11, Мафия:53, Мирные:36 |
| mafia | 100 | 426 | 0 | 1857 | 5.4 | Маньяк:8, Мафия:56, Мирные:36 |
| shield | 100 | 502 | 0 | 2983 | 7.9 | Маньяк:7, Мафия:73, Мирные:20 |
| sheriff | 100 | 318 | 0 | 1962 | 5.6 | Маньяк:10, Мафия:48, Мирные:42 |
| maniac | 100 | 297 | 0 | 2168 | 6.2 | Маньяк:4, Мафия:55, Мирные:41 |
| lawyer | 100 | 398 | 0 | 2519 | 6.7 | Маньяк:17, Мафия:53, Мирные:30 |
| doctor | 100 | 340 | 0 | 1916 | 5.6 | Маньяк:6, Мафия:55, Мирные:39 |
| lover | 100 | 141 | 0 | 2748 | 7.5 | Маньяк:2, Мафия:65, Мирные:33 |
| bomber | 100 | 116 | 0 | 2483 | 6.7 | Маньяк:3, Мафия:63, Мирные:34 |
| kamikaze | 100 | 596 | 0 | 3308 | 8.5 | Маньяк:5, Мафия:63, Мирные:32 |

## Findings

No invariant failures or wrong-logic findings were recorded.

## Rule-Review Observations

These are legal flows under the current app logic, but worth confirming against the intended table rules.

### doctor-heal

Count: 3870

Doctor selected heal target(s).

Examples:
  - don game 1, 19 players, seed 20361636: Doctor selected heal target(s).
  - don game 1, 19 players, seed 20361636: Doctor selected heal target(s).
  - don game 1, 19 players, seed 20361636: Doctor selected heal target(s).

### lawyer-alibi

Count: 3723

Lawyer gave alibi.

Examples:
  - don game 1, 19 players, seed 20361636: Lawyer gave alibi.
  - don game 1, 19 players, seed 20361636: Lawyer gave alibi.
  - don game 1, 19 players, seed 20361636: Lawyer gave alibi.

### don-check-clear

Count: 3269

Don performed a check.

Examples:
  - don game 1, 19 players, seed 20361636: Don performed a check.
  - don game 1, 19 players, seed 20361636: Don performed a check.
  - don game 2, 19 players, seed 20362645: Don performed a check.

### sheriff-check-clear

Count: 2357

Sheriff performed a check.

Examples:
  - don game 1, 19 players, seed 20361636: Sheriff performed a check.
  - don game 1, 19 players, seed 20361636: Sheriff performed a check.
  - don game 1, 19 players, seed 20361636: Sheriff performed a check.

### shield-block

Count: 1935

Shield blocked a night action.

Examples:
  - don game 2, 19 players, seed 20362645: Shield blocked a night action.
  - don game 2, 19 players, seed 20362645: Shield blocked a night action.
  - don game 2, 19 players, seed 20362645: Shield blocked a night action.

### night-attack-self-or-team

Count: 1362

A killing action targeted one of its own actors.

Examples:
  - don game 1, 19 players, seed 20361636: A killing action targeted one of its own actors.
  - don game 3, 19 players, seed 20363654: A killing action targeted one of its own actors.
  - don game 3, 19 players, seed 20363654: A killing action targeted one of its own actors.

### sheriff-found-black

Count: 1109

Sheriff performed a check.

Examples:
  - don game 2, 19 players, seed 20362645: Sheriff performed a check.
  - don game 3, 19 players, seed 20363654: Sheriff performed a check.
  - don game 3, 19 players, seed 20363654: Sheriff performed a check.

### mafia-targeted-black-role

Count: 1079

Mafia targeted a black-team role.

Examples:
  - don game 1, 19 players, seed 20361636: Mafia targeted a black-team role.
  - don game 3, 19 players, seed 20363654: Mafia targeted a black-team role.
  - don game 4, 20 players, seed 20364663: Mafia targeted a black-team role.

### bomber-marked

Count: 809

Bomber marked targets.

Examples:
  - don game 2, 19 players, seed 20362645: Bomber marked targets.
  - don game 3, 19 players, seed 20363654: Bomber marked targets.
  - don game 4, 20 players, seed 20364663: Bomber marked targets.

### shield-blocked-entire-mafia-team

Count: 765

Shield blocked mafia shot by targeting one mafia-side actor while other mafia actors were alive.

Examples:
  - don game 2, 19 players, seed 20362645: Shield blocked mafia shot by targeting one mafia-side actor while other mafia actors were alive.
  - don game 5, 20 players, seed 20365672: Shield blocked mafia shot by targeting one mafia-side actor while other mafia actors were alive.
  - don game 5, 20 players, seed 20365672: Shield blocked mafia shot by targeting one mafia-side actor while other mafia actors were alive.

### lover-chain

Count: 651

Lover death killed the paired lover.

Examples:
  - don game 1, 19 players, seed 20361636: Lover death killed the paired lover.
  - don game 2, 19 players, seed 20362645: Lover death killed the paired lover.
  - don game 3, 19 players, seed 20363654: Lover death killed the paired lover.

### kamikaze-redirect

Count: 644

Kamikaze redirected incoming attack(s).

Examples:
  - don game 2, 19 players, seed 20362645: Kamikaze redirected incoming attack(s).
  - don game 6, 21 players, seed 20366681: Kamikaze redirected incoming attack(s).
  - don game 7, 21 players, seed 20367690: Kamikaze redirected incoming attack(s).

### doctor-save

Count: 523

Doctor saved a night victim.

Examples:
  - don game 4, 20 players, seed 20364663: Doctor saved a night victim.
  - don game 5, 20 players, seed 20365672: Doctor saved a night victim.
  - don game 6, 21 players, seed 20366681: Doctor saved a night victim.

### bomber-chain

Count: 427

Bomber death killed bombed players.

Examples:
  - don game 2, 19 players, seed 20362645: Bomber death killed bombed players.
  - don game 3, 19 players, seed 20363654: Bomber death killed bombed players.
  - don game 4, 20 players, seed 20364663: Bomber death killed bombed players.

### lawyer-alibi-save

Count: 408

A voted player stayed alive because of lawyer alibi.

Examples:
  - don game 10, 22 players, seed 20370717: A voted player stayed alive because of lawyer alibi.
  - don game 14, 24 players, seed 20374753: A voted player stayed alive because of lawyer alibi.
  - don game 17, 6 players, seed 20377780: A voted player stayed alive because of lawyer alibi.

### kamikaze-multi-redirect

Count: 363

Kamikaze redirected incoming attack(s).

Examples:
  - don game 12, 23 players, seed 20372735: Kamikaze redirected incoming attack(s).
  - mafia game 81, 20 players, seed 20542356: Kamikaze redirected incoming attack(s).
  - shield game 31, 23 players, seed 20591906: Kamikaze redirected incoming attack(s).

### don-found-sheriff

Count: 320

Don performed a check.

Examples:
  - don game 1, 19 players, seed 20361636: Don performed a check.
  - don game 1, 19 players, seed 20361636: Don performed a check.
  - don game 1, 19 players, seed 20361636: Don performed a check.

### don-revenge

Count: 121

Dead Don took previously found sheriff.

Examples:
  - don game 6, 21 players, seed 20366681: Dead Don took previously found sheriff.
  - don game 8, 22 players, seed 20368699: Dead Don took previously found sheriff.
  - don game 11, 23 players, seed 20371726: Dead Don took previously found sheriff.

### sheriff-shot

Count: 61

Sheriff shot a known black target.

Examples:
  - sheriff game 1, 14 players, seed 20661636: Sheriff shot a known black target.
  - sheriff game 3, 15 players, seed 20663654: Sheriff shot a known black target.
  - sheriff game 5, 15 players, seed 20665672: Sheriff shot a known black target.

## Notes

- This harness imports the current app engine and UI helper exports, including `nightTargetOptions()`.
- Kamikaze redirect target options are checked against the current self-target exclusion.
- Death chains model the app's bomber, lovers, and Don revenge behavior.
- Raw data is in `/Users/dporshniev/Desktop/mafia-host-react/docs/simulation-runs/all-roles-100-each.json`.
