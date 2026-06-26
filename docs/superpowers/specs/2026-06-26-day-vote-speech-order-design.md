# Day Vote And Speech Order Design

## Context

The app is a browser-only React Mafia host tool. The day `speeches` phase currently drives both player speeches and, after day 1, vote capture. A player's vote is recorded during that player's speech, and the "Next player" action stays blocked until the current speaker has voted when voting is open.

Today the next speaker is selected by numeric player id: the app searches alive players after the current id, then wraps to the first incomplete alive player. The host cannot choose who opens the table or whether the table moves forward or backward.

## Requirement

For each daytime speech/voting phase, the host can choose:

- which alive player opens the table;
- the speech direction from that player: forward or backward.

Speeches and votes remain linked. The selected order controls both who speaks next and whose vote is collected next.

## Recommended Approach

Add persisted day order settings to game state:

- `dayStartPlayerId`: the player selected to open the table;
- `dayDirection`: either `forward` or `backward`.

When a day speech phase starts, default `dayStartPlayerId` to the first alive player and default `dayDirection` to `forward`. The host can change both controls while the day speech/voting flow is in progress.

The app will derive the day's speaker queue from the alive players, the chosen opener, and the chosen direction. Dead players are skipped. If the selected opener is no longer alive, the queue falls back to the first alive player. `nextSpeaker` uses this derived queue instead of numeric `id > current` ordering.

## UI

In the `DayFlowCard`, add a compact order control near the current speaker card:

- a select for "Opens table" with alive players;
- a segmented or select control for direction: "Forward" and "Backward";
- a short queue preview so the host can see the resulting order.

The existing current speaker card remains primary. The quick vote remains attached to the current speaker.

## Behavior

- On day 1, the order controls affect speeches only because there is no voting.
- On voting days, the order controls affect speeches and vote collection together.
- The current speaker cannot advance on voting days until their vote is recorded.
- Manually changing the opener or direction recalculates the pending queue. Already completed speakers/voters stay completed and are skipped.
- Finishing all alive players sets `timer.currentSpeaker` to `0` as it does today.

## Testing

Add focused tests for the pure queue calculation:

- forward order starts from the opener and wraps;
- backward order starts from the opener and wraps;
- dead players are skipped;
- invalid or dead opener falls back to the first alive player;
- completed speakers/voters are skipped when finding the next speaker.

Run the existing test suite and a production build after implementation.
