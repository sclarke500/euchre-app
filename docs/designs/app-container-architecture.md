# AppContainer Architecture

## Overview

Implement a unified container for the entire app experience (everything except landing page). On tablets/desktop, the container renders at fixed dimensions and scales via CSS transform. On mobile, it passes through without scaling but handles orientation.

## Goals

1. **Design once** — lock card sizes, positions, fonts at 1280×720
2. **Scale uniformly** — CSS transform handles all viewport adaptation on desktop/tablet
3. **Simplify codebase** — remove reactive resize/repositioning code from games
4. **Premium feel** — app floats in a branded background on larger screens
5. **Consistent experience** — same visual result on all non-mobile devices

## Route Structure

```
/                    → LandingView (NOT in AppContainer)
                       Marketing page, scrollable, responsive

/app/                → AppContainer wrapper (Vue Router nested route)
  ├── (index)        → MainMenu (/app or /app/)
  ├── lobby/:code?   → Lobby
  ├── game/:type/:id → Active multiplayer game
  └── play/:game     → Single player game

Alternative (keep existing routes, wrap at App.vue level):
/                    → Landing (no container)
/play                → Menu (in container)
/play/:game          → SP game (in container)  
/lobby/:code?        → Lobby (in container)
/game/:type/:id      → MP game (in container)
```

**Decision needed:** New `/app` parent route vs wrap existing routes at App.vue level?

Recommendation: Wrap at App.vue level based on route path. Simpler migration, no URL changes.

## AppContainer Behavior

### Desktop/Tablet Mode (viewport ≥ 768px wide AND ≥ 500px tall)

```
┌─────────────────────────────────────────────┐
│  ░░░░░░░░ branded background ░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░┌─────────────────────────────┐░░░░░  │
│  ░░░░│                             │░░░░░  │
│  ░░░░│    1280×720 app window      │░░░░░  │
│  ░░░░│    (CSS transform: scale)   │░░░░░  │
│  ░░░░│                             │░░░░░  │
│  ░░░░└─────────────────────────────┘░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────────────┘
```

- Container: fixed 1280×720 (16:9)
- Scale: fit to viewport maintaining aspect ratio
- Max scale: 1.25× (don't blow up too much)
- Background: robot image faded, or subtle pattern
- Border radius + shadow on container for "floating window" effect

### Mobile Mode (viewport < 768px wide OR < 500px tall)

- No scaling — content fills viewport
- Responsive behavior for orientation changes
- Landscape enforcement on game routes (existing behavior)
- Card sizing uses mobile scales

### Viewport Locking (Desktop/Tablet)

When AppContainer is active in scaled mode:
1. Lock `useCardSizing` viewport to 1280×720
2. All child components see fixed dimensions
3. No resize event handling needed
4. Single layout calculation on mount

## Code Changes Required

### 1. AppContainer Component

```vue
<template>
  <div class="app-container" :class="{ scaled: isScaled }">
    <div v-if="isScaled" class="background-layer" />
    <div 
      class="app-viewport"
      :style="isScaled ? scaledStyle : {}"
    >
      <router-view />
    </div>
  </div>
</template>
```

### 2. App.vue Integration

```vue
<template>
  <!-- Landing page: no container -->
  <router-view v-if="isLandingPage" />
  
  <!-- Everything else: wrapped in AppContainer -->
  <AppContainer v-else>
    <router-view />
  </AppContainer>
</template>
```

### 3. Remove Reactive Resize Code

Files to audit/modify:
- `useCardSizing.ts` — keep for mobile, skip updates when locked
- `useCardTable.ts` — remove resize watchers
- `useTableLayout.ts` — static calculation only
- `CardTable.vue` — remove resize handling
- `GameLayout.vue` — simplify for fixed dimensions
- `MainMenu.vue` — already has own background, may need adjustment
- All game boards — remove resize watchers

### 4. Preserve Mobile Responsiveness

Mobile still needs:
- Orientation change handling
- Portrait ↔ landscape transitions
- Small-mobile breakpoint (iPhone SE)
- Landscape enforcement overlay

## Migration Plan

### Phase 1: AppContainer Shell
1. Create AppContainer component
2. Integrate at App.vue level (route-based detection)
3. Verify desktop scaling works
4. Verify mobile pass-through works

### Phase 2: Lock Viewport
1. Implement viewport locking in useCardSizing
2. Update AppContainer to lock on mount
3. Verify games render correctly at fixed dimensions

### Phase 3: Strip Reactive Code
1. Audit all resize listeners
2. Remove/gate desktop resize handling
3. Test thoroughly on all screen sizes

### Phase 4: Polish
1. Background design for desktop
2. Transition animations
3. Handle edge cases (window resize during game, etc.)

## Open Questions

1. **MainMenu background** — Currently has its own robot background. Keep separate or unify with AppContainer background?

2. **Lobby** — Same layout treatment as games, or different?

3. **Mobile landscape games** — Keep current adaptive sizing, or scale down 1280×720?

4. **Orientation lock** — Currently shows "rotate device" overlay. Keep this or let app scroll off-screen in portrait?

5. **PWA start_url** — Currently `/play`. Update manifest if routes change?

## Visual Reference

### Desktop (e.g., 1920×1080)
- App window: 1280×720 scaled to ~1350×759 (fit with padding)
- Background visible around edges
- Centered in viewport

### Tablet Portrait (e.g., 820×1180 iPad)
- App window: 1280×720 scaled to ~768×432 (fit width)
- Significant background visible top/bottom
- Centered

### Tablet Landscape (e.g., 1180×820 iPad)
- App window: 1280×720 scaled to ~1138×640 (fit height)
- Small background visible on sides
- Centered

### Mobile Landscape (e.g., 844×390 Pixel 7)
- No scaling — fills viewport
- Current mobile responsive behavior
- Card sizing uses mobile scales

### Mobile Portrait
- Landscape-required overlay on game routes
- Or: menu/lobby work in portrait
