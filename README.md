# RIVALS (Browser Clone)

Roblox RIVALS–style 1v1 duel — **easy AI** + **online multiplayer**.

## Run (local — AI + Online)

```bash
npm install
npm start
```

Open **http://localhost:8770**

> Use `npm start` (not plain static hosting alone) so **Online** WebSocket rooms work.

## Deploy on Railway (recommended for Online)

1. New Project → Deploy from GitHub → this repo  
2. **Start command:** `npm start` (default)  
3. Generate a public domain under **Settings → Networking**  

For a separate frontend origin, set `ALLOWED_ORIGINS` on Railway to a
comma-separated list of allowed origins, for example
`https://example.com,https://www.example.com`. Same-origin deployments work
without this variable.
4. Open `https://your-app.up.railway.app`

Server binds `0.0.0.0` + `PORT` (Railway injects this). Health check: `/health`.

If the page fails after deploy: **Deployments → Redeploy** the latest commit.

## Deploy on Vercel (AI only)

Vercel serves the **static** build (VS AI). No WebSocket Online rooms.

```bash
npm run build   # → dist/
```

## Modes

### VS AI (Easy)
Weak bot: high miss rate, slow fire, low damage, delayed reactions. Good for practice.

### Online 1v1
1. Player A → **CREATE ROOM** → share 4-letter code  
2. Player B → enter code → **JOIN**  
3. Match starts automatically (first to 5)

Same Wi‑Fi / LAN: use host machine IP, e.g. `http://192.168.x.x:8770`  
Internet: need port forward or a tunnel (ngrok, etc.).

## Controls

On phones and tablets, use the left virtual stick to move, drag the right side
to aim, and tap the on-screen Fire, Jump, Slide, Reload, Pause, and weapon
buttons. Landscape orientation gives the largest play area.

| Key | Action |
|-----|--------|
| WASD | Move |
| Shift | Sprint |
| C | Slide |
| Space | Jump (fists = double jump) |
| LMB | Shoot / punch / nade |
| RMB (hold) | Aim · 4× sniper / 2× DMR / mild zoom on other guns |
| R | Reload |
| T | Next trial weapon (Practice Range only) |
| 1–5 | Weapons |
| Esc | Pause |

On touch screens, AIM toggles aiming and can be repositioned in the touch-layout
editor. Aiming tightens spread, slows movement and reduces look sensitivity.
Automatic control selection prefers mouse and keyboard on hybrid computers
with a fine, hovering pointer. To override detection, open the game with
`?touch=0` for mouse and keyboard or `?touch=1` for touch controls.
The mobile HUD keeps score, health and weapon slots at the top, with movement
and combat controls in opposite lower corners. Touch aim assist defaults to
Standard and can be set to Off, Low or Strong in Settings. It slows small
drags near visible targets and gently guides them during ADS or fire drags.
It applies to touch guns in AI, online and practice modes; no automatic shots,
hitbox changes, assistance through cover or desktop mouse changes.
Sniper shots briefly leave the scope while the bolt cycles. Reloading, switching
weapons or pausing cancels aim. Reduced-motion preferences reduce part animation.

## Practice and weapon comparison

Use **PRACTICE RANGE** to try every weapon without buying or changing permanent
unlocks. The separate `js/maps/range.mjs` layout has 5 / 15 / 35 m targets.
The panel tracks projectile hits, headshots, damage and DPS (elapsed time since
the first shot, minimum one second). Shotgun pellets count as projectiles;
explosions can hit multiple targets. Practice cannot award credits or round wins.

Armory categories separate primary, secondary, equipment and skins. Damage,
rate, magazine and reload values share the gameplay source `weapon-specs.mjs`.
Comparison deltas are against the equipped weapon in that slot; shotgun damage
shows both per-pellet damage and the all-pellets body-shot maximum.

Bots use radius-aware routes around cover, seek occluded cover while reloading
or retreating, and can walk the explicit Sunset/Viaduct stair routes to high
ground. Difficulty still controls reaction time, accuracy and movement speed.

## Performance verification

Static world geometry and fixed weapon parts use instancing; animated parts keep
their own transforms. The synchronous same-view range benchmark measured 68
draw calls without batching versus 30 with batching. This is not an FPS claim.
Low/high effect budgets cap active FX at 100/240. The menu renders at up to
30 FPS and hidden tabs skip rendering. Settings can show FPS, draw calls and
render resolution for device testing.

