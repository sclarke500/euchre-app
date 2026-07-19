# Documentation Index

**Last reviewed:** 2026-02-16

## Start Here (LLM Onboarding)

- `docs/LLM_ONBOARDING.md` — **Quick architecture overview** (5 min read). Start here.
- `docs/GAME_ARCHITECTURE.md` — **Canonical pure-game / host contract** (read before adding a game).
- `docs/NEW_GAME_GUIDE.md` — **Step-by-step guide** for implementing a new multiplayer game.
- `docs/designs/pure-game-architecture-plan.md` — Migration plan to align Euchre/Spades/President.

## Canonical Docs

- `README.md` — Project overview, setup, commands
- `CLAUDE.md` — Session conventions for Claude coding sessions
- `docs/GAME_ARCHITECTURE.md` — Pure state-machine + thin host rules; wire-format freeze; same-ref rejection
- `docs/PLATFORM_CONTRACT.md` — **Frozen layout/sizing contract** for trick-taking games
- `docs/ROADMAP.md` — Shared multiplayer flow reference, checklists, deferred work
- `docs/MULTIPLAYER_ARCHITECTURE.md` — Detailed architecture reference
- `docs/SAFE_AREAS.md` — Notch/Dynamic Island handling strategy

## Maintenance Rule

When architecture changes, update in this order:

1. `docs/ROADMAP.md`
2. `docs/DOCUMENTATION_INDEX.md`
3. `README.md` (if setup changed)

Keep this docs set focused on current architecture and workflows; obsolete planning docs should be removed rather than retained.
