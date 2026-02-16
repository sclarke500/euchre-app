# Bug: President Multiplayer User Card Animation Not Working

## Summary
In President multiplayer mode, when the user plays a card, it does not animate to the center pile. Opponent card plays animate correctly. This issue does NOT occur in singleplayer mode.

## Symptoms
1. User selects card(s) and clicks Play
2. Card disappears from hand instantly (no animation)
3. Card appears in center pile (correct position)
4. Opponent cards animate correctly from their hands to the pile

## Debug Logs Collected

### From usePresidentDirector.ts
```
[PresidentDirector] animateCardPlayMP: playerId=0, myId=0, seat=0, cards=diamonds-2, handSize=14
[PresidentDirector] User play - engine hand cards: (14) ['hearts-4', 'spades-4', 'diamonds-5', 'spades-5', 'hearts-6', 'diamonds-7', 'clubs-7', 'clubs-8', 'clubs-9', 'clubs-10', 'diamonds-10', 'diamonds-Q', 'spades-A', 'diamonds-2']
[PresidentDirector] Looking for diamonds-2, found=true
[PresidentDirector] animateCardPlayMP: moving 1 cards to pile: ['diamonds-2']
```

**Observations:**
- `seat=0` confirms this is the user's play
- `found=true` confirms the card IS in the engine hand
- The card ID `diamonds-2` exists in the engine hand array
- Code proceeds to "moving 1 cards to pile"

### Pending Logs (from useCardTable.ts moveCard)
Added but not yet captured:
```javascript
console.log(`[CardTable] moveCard: ${cardId} from ${from.id} to ${to.id}`)
// Then either:
console.warn(`[CardTable] moveCard: ${cardId} not found in ${from.id}`)
// Or:
console.log(`[CardTable] moveCard: animating ${cardId} to`, target)
// Or:
console.warn(`[CardTable] moveCard: no cardRef for ${cardId}`)
```

## Code Flow

### 1. User Action
```
PresidentEngineBoard.vue: playSelectedCards()
  → game.playCards(selectedCards.value)
  → selectedCardIds.value = new Set()  // Clears selection
```

### 2. Server Communication
```
presidentMultiplayerStore.ts: playCards(cardIds)
  → websocket.send({ type: 'president_play_cards', cardIds, ... })
  → (Does NOT clear local hand - server will send updated state)
```

### 3. Server Response (queued)
Server sends two messages:
1. `president_play_made` - { playerId, cards, playerName }
2. `president_game_state` - Full game state with updated hands

### 4. Director Processes Queue
```
usePresidentDirector.ts: processOneMessage()
  case 'president_play_made':
    → animateCardPlayMP(msg.cards, msg.playerId)
    → game.applyMessage(msg)  // Applied AFTER animation
```

### 5. Animation Function
```javascript
// usePresidentDirector.ts: animateCardPlayMP()
const seatIndex = playerIdToSeatIndex(playerId)  // Returns 0 for user
const hand = engine.getHands()[seatIndex]        // Gets user's engine hand
const centerPile = engine.getPiles().find(p => p.id === 'center')

// For user play (seatIndex === 0):
const hasCard = hand.cards.some(m => m.card.id === card.id)  // Returns TRUE
if (hasCard) {
  cardIdsToMove.push(card.id)  // Card ID added to move list
}

// Animation call:
const movePromises = cardIdsToMove.map((cardId, i) => {
  const targetPos = getPileCardPosition(playIndex, i, cards.length)
  centerPile.setCardTargetPosition(cardId, targetPos)
  return engine.moveCard(cardId, hand, centerPile, targetPos, CARD_PLAY_MS)
})
await Promise.all(movePromises)
```

### 6. Engine moveCard Function
```javascript
// useCardTable.ts: moveCard()
async function moveCard(cardId, from, to, targetPos, duration) {
  const managed = from.removeCard(cardId)  // Remove from source hand
  if (!managed) return                      // <-- SILENT FAILURE if not found
  
  to.addManagedCard(managed)               // Add to destination pile
  
  const cardRef = cardRefs.get(cardId)     // Get Vue component ref
  if (cardRef) {
    to.setCardRef(cardId, cardRef)
    const target = targetPos ?? to.getCardPosition(to.cards.length - 1)
    await cardRef.moveTo(target, duration) // <-- Actual animation
  }
  // If no cardRef, no animation happens (silent)
  
  refreshCards()
}
```

## Likely Failure Points

### Hypothesis 1: Card not in container (from.removeCard fails)
The `hand.cards.some()` check in the director finds the card, but `from.removeCard()` in the engine might fail. These could be checking different arrays if there's a mismatch between:
- Director's `hand.cards` 
- Engine container's internal cards array

### Hypothesis 2: No cardRef registered
The card ref might not be in the `cardRefs` Map. This could happen if:
- The card was re-rendered and lost its ref registration
- The ref was never registered for multiplayer hands
- Vue's reactive system caused ref to be garbage collected

### Hypothesis 3: Animation runs but not visible
The animation could be running but:
- From/to positions are the same (instant "animation")
- Card is being moved from wrong position
- Z-index issues making animation invisible

## Key Differences: Singleplayer vs Multiplayer

### Singleplayer
- Uses `game.setPlayAnimationCallback()` - store awaits animation
- Animation runs BEFORE game state updates
- Cards are definitely in engine hand when animation starts

### Multiplayer  
- Uses message queue processed by director
- `president_play_made` processed, then `president_game_state`
- Animation runs via `animateCardPlayMP()` 
- `game.applyMessage()` called AFTER animation (should be fine)

## Relevant Files
- `packages/client/src/games/president/usePresidentDirector.ts` - Animation orchestration
- `packages/client/src/games/president/presidentMultiplayerStore.ts` - State management
- `packages/client/src/games/president/usePresidentGameAdapter.ts` - SP/MP abstraction
- `packages/client/src/composables/useCardTable.ts` - Card engine, moveCard function
- `packages/client/src/components/cardContainers.ts` - Hand, Pile container classes

## WebSocket Message Flow (from bug reports)
```json
// Recent inbound messages show rapid game_state + your_turn pairs:
[
  { "ts": 1771277705028, "type": "president_game_state" },
  { "ts": 1771277705028, "type": "president_your_turn" },
  { "ts": 1771277710124, "type": "president_your_turn" },
  // etc.
]
```

## Questions to Investigate
1. Is `from.removeCard(cardId)` returning null despite `hand.cards.some()` returning true?
2. Is `cardRefs.get(cardId)` returning undefined for user's cards?
3. Are the card IDs in the engine hand different from what the server sends?
4. Is something else modifying the engine hand between the check and the move?

## Recent Related Fixes
1. Fixed opponent multi-card plays (was reusing same placeholder)
2. Fixed validPlays flashing (game_state was clearing turn state)
3. Fixed pile sync after server restart
4. Added debug logging throughout the flow

## To Reproduce
1. Go to 67cardgames.com
2. Start President multiplayer game (with bots to fill)
3. Wait for your turn
4. Select a card and click Play
5. Observe: card disappears instantly, no animation
6. Check browser console for `[CardTable] moveCard` logs
