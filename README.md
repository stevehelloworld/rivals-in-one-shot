# RIVALS (Browser Clone)

Roblox RIVALS–style 1v1 duel — **easy AI** + **online multiplayer**.

## Run (local — AI + Online)

```bash
npm install
npm start
```

Open **http://localhost:8770**

> Use `npm start` (not plain static hosting alone) so **Online** WebSocket rooms work.

## Deploy on Vercel

Vercel hosts the **static game** (VS AI works).  
It **cannot** run our long-lived WebSocket server, so Online 1v1 will show a message unless you point `window.RIVALS_WS_URL` at your own server.

```bash
npm run build   # → dist/
# Vercel uses vercel.json → builds dist and serves it
```

Push to GitHub; Vercel auto-deploys.

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

| Key | Action |
|-----|--------|
| WASD | Move |
| Shift | Sprint |
| C | Slide |
| Space | Jump (fists = double jump) |
| LMB | Shoot / punch / nade |
| R | Reload |
| 1–4 | Weapons |
| Esc | Pause |

## Default loadout

1. Assault Rifle · 2. Handgun · 3. Fists · 4. Grenade
