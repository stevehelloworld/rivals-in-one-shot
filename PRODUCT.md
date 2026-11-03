# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

RIVALS is a browser-based first-to-five 1v1 FPS game for phones and computers.
The user confirmed that this redesign changes visual presentation and interaction
hierarchy while preserving gameplay and existing capabilities.

## Users

Players using touch screens or keyboard and mouse to practice against AI or duel
another player through a shared room code. No demographic assumptions are confirmed.

## Operating Context

Players choose Easy or Hard AI, or create/join a four-character online room.
The game is deployed from GitHub main to Railway. The user requests direct main
publishing when implementation is completed. This redesign first requires a
visual mockup for user review before implementation.

## Capabilities and Constraints

- Preserve AI difficulty choices, online rooms and reconnect behavior.
- Preserve assault rifle, handgun, fists, grenade and RPG loadout.
- Preserve first-to-five scoring, reload, pause and round/match results.
- Preserve customizable touch layout, left-handed mode and adaptive quality.
- Support portrait and landscape phones plus desktop.
- Keep input clarity, readable HUD and usable touch targets.
- Physical device testing remains deferred by the user; do not describe browser
  emulation as real iPhone/Android testing.

## Brand Commitments

Keep the RIVALS product name. The user has delegated the new visual direction.
No existing color, typography or decorative treatment is binding.

## Evidence on Hand

Existing implementation: index.html, css/style.css and js/.
Behavior tests: test/ and e2e/. Do not invent rankings, player counts, progression,
monetization or unavailable game modes in presentation.
