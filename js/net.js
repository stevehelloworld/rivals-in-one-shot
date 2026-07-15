/**
 * WebSocket client for RIVALS online duels.
 * Auto-detects ws URL from current page host.
 */
export class NetClient {
  constructor() {
    this.ws = null;
    this.role = null; // 'host' | 'guest'
    this.code = null;
    this.connected = false;
    this.peerReady = false;
    this._handlers = new Map();
    this._queue = [];
  }

  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, []);
    this._handlers.get(type).push(fn);
  }

  off(type, fn) {
    const list = this._handlers.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  _emit(type, data) {
    const list = this._handlers.get(type) || [];
    for (const fn of list) fn(data);
    const any = this._handlers.get('*') || [];
    for (const fn of any) fn(type, data);
  }

  /** Vercel/static hosts cannot run our WebSocket game server. */
  static isStaticHost() {
    const h = window.location.hostname;
    return (
      h.endsWith('.vercel.app') ||
      h.endsWith('.netlify.app') ||
      h.endsWith('.github.io')
    );
  }

  static defaultUrl() {
    // Optional: set window.RIVALS_WS_URL = 'wss://your-server' for remote multiplayer
    if (typeof window !== 'undefined' && window.RIVALS_WS_URL) {
      return window.RIVALS_WS_URL;
    }
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // Same host:port as the page (local npm start serves HTTP + WS together)
    return `${proto}//${loc.host}`;
  }

  connect(url = NetClient.defaultUrl()) {
    return new Promise((resolve, reject) => {
      if (NetClient.isStaticHost() && !window.RIVALS_WS_URL) {
        reject(
          new Error(
            'Online needs a game server. On Vercel only VS AI works. Locally run: npm start'
          )
        );
        return;
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }

      const t = setTimeout(() => {
        reject(new Error('Connection timeout — start the server: npm start'));
      }, 5000);

      this.ws.onopen = () => {
        clearTimeout(t);
        this.connected = true;
        for (const msg of this._queue) this.ws.send(JSON.stringify(msg));
        this._queue = [];
        this._emit('open', {});
        resolve();
      };

      this.ws.onerror = () => {
        clearTimeout(t);
        this._emit('error', { message: 'WebSocket error' });
        reject(new Error('Cannot connect to server. Run: npm start'));
      };

      this.ws.onclose = () => {
        this.connected = false;
        this._emit('close', {});
      };

      this.ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === 'room') {
          this.role = msg.role;
          this.code = msg.code;
        }
        if (msg.type === 'peer_joined') this.peerReady = true;
        if (msg.type === 'peer_left') this.peerReady = false;
        this._emit(msg.type, msg);
      };
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this._queue.push(msg);
    }
  }

  createRoom() {
    this.send({ type: 'create' });
  }

  joinRoom(code) {
    this.send({ type: 'join', code: String(code).trim().toUpperCase() });
  }

  leave() {
    this.send({ type: 'leave' });
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.role = null;
    this.code = null;
    this.peerReady = false;
  }
}
