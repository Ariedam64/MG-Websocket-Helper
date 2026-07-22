# RoomFrame compatibility — design

## Context

The game's netcode is changing: the `PartialState` message is being replaced by a `RoomFrame` message. The patch data is the same, just relocated:

- Old: `msg.type === "PartialState"`, patches at `msg.patches`
- New: `msg.type === "RoomFrame"`, patches at `msg.state.patches`

`Welcome` and `subscribeToPatches()` are unaffected. The rollout timing across game servers is unknown, so both formats must be supported simultaneously until the old one is confirmed gone.

## Consumers affected (as of this change)

- [state/state.js](../../../state/state.js) — `handleMessage` / `handlePartialState`, reads `msg.type` and `msg.patches`
- [main.js](../../../main.js) — dumps patches to `dumps/patches.json`, reads `msg.type` and `msg.patches`
- [tests/helper.js](../../../tests/helper.js) — test harness patch listener, reads `msg.type` and `msg.patches`

## Approach

Normalize at the single point where raw WebSocket frames become parsed messages: `Connection._onRawMessage` in [connection.js](../../../connection.js), right before `this.onMessage(parsed)` is invoked.

If `parsed.type === "RoomFrame"`, rewrite it to the shape the rest of the codebase already expects:

```js
{ ...parsed, type: "PartialState", patches: parsed.state?.patches || [] }
```

If `parsed.type === "PartialState"` (old format, still possibly seen during rollout), pass through unchanged.

This means `state.js`, `main.js`, and `tests/helper.js` require **no changes** — they keep checking `msg.type === "PartialState"` and reading `msg.patches` exactly as today. The compatibility shim lives in one place and can be deleted later once the game has fully migrated to `RoomFrame`.

## Rejected alternatives

- **Update each consumer to check both message types.** Rejected: duplicates the compat logic across 3 files, higher chance of missing a 4th consumer later.
- **Hard-cut to `RoomFrame` only, drop `PartialState` support.** Rejected by user: the game may roll out the change gradually or roll back temporarily, which would break the mod during that window.

## Testing

Existing `tests/*.test.js` files exercise the real game connection via `tests/helper.js` and already assert on patches — once the game switches to `RoomFrame` in production, these tests validate the fix end-to-end without modification. Additionally, a small unit-level check of the normalization function itself (given a `RoomFrame`-shaped input, produces the expected `PartialState`-shaped output) should be added next to wherever the normalization logic lives.
