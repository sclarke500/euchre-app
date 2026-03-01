# Safe Area Handling

How we handle notches, Dynamic Islands, and other display cutouts.

## Strategy

1. **Device detection** — Identify specific devices via UA string + screen dimensions
2. **Hardcoded insets** — Use known-good values for common devices (more reliable than CSS env())
3. **Fallback** — Conservative defaults for unknown devices

## Implementation

### Core: `deviceSafeAreas.ts`

```ts
import { getDeviceSafeAreas } from '@/utils/deviceSafeAreas'

const { name, insets, isKnown } = getDeviceSafeAreas()
// insets: { top, right, bottom, left } in CSS pixels
```

**Known devices include:**
- iPhone X through iPhone 16 Pro Max (notch + Dynamic Island)
- Pixel 7-10 series
- Galaxy S23-S25 series

**Detection priority:**
1. UA string model identifier (e.g., `iPhone17,2`)
2. Screen dimension signature (e.g., `430x932`)
3. CSS `env()` values
4. Conservative fallback (47px for iPhone, 16px for Android)

### ScaledContainer

The primary consumer. Calculates usable viewport after subtracting safe areas, then scales game content to fit.

```
┌─────────────────────────────────────┐
│  ← safe-left    safe-right →        │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │    ScaledContainer          │    │
│  │    (game board scales       │    │
│  │     to fit this box)        │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│           ↓ safe-bottom             │
└─────────────────────────────────────┘
```

**Key behavior:**
- Landscape: left/right insets are notch sides
- Portrait: top inset becomes notch area (insets rotate with orientation)
- Game content renders at canonical size (1120x630) and gets scaled

### CSS Variables (available but not currently used)

```ts
import { applySafeAreaCSSVars } from '@/utils/deviceSafeAreas'

// Call once on app init to set vars on :root
applySafeAreaCSSVars()
```

This sets:
- `--device-safe-top`
- `--device-safe-right`
- `--device-safe-bottom`
- `--device-safe-left`

## What Lives Where

| Component | Safe Area Handling |
|-----------|-------------------|
| **ScaledContainer** | ✅ Handles via JS — adjusts container position/size |
| **Game boards** | ✅ Inside ScaledContainer — automatic |
| **MainMenu** | ✅ Uses `env(safe-area-inset-bottom)` for install prompt |
| **Chat overlay** | ❌ Currently none — teleported outside ScaledContainer |
| **Modals** | ❌ Currently none — usually centered, not near edges |

## Known Issues

### Chat Panel on iPhone 15 (landscape)
The chat panel slides in from the left, which can overlap the Dynamic Island depending on which way the phone is rotated. The panel is teleported to `<body>`, so it's outside ScaledContainer's safe area handling.

**Potential fixes:**
1. Call `applySafeAreaCSSVars()` on app init, use `--device-safe-left` in ChatPanel
2. Have ChatPanel call `getDeviceSafeAreas()` directly
3. Move chat panel inside ScaledContainer

## Guidelines

1. **Don't use `env(safe-area-inset-*)` directly** — unreliable on many devices
2. **Use `getDeviceSafeAreas()`** for anything that needs safe area info
3. **Prefer keeping UI inside ScaledContainer** — safe areas handled automatically
4. **For overlays/modals outside ScaledContainer** — use CSS vars after calling `applySafeAreaCSSVars()`

## Adding New Devices

Edit `deviceSafeAreas.ts`:

1. Add to `IPHONE_DEVICES` or `ANDROID_DEVICES` with landscape insets
2. Add UA model identifier mapping if needed
3. Add screen signature if UA detection is unreliable

## References

- [iPhone screen sizes](https://useyourloaf.com/blog/iphone-16-screen-sizes/)
- [Android viewport sizes](https://screensizechecker.com/devices/android-viewport-sizes)
