# Chat Implementation Plan

## Overview
Add real-time chat to multiplayer games with speech bubbles above avatars and a frosted glass input always visible on screen.

## UI Components

### 1. ChatInput (bottom-left, always visible in MP)
```
┌─────────────────────────────────┬───┐
│ Type a message...               │ 😊│
└─────────────────────────────────┴───┘
```
- Frosted glass style (matches game UI)
- Compact: ~250px wide, single line
- Send on Enter
- Emoji/quick-react icon at end → opens picker
- Position: bottom-left, above safe area

### 2. Quick Reactions Picker
```
┌─────────────────────────────┐
│ 👍  Nice!  GG  😂  Oops  🎉 │
└─────────────────────────────┘
```
- Pops up above input when emoji icon tapped
- Mix of emoji and short phrases
- Tap to send immediately
- Dismisses on selection or tap outside

### 3. ChatBubble (speech bubble above avatar)
```
      ┌──────────────┐
      │ Nice play!   │
      └──────┬───────┘
             ▼
         [Avatar]
```
- Appears above sender's PlayerAvatar
- Frosted/glass style with subtle border
- Duration: 3s base + 1s per 50 chars (max 8s)
- Fade out animation
- Queue multiple messages (show latest, queue others)
- Max width ~200px, text wraps

### 4. ChatIcon (below HUD menu, top-left)
```
  [⋮]  ← HUD menu
  [💬] ← Chat icon (dot indicator when unread)
```
- Shows unread indicator (red dot or badge count)
- Tap opens ChatPanel

### 5. ChatPanel (slide-out from left)
```
┌─────────────────────┐
│ Chat           [✕]  │
├─────────────────────┤
│ Steve: Nice play!   │
│ Bot1: GG            │
│ You: Thanks!        │
│                     │
│                     │
└─────────────────────┘
```
- Slides in from left edge
- Scrollable message history
- Player names color-coded (or with seat indicator)
- Timestamps optional (relative: "2m ago")
- Close button or tap outside to dismiss
- On wide screens (>1200px): option to pin open

## Data Model

### ChatMessage
```typescript
interface ChatMessage {
  id: string           // unique id (odusId + timestamp)
  odusId: string       // sender's odusId
  seatIndex: number    // sender's seat (for positioning bubble)
  playerName: string   // display name
  text: string         // message content
  timestamp: number    // Date.now()
  isQuickReact?: boolean  // true if from quick reaction
}
```

### Game State Addition
```typescript
interface GameState {
  // ... existing fields
  chatMessages: ChatMessage[]  // last N messages (cap at 50?)
}
```

### Client State
```typescript
// In multiplayer store or separate chat store
chatMessages: ChatMessage[]
lastReadTimestamp: number      // for unread indicator
activeBubbles: Map<number, ChatMessage>  // seatIndex → current bubble
```

## WebSocket Events

### Client → Server
```typescript
// Send chat message
{ type: 'chat_message', text: string }
```

### Server → Client
```typescript
// Broadcast to all players in room
{ type: 'chat_broadcast', message: ChatMessage }
```

## Server Logic

### Validation
- Max length: 120 characters
- Rate limit: 1 message per 2 seconds per player
- Sanitize text (strip HTML, trim whitespace)
- Player must be in active game

### Broadcast
- Add message to game state
- Broadcast to all players in room (including sender)
- Trim chatMessages array if > 50 messages

## Implementation Order

### Phase 1: Core Infrastructure
1. Add `chatMessages` to game state (shared types)
2. Add WebSocket handlers (server)
3. Add chat store/state (client)

### Phase 2: Input & Sending
4. Create `ChatInput.vue` component
5. Wire up send functionality
6. Add to game boards (MP mode only)

### Phase 3: Display
7. Create `ChatBubble.vue` component
8. Position bubbles relative to PlayerAvatar
9. Implement show/fade timing

### Phase 4: History & Polish
10. Create `ChatIcon.vue` with unread indicator
11. Create `ChatPanel.vue` slide-out
12. Add quick reactions picker
13. Wide-screen pinned panel option

## Component Placement

### In CardTable.vue (or individual game boards)
```vue
<template>
  <!-- Existing content -->
  
  <!-- Chat (multiplayer only) -->
  <template v-if="mode === 'multiplayer'">
    <ChatInput @send="sendChatMessage" />
    <ChatIcon :unread-count="unreadCount" @click="showChatPanel = true" />
    <ChatPanel v-if="showChatPanel" :messages="chatMessages" @close="showChatPanel = false" />
    
    <!-- Bubbles rendered per-avatar -->
    <ChatBubble
      v-for="(bubble, seatIndex) in activeBubbles"
      :key="seatIndex"
      :message="bubble"
      :position="getAvatarPosition(seatIndex)"
    />
  </template>
</template>
```

## Styling Notes

- Use existing `frosted-panel` mixin for glass effect
- Input: subtle, doesn't compete with game
- Bubbles: slightly more prominent, readable
- Panel: standard modal-light style
- Colors: player names could match seat colors or team

## Edge Cases

- Player leaves mid-game: messages stay, marked as "(left)"?
- Game ends: chat clears on new game, or keep for rematch?
- Long messages: truncate in bubble, full in panel
- Rapid messages: queue bubbles, don't overlap
- Mobile keyboard: input should stay above keyboard

## Future Enhancements (not v1)

- Message reactions (👍 on a message)
- @mentions with notification
- Chat sounds (subtle, optional)
- Block/mute player
- Pre-game lobby chat
