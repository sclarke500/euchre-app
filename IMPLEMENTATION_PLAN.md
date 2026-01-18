# Euchre Frontend MVP - Implementation Plan

## Phase 1: Project Setup & Core Architecture

### 1.1 Project Configuration
- [ ] Create Vite config with SCSS support
- [ ] Set up TypeScript config for strict mode
- [ ] Create folder structure:
  ```
  src/
    components/     # Vue components
    composables/    # Composition API composables
    models/         # TypeScript types/interfaces
    services/       # Game logic services
    stores/         # State management
    assets/         # CSS/SCSS files
    utils/          # Helper functions
  ```

### 1.2 Core Type Definitions
- [ ] Define core game types (`models/types.ts`):
  - Card (suit, rank, value)
  - Suit (Hearts, Diamonds, Clubs, Spades)
  - Rank (9, 10, J, Q, K, A)
  - Player
  - GameState
  - Round
  - Trick
  - Trump

## Phase 2: Game Logic (Services Layer)

### 2.1 Deck & Card Management (`services/deck.ts`)
- [ ] Create deck initialization (24 cards)
- [ ] Implement shuffle algorithm
- [ ] Deal cards (5 per player + 4 for kitty)
- [ ] Card comparison logic (considering trump)

### 2.2 Trump Selection Logic (`services/trump.ts`)
- [ ] First round bidding (turn up card)
- [ ] Second round bidding (call any suit)
- [ ] Handle "going alone" option
- [ ] Dealer "stick the dealer" rule

### 2.3 Trick-Taking Logic (`services/trick.ts`)
- [ ] Validate legal plays (must follow suit)
- [ ] Determine trick winner
- [ ] Handle trump hierarchy (right/left bower)
- [ ] Track tricks won by each team

### 2.4 Scoring Logic (`services/scoring.ts`)
- [ ] Calculate points per round
- [ ] Handle euchre (2 points)
- [ ] Handle lone hand (4 points)
- [ ] Track game score (first to 10 wins)

### 2.5 AI Logic (`services/ai.ts`)
- [ ] AI bidding strategy (basic rule-based)
- [ ] AI trump selection
- [ ] AI card playing (follow suit, trump when void)
- [ ] Teammate cooperation hints

## Phase 3: State Management

### 3.1 Game Store (`stores/gameStore.ts`)
- [ ] Current game state (reactive)
- [ ] Players array (human + 3 AI)
- [ ] Current round/trick state
- [ ] Score tracking
- [ ] Action methods:
  - `startNewGame()`
  - `dealCards()`
  - `makeBid()`
  - `playCard()`
  - `nextTrick()`

## Phase 4: UI Components

### 4.1 Core Layout Components
- [ ] `App.vue` - Main app container
- [ ] `GameBoard.vue` - Main game layout
- [ ] `ScoreBoard.vue` - Display scores
- [ ] `PlayerHand.vue` - Display player's cards
- [ ] `PlayArea.vue` - Center area for played cards

### 4.2 Card Components
- [ ] `Card.vue` - Individual card display
  - Props: suit, rank, faceUp, selectable
  - Emit: cardClick
  - Load SVG from `/cards/` directory

### 4.3 Game Flow Components
- [ ] `TrumpSelection.vue` - Bidding interface
- [ ] `TrickWinner.vue` - Show trick winner animation
- [ ] `GameOver.vue` - End game summary

### 4.4 UI Helper Components
- [ ] `OpponentHand.vue` - Card backs for AI players
- [ ] `TrumpIndicator.vue` - Show current trump suit
- [ ] `ActionButtons.vue` - Pass/Order Up/Go Alone

## Phase 5: Styling (SCSS)

### 5.1 Base Styles (`assets/styles/`)
- [ ] `_variables.scss` - Colors, spacing, breakpoints
- [ ] `_reset.scss` - CSS reset
- [ ] `_layout.scss` - Game board layout (4 players positioned)
- [ ] `_cards.scss` - Card styling, animations
- [ ] `main.scss` - Import all styles

### 5.2 Component-Specific Styles
- [ ] Card hover/select states
- [ ] Player position layouts (bottom, left, top, right)
- [ ] Responsive design for different screen sizes
- [ ] Animation for card dealing, playing, trick taking

## Phase 6: Game Flow Integration

### 6.1 Game Loop
- [ ] Start game → Deal cards
- [ ] Bidding phase (2 rounds if needed)
- [ ] Play 5 tricks
- [ ] Score calculation
- [ ] Next round or game over

### 6.2 Turn Management
- [ ] Track whose turn it is
- [ ] Enable/disable player actions
- [ ] Auto-play AI turns with delay
- [ ] Visual indicators for current player

### 6.3 Animations & Feedback
- [ ] Card dealing animation
- [ ] Card playing animation
- [ ] Trick winner collection animation
- [ ] Score update feedback

## Phase 7: Testing & Polish

### 7.1 Game Logic Testing
- [ ] Test trump hierarchy (right/left bower)
- [ ] Test legal play validation
- [ ] Test scoring scenarios
- [ ] Test AI behavior

### 7.2 UI/UX Polish
- [ ] Smooth animations
- [ ] Clear visual feedback
- [ ] Loading states
- [ ] Error handling

### 7.3 Accessibility
- [ ] Keyboard navigation for card selection
- [ ] Clear text labels
- [ ] Color contrast

## Implementation Order (Recommended)

**Week 1: Foundation**
1. Phase 1 (Setup & Architecture)
2. Phase 2.1 (Deck & Cards)
3. Phase 3.1 (Basic store)

**Week 2: Core Game**
4. Phase 2.2-2.4 (Trump, Tricks, Scoring)
5. Phase 4.1-4.2 (Layout & Card components)
6. Phase 5.1 (Base styling)

**Week 3: AI & Flow**
7. Phase 2.5 (AI logic)
8. Phase 6.1-6.2 (Game loop & turns)
9. Phase 4.3-4.4 (Remaining components)

**Week 4: Polish**
10. Phase 6.3 (Animations)
11. Phase 5.2 (Component styling)
12. Phase 7 (Testing & polish)

## Notes for Future Multiplayer

- Keep all game logic in services (not in components)
- Game state should be easily serializable
- Actions should be command-based (easy to send over socket)
- Separate "current player" logic from "human player" logic
