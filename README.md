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

| Key | Action |
|-----|--------|
| WASD | Move |
| Shift | Sprint |
| C | Slide |
| Space | Jump (fists = double jump) |
| LMB | Shoot / punch / nade |
| R | Reload |
| 1–5 | Weapons |
| Esc | Pause |

## Default loadout

1. Assault Rifle · 2. Handgun · 3. Fists · 4. Grenade · 5. RPG
