# Euchre Singleplayer Restore Test Checklist

Use this checklist to manually validate singleplayer Euchre resume behavior.

## Baseline

- Start a new singleplayer Euchre game.
- Play at least one full trick.
- Leave the game to trigger save.
- Re-enter and confirm resume prompt appears.

## Restore Scenarios

### 1) Bidding Round Restore
- Save/exit during `BiddingRound1` when AI is active.
- Resume game.
- Verify table and hands restore correctly.
- Verify AI continues only after visuals finish restoring.
- Verify no duplicate AI actions occur.

### 2) Dealer Discard Restore (User Dealer)
- Save/exit at dealer discard prompt.
- Resume game.
- Verify prompt is shown and user can discard exactly once.
- Verify turn indicator remains stable.

### 3) Mid-Trick Restore (1-3 cards played)
- Save/exit after 1, 2, and 3 cards in trick (run separately).
- Resume game each time.
- Verify trick cards appear in center in correct order.
- Verify next actor is correct.

### 4) AI Turn Restore
- Save/exit when `currentPlayer` is AI in `Playing` phase.
- Resume game.
- Verify AI action starts after visual restore completes.
- Verify no flash/jump in turn indicator before first resumed AI move.

### 5) Human Turn Restore
- Save/exit when it is user turn in `Playing` phase.
- Resume game.
- Verify no AI action auto-runs.
- Verify user can immediately play valid cards.

## Persistence Safety

- Trigger resume and quickly leave immediately.
- Re-enter and verify state is still coherent.
- Verify no corrupted snapshot behavior.

## Expected Invariants

- Restore sequence: hydrate state -> rebuild visuals -> resume turn engine.
- No `setTimeout` race should drive restore AI start.
- During restore, phase/trump watcher animations should not re-run.
- Save operation should not run while restore transaction is active.
