# Euchre Card Game Requirements

## Project Overview
Develop a digital Euchre card game with an initial MVP supporting single-player mode against AI opponents. The architecture must be modular to facilitate future integration of multiplayer functionality via Node.js, Express, and Socket.IO.

## MVP Scope (Minimum Viable Product)
- **Players**: 1 human player + 3 AI players.
- **Game Mode**: Single-player + 1 AI on users team, other 2 AIs on other team.
- **Interface**: Web-based UI displaying cards, game state, and player actions.
- **Card Assets**: Utilize existing SVG card images located in `public/cards/`.

## Game Rules (Euchre Specific)
- Standard Euchre rules:
  - 4 players, 24-card deck (9, 10, J, Q, K, A of each suit, excluding 2-8).
  - Trump suit selection.
  - Trick-taking gameplay.
  - Scoring: 4 point for lone hand, 1 point for a win, 2 for euchre (opponents make trump and don't make 3 tricks).
- AI Players: Implement basic AI logic for bidding, trump selection, and card playing (e.g., rule-based decisions).

## Technical Requirements
- **Frontend**: vue composition api; typescript; scss; 
- **Backend Preparation**: Design code structure to easily integrate Node.js/Express server with Socket.IO for real-time multiplayer.  - we will not build backend yet
- **Modularity**: Separate game logic from UI and networking to allow for future multiplayer expansion.
- **Assets**: Card images are available in `public/cards/`; ensure proper loading and display.

## Future Enhancements (Out of MVP Scope)
- Multiplayer: Support for 4 human players via networked server. or combination of 2 or more human + ai players
- Server: Node.js with Express and Socket.IO.
- Lobby system, matchmaking, real-time game state synchronization.
- Additional features: Game history, statistics, customizable AI difficulty.

## Non-Functional Requirements
- Responsive design for web browsers.
- Performance: Smooth gameplay, minimal lag.
- Accessibility: Basic keyboard navigation and screen reader support if applicable.

## Deliverables
- Functional MVP playable in browser.
- Well-documented code structure for easy extension.
- Requirements file (this document) for reference.