Browser checks cover portrait, landscape, free trials, ADS, unique actions,
stairs, explosions, AI routing and persistent purchases. A paired physical iPhone
is detected, but Safari remote testing is not connected; Android is not attached.
Physical touch latency, sustained FPS and thermal behaviour remain unverified.

## Arena previews and layout files

Each arena remains independent under `js/maps/`. The current layouts add side
galleries to Sunset, stacked-container passages to Dock, gantry/furnace cover
to Foundry, bridge parapets and flanking cover to Viaduct, and roofed colonnades
to Courtyard. Spawn positions and a ground route between both spawns are tested.

The `assets/images/preview-*.jpg` images are illustrated renders based on actual
in-engine reference captures, not literal screenshots. They preserve the
reference camera, major structures, cover locations and passages; materials
and lighting are enhanced. Generation prompts are embedded in the JPEG files.
Run `e2e/capture-map-references.pw.cjs` through the Playwright CLI to reproduce
the reference views using each map's `previewCamera`. The script
`e2e/map-routes.pw.cjs` verifies collision references and stair traversal after
switching layouts.

## Default loadout

Every weapon and skin in the Armory has a preview captured from its actual
in-game model. Regenerate these with `e2e/capture-weapon-images.pw.cjs` through
the Playwright CLI, then copy the PNGs into `assets/images/weapons/`.

Explosions use double-sided expanding fireballs, shock rings and pooled sparks
so blasts remain visible when the camera is inside them. Low quality and reduced
motion lower particle counts; nearby flash feedback is brief and LOS-gated.

The Armory also offers Vector SMG, Breach Shotgun (six independent pellets),
Sentinel DMR, Longshot Sniper, Bastion LMG and Iron Six Revolver. Equip one
primary and one secondary; fists, grenade and RPG remain in their usual slots.
Unlocks persist locally across matches. New weapon prices range from 200–400 CR.

The lobby Armory starts you with 100 CR. Each round win earns 50 CR.
Buy and equip alternative weapons for the next match; the original weapons
remain available. Credits, unlocks and equipped choices are saved locally in
the current browser. This version has no payments or account syncing.

1. Assault Rifle · 2. Handgun · 3. Fists · 4. Grenade · 5. RPG

## Mobile regression checks

Run `npm run check` and `npm run build` first. With `npm start` running,
the Playwright CLI `run-code` command accepts the function in
`e2e/mobile-flow.pw.cjs` (AI, controls, background pause, death/respawn,
responsive sizes, failed module load and retry) or `e2e/mobile-online.pw.cjs`
(two-player room creation, joining and WebSocket reconnection).
These tests use browser automation and controlled game state for death/input
edge cases; real iOS/Android device testing remains a separate check.

Leaving the app clears held inputs and pauses local play. Return with Resume;
online opponents can continue playing while your local controls are paused.

### Touch layout and automatic quality

Open **Settings → Customize touch controls** from the menu. Drag a control,
or use its Position sliders; select its size and opacity. Left-handed mode
mirrors the controls and aiming area. Save stores separate portrait and
landscape positions on this browser. Cancel discards edits; Reset view resets
the current orientation. Controls are kept inside the screen safe area.

Auto-adjust quality is on by default. Five-second samples below 42 FPS lower
resolution and disable shadows/extra effects. Three consecutive samples above
57 FPS restore one level, up to the preferred Effects quality. Pauses and
background time are excluded. Turn this off for fixed quality.

Additional Playwright CLI flows: `e2e/mobile-settings.pw.cjs` checks layout
persistence, orientation, adaptive rendering and audio suspension/recovery;
`e2e/multitouch.pw.cjs` uses Chromium CDP to send three simultaneous touch
contacts (move, fire and aim), including cancellation.

Real-device release checks (pending a connected phone):

- iPhone Safari / Android Chrome: move, aim and fire with multiple fingers.
- Rotate both ways; check notches, browser bars and the on-screen keyboard.
- Lock/unlock or switch apps; confirm no stuck input and Resume restores audio.
- Play for ten minutes; check frame rate, heat and quality changes.

Chromium mobile emulation and WebKit are automated compatibility checks,
not substitutes for physical device testing.
