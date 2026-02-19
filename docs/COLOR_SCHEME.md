# Color Scheme Reference

Design system for 67cardgames.com — dark, premium casino aesthetic.

---

## Core Palette

### Brand Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `$brand-green` | `#1e6045` | Primary brand, felt, success states |
| `$brand-green-light` | `#247552` | Highlights, hover states |
| `$brand-green-dark` | `#15483a` | Shadows, pressed states |

### Neutrals (Dark Theme)
| Token | Hex | Usage |
|-------|-----|-------|
| `$surface-900` | `#141418` | Deepest background (carpet edge) |
| `$surface-850` | `#191920` | Mid carpet |
| `$surface-800` | `#1e1e24` | Light carpet, base panels |
| `$surface-700` | `#282830` | Elevated panels |
| `$surface-600` | `#35383f` | Hover states |
| `$surface-500` | `#45485a` | Borders, dividers |
| `$surface-400` | `#606070` | Muted text |
| `$surface-300` | `#909098` | Secondary text |
| `$surface-100` | `#ffffff` | Primary text, cards |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `$success` | `#287850` | Confirmations, valid plays |
| `$danger` | `#a03838` | Errors, quit/leave actions |
| `$warning` | `#b8860b` | Caution states |
| `$info` | `#2563eb` | Dealer chip, info badges |

### Transparency Scale
| Token | Value | Usage |
|-------|-------|-------|
| `$alpha-heavy` | `0.95-0.98` | Panel backgrounds |
| `$alpha-medium` | `0.7-0.85` | Overlays, backdrops |
| `$alpha-light` | `0.3-0.5` | Shadows, subtle fills |
| `$alpha-subtle` | `0.08-0.15` | Borders, highlights |

---

## Component Specifications

### 1. Table Surface

**Carpet (floor around table)**
```scss
background: linear-gradient(180deg, 
  #1e1e24 0%,    // top
  #191920 50%,   // mid
  #141418 100%   // bottom
);
```

**Felt (table surface)**
```scss
--felt: #1e6045;        // base
--felt-light: #247552;  // center highlight
--felt-dark: #15483a;   // edge shadow
```

**Wood Rail**
```scss
background: linear-gradient(180deg,
  #5c4035 0%,    // top highlight
  #4a332a 15%,
  #3d2a22 50%,   // mid
  #4a332a 85%,
  #5c4035 100%   // bottom
);
```

### 2. Panels (Glossy Style)

**Base Panel**
```scss
background: linear-gradient(180deg,
  rgba(45, 48, 58, 0.95) 0%,    // lighter top
  rgba(28, 30, 38, 0.98) 100%   // darker bottom
);
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow: 
  0 4px 24px rgba(0, 0, 0, 0.5),
  inset 0 1px 0 rgba(255, 255, 255, 0.12),
  inset 0 -1px 0 rgba(0, 0, 0, 0.3);
```

### 3. Buttons

**Default Button**
```scss
background: linear-gradient(180deg,
  rgba(55, 58, 68, 0.95) 0%,
  rgba(35, 38, 48, 0.98) 100%
);
border: 1px solid rgba(255, 255, 255, 0.1);
box-shadow: 
  0 2px 8px rgba(0, 0, 0, 0.4),
  inset 0 1px 0 rgba(255, 255, 255, 0.1);
```

**Primary Button (Green)**
```scss
background: linear-gradient(180deg,
  rgba(40, 115, 80, 0.95) 0%,
  rgba(28, 85, 58, 0.98) 100%
);
border-color: rgba(70, 160, 110, 0.25);
```

**Danger Button (Red)**
```scss
background: linear-gradient(180deg,
  rgba(150, 55, 55, 0.95) 0%,
  rgba(110, 38, 38, 0.98) 100%
);
border-color: rgba(200, 90, 90, 0.25);
```

**Secondary Button (Subtle)**
```scss
background: linear-gradient(180deg,
  rgba(40, 43, 53, 0.95) 0%,
  rgba(28, 30, 40, 0.98) 100%
);
```

### 4. Modals & Overlays

**Backdrop**
```scss
background: rgba(0, 0, 0, 0.6);
```

**Modal Container**
Use `.frosted-panel` — same as other panels for consistency.

### 5. Player Avatars

**Avatar Pill**
```scss
background: linear-gradient(180deg,
  rgba(45, 48, 58, 0.95) 0%,
  rgba(28, 30, 38, 0.98) 100%
);
// Same as panels
```

**Current Turn Indicator**
```scss
border: 2px solid $brand-green-light;  // #247552
box-shadow: 0 0 12px rgba(36, 117, 82, 0.5);
```

### 6. Cards

**Card Face**: `#ffffff` (white)
**Card Back**: Game-specific pattern on dark base
**Suit Red** (Hearts/Diamonds): `#e74c3c`
**Suit Black** (Clubs/Spades): `#2c3e50` (soft blue-black for readability)
**Selected Highlight**: `rgba(255, 215, 0, 0.3)` (gold glow)
**Valid Play Highlight**: `rgba(42, 138, 106, 0.6)` (green tint)

### 7. Text

| Context | Color |
|---------|-------|
| Primary text | `#ffffff` |
| Secondary text | `rgba(255, 255, 255, 0.7)` |
| Muted/disabled | `rgba(255, 255, 255, 0.4)` |
| On light background | `#1e1e24` |

---

## SCSS Variables (Proposed)

Add to `_variables.scss`:

```scss
// === BRAND ===
$brand-green: #1e6045;
$brand-green-light: #247552;
$brand-green-dark: #15483a;

// === SURFACES ===
$surface-900: #141418;
$surface-850: #191920;
$surface-800: #1e1e24;
$surface-700: #282830;
$surface-600: #35383f;
$surface-500: #45485a;

// === SEMANTIC ===
$success: #287850;
$danger: #a03838;
$warning: #b8860b;
$info: #2563eb;

// === TEXT ===
$text-primary: #ffffff;
$text-secondary: rgba(255, 255, 255, 0.7);
$text-muted: rgba(255, 255, 255, 0.4);

// === TRANSPARENCY ===
$alpha-panel-top: 0.95;
$alpha-panel-bottom: 0.98;
$alpha-overlay: 0.6;
$alpha-border: 0.08;
$alpha-highlight: 0.12;
```

---

## Resolved Inconsistencies

1. ~~`$primary-color: #2c3e50`~~ — kept for legacy, mapped to suit black
2. ~~`$secondary-color: #42b983`~~ — now maps to `$brand-green`
3. ~~`#1e4d2b` hardcoded~~ — replaced with `$brand-green`
4. ~~Hardcoded grays~~ — replaced with `$surface-*` tokens
5. **Still to check**: Modal backgrounds using light colors

---

## Migration Status

- ✅ Define new tokens in `_variables.scss`
- ✅ Replace hardcoded greens (`#1e4d2b`, `#0d2818`)
- ✅ Replace hardcoded grays (`#333`-`#666`)
- ⬜ Audit modals for light-theme remnants
- ⬜ Test across all games (Euchre, Spades, President, Klondike)

---

*Last updated: 2026-02-19*
