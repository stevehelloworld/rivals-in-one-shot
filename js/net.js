/**
 * WebSocket client for RIVALS online duels.
 * Auto-detects ws URL from current page host and resumes interrupted rooms.
 */
export class NetClient {
  constructor() {
    this.ws = null;
    this.role = null;
    this.code = null;
    this.token = null;
    this.connected = false;
    this.peerReady = false;
    this.latency = null;
    this._handlers = new Map();
    this._queue = [];
    this._url = null;
    this._manualClose = false;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._pingTimer = null;
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
    if (typeof window !== 'undefined' && window.RIVALS_WS_URL) {
      return window.RIVALS_WS_URL;
    }
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${loc.host}`;
  }

  connect(url = NetClient.defaultUrl()) {
    this._manualClose = false;
    this._url = url;
    return this._open(false);
  }

  _open(isReconnect) {
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

      let socket;
      try {
        socket = new WebSocket(this._url || NetClient.defaultUrl());
      } catch (error) {
        reject(error);
        return;
      }
      this.ws = socket;
      let settled = false;

      const timeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) socket.close();
        if (!settled) {
          settled = true;
          reject(new Error('Connection timeout — start the server: npm start'));
        }
      }, 5000);

      socket.onopen = () => {
        if (this.ws !== socket) return;
        clearTimeout(timeout);
        this.connected = true;
        this._startPing();

        if (isReconnect && this.code && this.role && this.token) {
          socket.send(
            JSON.stringify({
              type: 'resume',
              code: this.code,
              role: this.role,
              token: this.token,
            })
          );
        } else {
          for (const msg of this._queue) socket.send(JSON.stringify(msg));
          this._queue = [];
          this._emit('open', {});
        }
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        this._emit('error', { message: 'WebSocket error' });
        if (!settled) {
          settled = true;
          reject(new Error('Cannot connect to server. Run: npm start'));
        }
      };

      socket.onclose = () => {
        clearTimeout(timeout);
        if (this.ws !== socket) return;
        this.connected = false;
        this._stopPing();
        this._emit('close', {});
        if (!this._manualClose && this.code && this.role && this.token) {
          this._scheduleReconnect();
        }
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!msg || typeof msg.type !== 'string') return;
        if (msg.type === 'room' || msg.type === 'resumed') {
          this.role = msg.role;
          this.code = msg.code;
          this.token = msg.token;
        }
        if (msg.type === 'room') this.peerReady = false;
        if (msg.type === 'resumed') this.peerReady = Boolean(msg.peerReady);
        if (msg.type === 'peer_joined' || msg.type === 'peer_resumed') {
          this.peerReady = true;
        }
        if (msg.type === 'peer_reconnecting') this.peerReady = false;
        if (msg.type === 'peer_left') this.peerReady = false;
        if (msg.type === 'resumed') {
          this._reconnectAttempt = 0;
          this._emit('reconnected', msg);
        }
        if (msg.type === 'resume_failed') {
          this._cancelReconnect();
          this._emit('reconnect_failed', msg);
        }
        if (msg.type === 'pong' && Number.isFinite(msg.ts)) {
          this.latency = Math.max(0, Math.round(performance.now() - msg.ts));
          this._emit('latency', { ms: this.latency });
          return;
        }
        this._emit(msg.type, msg);
      };
    });
  }

  _scheduleReconnect() {
    if (this._reconnectTimer || this._manualClose) return;
    if (this._reconnectAttempt >= 5) {
      this._emit('reconnect_failed', {});
      return;
    }
    const delay = Math.min(5000, 500 * 2 ** this._reconnectAttempt);
    this._reconnectAttempt++;
    this._emit('reconnecting', {
      attempt: this._reconnectAttempt,
      delay,
    });
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._open(true).catch(() => this._scheduleReconnect());
    }, delay);
  }

  _cancelReconnect() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._reconnectAttempt = 0;
  }

  _startPing() {
    this._stopPing();
    const ping = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: performance.now() }));
      }
    };
    ping();
    this._pingTimer = setInterval(ping, 5000);
  }

  _stopPing() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._pingTimer = null;
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    // Only room setup commands are safe to replay. Never queue stale shots or damage.
    if (msg?.type === 'create' || msg?.type === 'join') {
      this._queue = [msg];
    }
    return false;
  }

  createRoom() {
    this.send({ type: 'create' });
  }

  joinRoom(code) {
    this.send({ type: 'join', code: String(code).trim().toUpperCase() });
  }

  leave() {
    this._manualClose = true;
    this._cancelReconnect();
    this._stopPing();
    this._queue = [];
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave' }));
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.role = null;
    this.code = null;
    this.token = null;
    this.peerReady = false;
    this.latency = null;
  }
}
