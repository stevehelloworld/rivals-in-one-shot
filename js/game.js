import * as THREE from 'three';
import { buildArena, createRivalMesh, createViewmodel } from './map.js';
import { Player } from './player.js';
import { Bot } from './bot.js';
import { RemotePlayer } from './remote.js';
import { NetClient } from './net.js';
import { GameAudio } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';

const WIN_SCORE = 5;

export class Game {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.state = 'menu';
    this.mode = 'ai'; // 'ai' | 'online'
    this.aiDifficulty = 'hard'; // 'easy' | 'hard'
    this.score = { you: 0, enemy: 0 };
    this.round = 0;
    this.grenades = [];
    this.tracers = [];
    this._pendingT = null;
    this._inputLockT = null;
    this._stateAcc = 0;
    this._eventSeq = 0;
    this.settings = loadSettings();
    this.audio = new GameAudio(this.settings.volume);

    this.arena = buildArena(scene);
    this.viewmodel = createViewmodel();
    camera.add(this.viewmodel);
    scene.add(camera);

    this.player = new Player(camera, document.body, this.arena.colliders, this.viewmodel);
    this.rivalMesh = createRivalMesh();
    scene.add(this.rivalMesh);

    this.bot = new Bot(this.rivalMesh, this.arena.colliders, (from, to) =>
      this.hasLOS(from, to)
    );
    this.remote = new RemotePlayer(this.rivalMesh);
    this.net = new NetClient();
    this._wireNet();

    this.ui = this._bindUI();
    this._initEffects();
    this._bindSettings();
    this._bindPause();
  }

  /** Active opponent entity for hit tests */
  get opponent() {
    return this.mode === 'online' ? this.remote : this.bot;
  }

  _bindUI() {
    return {
      menu: document.getElementById('menu'),
      hud: document.getElementById('hud'),
      scoreYou: document.getElementById('score-you'),
      scoreEnemy: document.getElementById('score-enemy'),
      enemyName: document.querySelector('#scoreboard .enemy .name'),
      hpFill: document.getElementById('hp-fill'),
      hpNum: document.getElementById('hp-num'),
      weaponName: document.getElementById('weapon-name'),
      ammoCur: document.getElementById('ammo-cur'),
      ammoMax: document.getElementById('ammo-max'),
      slots: document.querySelectorAll('.wslot'),
      crosshair: document.getElementById('crosshair'),
      hitmarker: document.getElementById('hitmarker'),
      killFeed: document.getElementById('kill-feed'),
      damageLayer: document.getElementById('damage-layer'),
      roundBanner: document.getElementById('round-banner'),
      roundEnd: document.getElementById('round-end'),
      roundEndTitle: document.getElementById('round-end-title'),
      roundEndSub: document.getElementById('round-end-sub'),
      matchEnd: document.getElementById('match-end'),
      matchEndTitle: document.getElementById('match-end-title'),
      matchEndScore: document.getElementById('match-end-score'),
      pause: document.getElementById('pause'),
      pauseTitle: document.getElementById('pause-title'),
      resumeButton: document.getElementById('btn-resume'),
      abilityHint: document.getElementById('ability-hint'),
      lobbyStatus: document.getElementById('lobby-status'),
      roomCode: document.getElementById('room-code-display'),
      joinInput: document.getElementById('join-code'),
      onlinePanel: document.getElementById('online-panel'),
      netStatus: document.getElementById('net-status'),
    };
  }

  _bindSettings() {
    const sensitivity = document.getElementById('setting-sensitivity');
    const volume = document.getElementById('setting-volume');
    const fov = document.getElementById('setting-fov');
    const effects = document.getElementById('setting-effects');
    const reducedMotion = document.getElementById('setting-reduced-motion');

    if (sensitivity) sensitivity.value = this.settings.sensitivity;
    if (volume) volume.value = this.settings.volume;
    if (fov) fov.value = this.settings.fov;
    if (effects) effects.value = this.settings.effects;
    if (reducedMotion) reducedMotion.checked = this.settings.reducedMotion;

    const apply = () => {
      this.settings = saveSettings({
        sensitivity: sensitivity?.value,
        volume: volume?.value,
        fov: fov?.value,
        effects: effects?.value,
        reducedMotion: reducedMotion?.checked,
      });
      this.player.controls.pointerSpeed = this.settings.sensitivity;
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
      const maxPixelRatio = this.settings.effects === 'low' ? 1 : 2;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
      this.audio.setVolume(this.settings.volume);
      document.body.classList.toggle('reduced-motion', this.settings.reducedMotion);
    };

    for (const element of [sensitivity, volume, fov, effects, reducedMotion]) {
      element?.addEventListener('input', apply);
      element?.addEventListener('change', apply);
    }
    apply();
  }

  _initEffects() {
    this._up = new THREE.Vector3(0, 1, 0);
    this._fxGeometry = {
      bullet: new THREE.CylinderGeometry(0.04, 0.085, 1, 8),
      trail: new THREE.CylinderGeometry(0.035, 0.065, 1, 6),
      blast: new THREE.SphereGeometry(1, 12, 12),
      impact: new THREE.SphereGeometry(1, 6, 6),
    };
    this._fxPools = {
      bullet: [],
      trail: [],
      blast: [],
      impact: [],
    };
    this._projectileGeometry = {
      rocket: new THREE.CylinderGeometry(0.18, 0.108, 0.7, 10),
      grenade: new THREE.SphereGeometry(0.15, 8, 8),
    };
    this._projectilePools = { rocket: [], grenade: [] };
  }

  _bindPause() {
    const unlockAudio = () => {
      this.audio.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    const startAi = (diff) => {
      unlockAudio();
      this.mode = 'ai';
      this.aiDifficulty = diff;
      this.bot.setDifficulty(diff);
      this.startMatch();
    };
    document.getElementById('btn-play-easy')?.addEventListener('click', () => startAi('easy'));
    document.getElementById('btn-play-hard')?.addEventListener('click', () => startAi('hard'));
    document.getElementById('btn-create').addEventListener('click', () => this.createOnline());
    document.getElementById('btn-join').addEventListener('click', () => this.joinOnline());
    document.getElementById('btn-rematch').addEventListener('click', () => {
      if (this.mode === 'online') {
        if (this.net.role === 'host') {
          this.net.send({ type: 'rematch' });
          this.startMatch();
        } else {
          this._setLobbyStatus('Waiting for host rematch…');
        }
      } else {
        this.bot.setDifficulty(this.aiDifficulty);
        this.startMatch();
      }
    });
    document.getElementById('btn-menu').addEventListener('click', () => this.toMenu());
    document.getElementById('btn-resume').addEventListener('click', () => {
      if (this._networkPaused) return;
      this._requestInputLock();
    });
    document.getElementById('btn-quit').addEventListener('click', () => this.toMenu());

    this.player.controls.addEventListener('unlock', () => {
      if (this.state === 'playing') {
        this.state = 'pause';
        if (this.ui.pauseTitle) this.ui.pauseTitle.textContent = 'PAUSED';
        if (this.ui.resumeButton) this.ui.resumeButton.disabled = false;
        this.ui.pause.classList.remove('hidden');
      }
    });
    this.player.controls.addEventListener('lock', () => {
      if (this.state === 'pause') {
        this.ui.pause.classList.add('hidden');
        this.state = 'playing';
      }
    });
    document.addEventListener('pointerlockerror', () => this._showInputGate());
  }

  _showInputGate() {
    if (this.state !== 'playing' || this.player.isLocked) return;
    this.state = 'pause';
    if (this.ui.pauseTitle) this.ui.pauseTitle.textContent = 'CLICK TO PLAY';
    this.ui.pause.classList.remove('hidden');
  }

  _requestInputLock() {
    if (this._inputLockT) clearTimeout(this._inputLockT);
    this.player.lock();
    this._inputLockT = setTimeout(() => {
      this._inputLockT = null;
      this._showInputGate();
    }, 180);
  }

  _wireNet() {
    this.net.on('room', (msg) => {
      if (this.ui.roomCode) {
        this.ui.roomCode.textContent = msg.code;
        this.ui.roomCode.classList.remove('hidden');
      }
      this._setLobbyStatus(
        msg.role === 'host'
          ? `Room ${msg.code} — share code, waiting for rival…`
          : `Joined ${msg.code} — waiting for host…`
      );
    });

    this.net.on('peer_joined', () => {
      this._setLobbyStatus('Rival connected! Starting…');
      // Host starts the match
      if (this.net.role === 'host') {
        setTimeout(() => {
          this.mode = 'online';
          this.net.send({ type: 'match_start' });
          this.startMatch();
        }, 600);
      }
    });

    this.net.on('match_start', () => {
      if (this.net.role === 'guest') {
        this.mode = 'online';
        this.startMatch();
      }
    });

    this.net.on('peer_left', () => {
      this._setLobbyStatus('Rival disconnected');
      if (this.state === 'playing' || this.state === 'pause' || this.state === 'round_end') {
        this.showBanner('RIVAL LEFT');
        this._pendingT = setTimeout(() => this.toMenu(), 1500);
      }
    });

    this.net.on('peer_reconnecting', () => {
      this._pauseForNetwork('RIVAL RECONNECTING');
      this._setNetStatus('RIVAL RECONNECTING');
      this.showBanner('RIVAL RECONNECTING');
    });

    this.net.on('peer_resumed', () => {
      this._resumeAfterNetwork();
      this._setNetStatus(this.net.latency === null ? 'ONLINE' : `${this.net.latency} MS`);
      this.showBanner('RIVAL RECONNECTED');
    });

    this.net.on('reconnecting', ({ attempt }) => {
      this._pauseForNetwork('RECONNECTING…');
      this._setNetStatus(`RECONNECTING ${attempt}/5`);
      this._setLobbyStatus(`Connection lost — reconnecting ${attempt}/5…`);
    });

    this.net.on('reconnected', (msg) => {
      if (this.net.peerReady) this._resumeAfterNetwork();
      this._setLobbyStatus('Reconnected');
      this._setNetStatus(this.net.latency === null ? 'ONLINE' : `${this.net.latency} MS`);
      if (typeof msg.hp === 'number') {
        this.player.hp = msg.hp;
        this.player.alive = msg.hp > 0;
      }
      if (msg.score) this.score = { ...msg.score };
      this._updateScore();
      this.showBanner('RECONNECTED');
    });

    this.net.on('reconnect_failed', () => {
      this._setNetStatus('OFFLINE');
      this._setLobbyStatus('Could not reconnect to the room');
      if (this.state === 'playing' || this.state === 'pause' || this.state === 'round_end') {
        this.showBanner('CONNECTION LOST');
        this._pendingT = setTimeout(() => this.toMenu(), 1500);
      }
    });

    this.net.on('latency', ({ ms }) => {
      this._setNetStatus(`${ms} MS`);
    });

    this.net.on('error', (msg) => {
      this._setLobbyStatus(msg.message || 'Network error');
    });

    this.net.on('state', (msg) => {
      if (this.mode !== 'online') return;
      this.remote.applyState(msg);
    });

    this.net.on('melee', (msg) => this._onNetMelee(msg));
    this.net.on('nade', (msg) => this._onNetNade(msg));
    this.net.on('damage', (msg) => this._onNetDamage(msg));
    this.net.on('damage_ack', (msg) => this._onNetDamageAck(msg));
    this.net.on('shot_fx', (msg) => this._onNetShotFx(msg));
    this.net.on('round_start', (msg) => this._onNetRoundStart(msg));
    this.net.on('round_result', (msg) => this._onNetRoundResult(msg));
    this.net.on('rematch', () => {
      if (this.net.role === 'guest') {
        this.mode = 'online';
        this.startMatch();
      }
    });
  }

  _setLobbyStatus(text) {
    if (this.ui.lobbyStatus) this.ui.lobbyStatus.textContent = text;
  }

  _setNetStatus(text) {
    if (!this.ui.netStatus) return;
    this.ui.netStatus.textContent = text;
    this.ui.netStatus.classList.toggle('bad', text === 'OFFLINE' || text.startsWith('RECONNECTING'));
  }

  _pauseForNetwork(title) {
    if (this.state !== 'playing') return;
    this._networkPaused = true;
    this.state = 'pause';
    if (this.ui.pauseTitle) this.ui.pauseTitle.textContent = title;
    if (this.ui.resumeButton) this.ui.resumeButton.disabled = true;
    this.ui.pause.classList.remove('hidden');
    this.player.unlock();
  }

  _resumeAfterNetwork() {
    if (!this._networkPaused || this.state !== 'pause') return;
    this._networkPaused = false;
    if (this.ui.resumeButton) this.ui.resumeButton.disabled = false;
    this.ui.pause.classList.add('hidden');
    this.state = 'playing';
    if (!this.player.isLocked) this._requestInputLock();
  }

  async createOnline() {
    try {
      this.audio.resume().catch(() => {});
      this._setLobbyStatus('Connecting…');
      await this.net.connect();
      this.net.createRoom();
    } catch (e) {
      this._setLobbyStatus(e.message || 'Server offline — run npm start');
    }
  }

  async joinOnline() {
    const code = this.ui.joinInput?.value || '';
    if (!code.trim()) {
      this._setLobbyStatus('Enter a room code');
      return;
    }
    try {
      this.audio.resume().catch(() => {});
      this._setLobbyStatus('Connecting…');
      await this.net.connect();
      this.net.joinRoom(code);
    } catch (e) {
      this._setLobbyStatus(e.message || 'Server offline — run npm start');
    }
  }

  _clearPending() {
    if (this._pendingT) {
      clearTimeout(this._pendingT);
      this._pendingT = null;
    }
    if (this._inputLockT) {
      clearTimeout(this._inputLockT);
      this._inputLockT = null;
    }
  }

  toMenu() {
    this._clearPending();
    this._networkPaused = false;
    if (this.ui.resumeButton) this.ui.resumeButton.disabled = false;
    this.state = 'menu';
    this.mode = 'ai';
    this.player.unlock();
    this._clearProjectiles();
    if (this.net.connected) this.net.leave();
    this.ui.menu.classList.remove('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.matchEnd.classList.add('hidden');
    this.ui.roundEnd.classList.add('hidden');
    if (this.ui.roomCode) {
      this.ui.roomCode.textContent = '----';
    }
    this._setLobbyStatus('');
    this._setNetStatus('');
    this.rivalMesh.visible = true;
  }

  startMatch() {
    this._clearPending();
    this._networkPaused = false;
    if (this.ui.resumeButton) this.ui.resumeButton.disabled = false;
    this.score = { you: 0, enemy: 0 };
    this.round = 0;
    this._clearProjectiles();
    this.clearTracers();
    this.ui.menu.classList.add('hidden');
    this.ui.matchEnd.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.roundEnd.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    if (this.ui.enemyName) {
      if (this.mode === 'online') {
        this.ui.enemyName.textContent = 'PLAYER';
      } else {
        this.ui.enemyName.textContent =
          this.aiDifficulty === 'easy' ? 'EASY' : 'HARD';
      }
    }
    if (this.mode === 'ai') {
      this.bot.setDifficulty(this.aiDifficulty);
    }
    this._updateScore();

    if (this.mode === 'online' && this.net.role === 'host') {
      this.startRound();
      // Notify guest of round (startRound sends)
    } else if (this.mode === 'online' && this.net.role === 'guest') {
      // Wait for host round_start — but still show HUD
      this.state = 'playing';
      // Guest will get round_start almost immediately
    } else {
      this.startRound();
    }
  }

  startRound() {
    this._networkPaused = false;
    this.round++;
    this.state = 'playing';
    this._clearProjectiles();
    this.clearTracers();

    const swap = this.round % 2 === 0;
    // Host always uses "player" spawn side mapping: host at blue pad first round
    let pSpawn;
    let eSpawn;
    if (this.mode === 'online') {
      if (this.net.role === 'host') {
        pSpawn = swap ? this.arena.spawns.enemy.clone() : this.arena.spawns.player.clone();
        eSpawn = swap ? this.arena.spawns.player.clone() : this.arena.spawns.enemy.clone();
      } else {
        // guest opposite of host
        pSpawn = swap ? this.arena.spawns.player.clone() : this.arena.spawns.enemy.clone();
        eSpawn = swap ? this.arena.spawns.enemy.clone() : this.arena.spawns.player.clone();
      }
    } else {
      pSpawn = swap ? this.arena.spawns.enemy.clone() : this.arena.spawns.player.clone();
      eSpawn = swap ? this.arena.spawns.player.clone() : this.arena.spawns.enemy.clone();
    }

    this.player.spawn(pSpawn);

    if (this.mode === 'online') {
      this.remote.spawn(eSpawn);
      if (this.net.role === 'host') {
        this.net.send({
          type: 'round_start',
          round: this.round,
          score: this.score,
        });
      }
    } else {
      this.bot.spawn(eSpawn);
    }

    this.ui.roundEnd.classList.add('hidden');
    this.showBanner(`ROUND ${this.round}`);
    if (!this.player.isLocked) this._requestInputLock();
    this._updateHUD();
  }

  _onNetRoundStart(msg) {
    if (this.net.role !== 'guest') return;
    this._networkPaused = false;
    this.mode = 'online';
    this.round = msg.round || this.round + 1;
    if (msg.score) {
      this.score = { you: msg.score.enemy, enemy: msg.score.you };
    }
    this._updateScore();
    this.state = 'playing';
    this._clearProjectiles();
    this.clearTracers();

    const swap = this.round % 2 === 0;
    const pSpawn = swap ? this.arena.spawns.player.clone() : this.arena.spawns.enemy.clone();
    const eSpawn = swap ? this.arena.spawns.enemy.clone() : this.arena.spawns.player.clone();
    this.player.spawn(pSpawn);
    this.remote.spawn(eSpawn);
    this.ui.menu.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.roundEnd.classList.add('hidden');
    this.ui.matchEnd.classList.add('hidden');
    this.showBanner(`ROUND ${this.round}`);
    if (!this.player.isLocked) this._requestInputLock();
    this._updateHUD();
  }

  showBanner(text) {
    const el = this.ui.roundBanner;
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 1400);
  }

  _updateScore() {
    this.ui.scoreYou.textContent = this.score.you;
    this.ui.scoreEnemy.textContent = this.score.enemy;
  }

  _updateHUD() {
    const p = this.player;
    const w = p.weapon;
    this.ui.hpNum.textContent = Math.ceil(p.hp);
    this.ui.hpFill.style.width = `${(p.hp / p.maxHp) * 100}%`;
    this.ui.hpFill.classList.toggle('low', p.hp <= 30);
    this.ui.weaponName.textContent = w.reloading ? 'RELOADING…' : w.name;

    if (w.type === 'gun' || w.type === 'launcher') {
      this.ui.ammoCur.textContent = w.ammo;
      this.ui.ammoMax.textContent = w.magSize;
    } else if (w.type === 'melee') {
      this.ui.ammoCur.textContent = '∞';
      this.ui.ammoMax.textContent = '';
    } else {
      this.ui.ammoCur.textContent = w.ammo;
      this.ui.ammoMax.textContent = w.cd > 0 ? `${Math.ceil(w.cd)}s` : '1';
    }

    this.ui.slots.forEach((el, i) => {
      el.classList.toggle('active', i === p.slot);
    });

    if (w.id === 'fists') {
      this.ui.abilityHint.textContent = 'FISTS · DOUBLE JUMP';
      this.ui.abilityHint.classList.remove('hidden');
    } else if (w.id === 'grenade') {
      this.ui.abilityHint.textContent = w.cd > 0 ? `GRENADE CD ${w.cd.toFixed(1)}s` : 'GRENADE READY';
      this.ui.abilityHint.classList.remove('hidden');
    } else if (w.id === 'rpg') {
      this.ui.abilityHint.textContent = 'RPG · IMPACT SPLASH DAMAGE';
      this.ui.abilityHint.classList.remove('hidden');
    } else if (this.mode === 'online' && this.net.code) {
      this.ui.abilityHint.textContent = `ONLINE · ${this.net.code}`;
      this.ui.abilityHint.classList.remove('hidden');
    } else if (this.mode === 'ai') {
      this.ui.abilityHint.textContent = `AI · ${this.aiDifficulty.toUpperCase()}`;
      this.ui.abilityHint.classList.remove('hidden');
    } else {
      this.ui.abilityHint.classList.add('hidden');
    }

    this.ui.crosshair.classList.toggle('spread', p.sprinting || p.sliding);
  }

  addKillFeed(killer, victim, weapon, enemyKill) {
    const line = document.createElement('div');
    line.className = 'kill-line' + (enemyKill ? ' enemy-kill' : '');
    const killerEl = document.createElement('span');
    killerEl.className = 'killer';
    killerEl.textContent = String(killer);
    const victimEl = document.createElement('span');
    victimEl.className = 'victim';
    victimEl.textContent = String(victim);
    line.append(killerEl, document.createTextNode(` [${String(weapon)}] `), victimEl);
    this.ui.killFeed.prepend(line);
    setTimeout(() => line.remove(), 3500);
    while (this.ui.killFeed.children.length > 5) {
      this.ui.killFeed.lastChild.remove();
    }
  }

  showDamageNumber(isHead, amount) {
    const el = document.createElement('div');
    el.className = 'dmg-num' + (isHead ? ' head' : '');
    el.textContent = isHead ? `${amount}!` : `${amount}`;
    el.style.left = `${48 + Math.random() * 8}%`;
    el.style.top = `${42 + Math.random() * 10}%`;
    this.ui.damageLayer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  flashHitmarker(kill) {
    const h = this.ui.hitmarker;
    h.classList.remove('hidden', 'kill');
    if (kill) h.classList.add('kill');
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => h.classList.add('hidden'), 120);
  }

  hurtVignette() {
    document.body.classList.add('hurt');
    clearTimeout(this._hurtT);
    this._hurtT = setTimeout(() => document.body.classList.remove('hurt'), 200);
  }

  // ── Network combat handlers ──────────────────────────

  _packVec(v) {
    return { x: v.x, y: v.y, z: v.z };
  }

  _nextEventId(prefix = 'evt') {
    this._eventSeq = (this._eventSeq + 1) % 1_000_000;
    return `${prefix}-${Date.now().toString(36)}-${this._eventSeq.toString(36)}`;
  }

  _handlePlayerEvents(events = []) {
    for (const event of events) {
      if (event.type === 'reload_start') this.audio.reloadStart(event.weaponId);
      if (event.type === 'reload_complete') this.audio.reloadComplete(event.weaponId);
    }
  }

  _vec(o) {
    if (
      !o ||
      !Number.isFinite(o.x) ||
      !Number.isFinite(o.y) ||
      !Number.isFinite(o.z)
    ) {
      return null;
    }
    return new THREE.Vector3(o.x, o.y, o.z);
  }

  _sendState() {
    if (this.mode !== 'online' || !this.net.connected) return;
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.camera.quaternion);
    this.net.send({
      type: 'state',
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      yaw: euler.y,
      slot: this.player.slot,
      hp: this.player.hp,
      alive: this.player.alive,
    });
  }

  _onNetShotFx(msg) {
    const origin = this._vec(msg.origin);
    const dir = this._vec(msg.dir);
    const muzzle = msg.muzzle ? this._vec(msg.muzzle) : origin;
    if (!origin || !dir || !muzzle || dir.lengthSq() < 0.0001) return;
    this._spawnTracer(
      origin,
      dir,
      msg.color || 0xef4444,
      msg.stopDist || 40,
      muzzle
    );
    if (msg.impact) {
      this._spawnImpact(
        origin.clone().add(dir.clone().normalize().multiplyScalar(msg.stopDist)),
        0xfca5a5
      );
    }
    this.audio.shoot(msg.weaponId || 'ar', true);
  }

  _onNetMelee(msg) {
    void msg;
    this.audio.melee(true);
  }

  _onNetNade(msg) {
    const pos = this._vec(msg.pos);
    const vel = this._vec(msg.vel);
    if (!pos || !vel) return;
    this.grenades.push({
      pos,
      vel,
      damage: msg.damage,
      splash: msg.splash,
      fuse: msg.fuse,
      weapon: msg.weapon,
      kind: msg.kind || 'grenade',
      gravity: msg.gravity ?? 18,
      impact: Boolean(msg.impact),
      radius: msg.radius ?? 0.15,
      color: msg.color ?? 0x4ade80,
      age: 0,
      fromNet: true,
      ownerIsMe: false,
      eventId: msg.eventId,
      weaponId: msg.weaponId,
    });
    if (msg.kind === 'rocket') this.audio.shoot('rpg', true);
    else this.audio.throw(true);
  }

  _onNetDamage(msg) {
    if (!Number.isFinite(msg.hp)) return;
    this.player.hp = Math.max(0, Math.min(this.player.maxHp, msg.hp));
    this.player.alive = this.player.hp > 0;
    if (!this.player.alive) this.player.velocity.set(0, 0, 0);
    this.hurtVignette();
    this.audio.hurt();
  }

  _onNetDamageAck(msg) {
    if (msg.target !== 'other' || !Number.isFinite(msg.hp)) return;
    this.remote.hp = Math.max(0, Math.min(this.remote.maxHp, msg.hp));
    this.remote.alive = this.remote.hp > 0;
    this.remote.mesh.visible = this.remote.alive;
    if (msg.dead) {
      this.flashHitmarker(true);
      this.audio.hit(true);
    }
  }

  _onNetRoundResult(msg) {
    if (msg.score) this.score = { ...msg.score };
    this._applyRoundEnd(msg.winner === 'self', msg.weapon || 'UNKNOWN', this.score);
  }

  // ── Main loop ────────────────────────────────────────

  update(dt, now) {
    if (this.state !== 'playing') {
      this._updateTracers(dt);
      if (this.mode === 'online') this.remote.update(dt);
      return;
    }

    // Local player
    const pAct = this.player.update(dt, now, {
      onDoubleJump: () => this.showBanner('DOUBLE JUMP'),
    });
    this._handlePlayerEvents(pAct.events);

    // Network state stream
    this._stateAcc += dt;
    if (this._stateAcc >= 0.05) {
      this._stateAcc = 0;
      this._sendState();
    }

    if (this.mode === 'online') {
      this.remote.update(dt);
      this._resolveLocalActionsOnline(pAct);
    } else {
      this._resolveAiMode(pAct, dt, now);
    }

    this._updateGrenades(dt);
    this._updateTracers(dt);
    this._updateHUD();
  }

  _resolveAiMode(pAct, dt, now) {
    const bAct = this.bot.update(
      dt,
      now,
      this.player.position.clone(),
      this.player.alive
    );

    for (const s of pAct.shots) {
      this.audio.shoot(s.weaponId);
      const result = this._castShot(s, this.bot);
      this._spawnTracer(s.origin, s.dir, 0x67e8f9, result.stopDist, s.muzzle);
      this._spawnImpact(result.point, result.hitTarget ? 0xf87171 : 0xfef3c7);
      if (result.hitTarget && this.bot.alive) {
        const dmg = Math.round(s.damage * (result.head ? s.headMult : 1));
        const dead = this.bot.takeDamage(dmg);
        this.flashHitmarker(dead);
        this.audio.hit(dead);
        this.showDamageNumber(result.head, dmg);
        if (dead) this._onKill(true, s.weapon);
      }
    }

    if (pAct.melee && this.bot.alive) {
      this.audio.melee();
      if (this._meleeHit(pAct.melee, this.bot)) {
        const dmg = pAct.melee.damage;
        const dead = this.bot.takeDamage(dmg);
        this.flashHitmarker(dead);
        this.audio.hit(dead);
        this.showDamageNumber(false, dmg);
        if (dead) this._onKill(true, pAct.melee.weapon);
      }
    }

    for (const s of bAct.shots) {
      this.audio.shoot(s.weaponId || 'ar', true);
      const result = this._castShot(s, this.player);
      this._spawnTracer(s.origin, s.dir, 0xef4444, result.stopDist);
      this._spawnImpact(result.point, result.hitTarget ? 0xf87171 : 0xfef3c7);
      if (result.hitTarget && this.player.alive) {
        const dmg = Math.round(s.damage * (result.head ? s.headMult : 1));
        const dead = this.player.takeDamage(dmg);
        this.hurtVignette();
        this.audio.hurt();
        if (dead) this._onKill(false, s.weapon);
      }
    }

    if (bAct.melee && this.player.alive) {
      this.audio.melee(true);
      if (this._meleeHit(bAct.melee, this.player)) {
        const dead = this.player.takeDamage(bAct.melee.damage);
        this.hurtVignette();
        this.audio.hurt();
        if (dead) this._onKill(false, bAct.melee.weapon);
      }
    }

    for (const n of pAct.nades) {
      if (n.weaponId === 'rpg') this.audio.shoot('rpg');
      else this.audio.throw();
      this.grenades.push({ ...n, age: 0, ownerIsMe: true });
    }
    for (const n of bAct.nades) {
      if (n.weaponId === 'rpg') this.audio.shoot('rpg', true);
      else this.audio.throw(true);
      this.grenades.push({ ...n, age: 0, ownerIsMe: false });
    }
  }

  _resolveLocalActionsOnline(pAct) {
    const opp = this.remote;

    for (const s of pAct.shots) {
      const eventId = this._nextEventId('shot');
      this.audio.shoot(s.weaponId);
      const result = this._castShot(s, opp);
      this._spawnTracer(s.origin, s.dir, 0x67e8f9, result.stopDist, s.muzzle);
      this._spawnImpact(result.point, result.hitTarget ? 0xf87171 : 0xfef3c7);

      // Tell peer to draw our tracer
      this.net.send({
        type: 'shot_fx',
        origin: this._packVec(s.origin),
        muzzle: this._packVec(s.muzzle),
        dir: this._packVec(s.dir),
        stopDist: result.stopDist,
        color: 0xef4444,
        eventId,
        weaponId: s.weaponId,
        impact: Boolean(result.point),
      });

      if (result.hitTarget && opp.alive) {
        const dmg = Math.round(s.damage * (result.head ? s.headMult : 1));
        this.flashHitmarker(false);
        this.audio.hit(false);
        this.showDamageNumber(result.head, dmg);
        this.net.send({
          type: 'damage',
          damage: dmg,
          head: result.head,
          weapon: s.weapon,
          weaponId: s.weaponId,
          eventId,
          target: 'other',
        });
      }
    }

    if (pAct.melee && opp.alive) {
      const eventId = this._nextEventId('melee');
      this.audio.melee();
      if (this._meleeHit(pAct.melee, opp)) {
        const dmg = pAct.melee.damage;
        this.flashHitmarker(false);
        this.audio.hit(false);
        this.showDamageNumber(false, dmg);
        this.net.send({
          type: 'melee',
          weapon: pAct.melee.weapon,
          weaponId: pAct.melee.weaponId,
          eventId,
        });
        this.net.send({
          type: 'damage',
          damage: dmg,
          head: false,
          weapon: pAct.melee.weapon,
          weaponId: pAct.melee.weaponId,
          eventId,
          target: 'other',
        });
      }
    }

    for (const n of pAct.nades) {
      const eventId = this._nextEventId(n.kind === 'rocket' ? 'rocket' : 'nade');
      if (n.weaponId === 'rpg') this.audio.shoot('rpg');
      else this.audio.throw();
      this.grenades.push({ ...n, age: 0, ownerIsMe: true, eventId });
      this.net.send({
        type: 'nade',
        pos: this._packVec(n.pos),
        vel: this._packVec(n.vel),
        damage: n.damage,
        splash: n.splash,
        fuse: n.fuse,
        weapon: n.weapon,
        kind: n.kind,
        gravity: n.gravity,
        impact: n.impact,
        radius: n.radius,
        color: n.color,
        weaponId: n.weaponId,
        eventId,
      });
    }
  }

  _castShot(shot, target) {
    const maxRange = shot.range ?? 120;
    const wallDist = this._wallDistance(shot.origin, shot.dir, maxRange);

    let targetDist = Infinity;
    let head = false;
    let targetPoint = null;

    if (target && target.alive) {
      const boxes = target.getHitboxes();
      const ray = new THREE.Ray(shot.origin, shot.dir);
      const tmp = new THREE.Vector3();

      const headPt = ray.intersectBox(boxes.head, tmp);
      if (headPt) {
        const d = headPt.distanceTo(shot.origin);
        if (d <= maxRange && d < targetDist) {
          targetDist = d;
          head = true;
          targetPoint = headPt.clone();
        }
      }
      const bodyPt = ray.intersectBox(boxes.body, tmp);
      if (bodyPt) {
        const d = bodyPt.distanceTo(shot.origin);
        if (d <= maxRange && d < targetDist) {
          targetDist = d;
          head = false;
          targetPoint = bodyPt.clone();
        }
      }
    }

    if (targetDist < Infinity && targetDist < wallDist - 0.02) {
      return { hitTarget: true, head, point: targetPoint, stopDist: targetDist };
    }
    return {
      hitTarget: false,
      head: false,
      point:
        wallDist < maxRange
          ? shot.origin.clone().add(shot.dir.clone().normalize().multiplyScalar(wallDist))
          : null,
      stopDist: Math.min(wallDist, maxRange),
    };
  }

  _wallDistance(origin, dir, maxDist) {
    const ray = new THREE.Ray(origin, dir.clone().normalize());
    let best = maxDist;
    const tmp = new THREE.Vector3();
    for (const c of this.arena.colliders) {
      if (c.containsPoint(origin)) continue;
      const hit = ray.intersectBox(c, tmp);
      if (!hit) continue;
      const d = origin.distanceTo(hit);
      if (d < 0.08) continue;
      if (d < best) best = d;
    }
    return best;
  }

  hasLOS(from, to, epsilon = 0.15) {
    const delta = to.clone().sub(from);
    const dist = delta.length();
    if (dist < 0.01) return true;
    const dir = delta.normalize();
    return this._wallDistance(from, dir, dist) >= dist - epsilon;
  }

  _meleeHit(melee, target) {
    if (!target.alive) return false;
    const chest = target.position.clone().add(new THREE.Vector3(0, 1, 0));
    const to = chest.clone().sub(melee.origin);
    const dist = to.length();
    if (dist > melee.range) return false;
    if (to.clone().normalize().dot(melee.dir) < 0.35) return false;
    if (!this.hasLOS(melee.origin, chest, 0.2)) return false;
    return true;
  }

  _acquireFx(kind, color) {
    const pool = this._fxPools[kind];
    let mesh = pool.pop();
    if (!mesh) {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        blending: kind === 'bullet' ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      });
      mesh = new THREE.Mesh(this._fxGeometry[kind], material);
    }
    mesh.material.color.setHex(color);
    mesh.material.opacity = 1;
    mesh.visible = true;
    mesh.scale.set(1, 1, 1);
    this.scene.add(mesh);
    return mesh;
  }

  _releaseFx(mesh, kind) {
    this.scene.remove(mesh);
    mesh.visible = false;
    this._fxPools[kind].push(mesh);
  }

  _acquireProjectile(kind, color, radius) {
    const poolKind = kind === 'rocket' ? 'rocket' : 'grenade';
    let mesh = this._projectilePools[poolKind].pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        this._projectileGeometry[poolKind],
        new THREE.MeshBasicMaterial({ color })
      );
    }
    mesh.material.color.setHex(color);
    const baseRadius = poolKind === 'rocket' ? 0.18 : 0.15;
    const radialScale = radius / baseRadius;
    mesh.scale.set(radialScale, 1, radialScale);
    mesh.visible = true;
    this.scene.add(mesh);
    return mesh;
  }

  _releaseProjectile(mesh, kind) {
    const poolKind = kind === 'rocket' ? 'rocket' : 'grenade';
    this.scene.remove(mesh);
    mesh.visible = false;
    this._projectilePools[poolKind].push(mesh);
  }

  _spawnTracer(origin, dir, color, stopDist = 40, visualOrigin = null) {
    const len = Math.max(0.2, Math.min(stopDist, 80));
    const end = origin.clone().add(dir.clone().normalize().multiplyScalar(len));
    const start = (visualOrigin || origin).clone();
    const travel = end.clone().sub(start);
    const distance = travel.length();
    if (distance < 0.05) return;

    const streakLength = THREE.MathUtils.clamp(distance * 0.1, 0.9, 2.4);
    const travelDir = travel.clone().normalize();
    const bullet = this._acquireFx('bullet', color);
    bullet.scale.set(1, streakLength, 1);
    bullet.quaternion.setFromUnitVectors(
      this._up,
      travelDir
    );
    const renderStart = start.clone().addScaledVector(travelDir, streakLength * 0.5);
    const renderEnd = end.clone().addScaledVector(travelDir, -streakLength * 0.5);
    bullet.position.copy(renderStart);

    const duration = THREE.MathUtils.clamp(distance / 160, 0.14, 0.4);
    this.tracers.push({
      line: bullet,
      kind: 'bullet',
      start: renderStart,
      end: renderEnd,
      life: duration,
      maxLife: duration,
      startOpacity: 1,
      poolKind: 'bullet',
    });
  }

  _spawnRocketTrail(from, to, color = 0xf97316) {
    const delta = to.clone().sub(from);
    const length = delta.length();
    if (length < 0.01) return;

    const trail = this._acquireFx('trail', color);
    trail.scale.set(1, length, 1);
    trail.material.opacity = 0.9;
    trail.position.copy(from).add(to).multiplyScalar(0.5);
    trail.quaternion.setFromUnitVectors(
      this._up,
      delta.normalize()
    );
    this.tracers.push({
      line: trail,
      life: 0.18,
      maxLife: 0.18,
      startOpacity: 0.9,
      poolKind: 'trail',
    });
  }

  _spawnImpact(point, color = 0xfef3c7) {
    if (!point) return;
    const impact = this._acquireFx('impact', color);
    impact.position.copy(point);
    impact.scale.setScalar(0.08);
    this.tracers.push({
      line: impact,
      life: 0.12,
      maxLife: 0.12,
      startOpacity: 0.85,
      poolKind: 'impact',
    });
  }

  _updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.kind === 'bullet') {
        const progress = 1 - Math.max(0, t.life) / t.maxLife;
        t.line.position.lerpVectors(t.start, t.end, progress);
      }
      if (t.line.material.transparent && t.maxLife) {
        t.line.material.opacity =
          (t.startOpacity ?? 1) * Math.max(0, t.life / t.maxLife);
      }
      if (t.life <= 0) {
        this._releaseFx(t.line, t.poolKind);
        this.tracers.splice(i, 1);
      }
    }
  }

  clearTracers() {
    for (const t of this.tracers) {
      this._releaseFx(t.line, t.poolKind);
    }
    this.tracers = [];
  }

  _clearProjectiles() {
    for (const projectile of this.grenades) {
      if (!projectile.mesh) continue;
      this._releaseProjectile(projectile.mesh, projectile.kind);
    }
    this.grenades = [];
  }

  _projectileImpact(g, from, to) {
    const delta = to.clone().sub(from);
    const travel = delta.length();
    if (travel < 0.0001) return null;

    const dir = delta.multiplyScalar(1 / travel);
    let best = travel + 1;
    const wallDist = this._wallDistance(from, dir, travel + (g.radius || 0));
    if (wallDist < travel + (g.radius || 0) - 0.0001) {
      best = Math.max(0, wallDist - (g.radius || 0));
    }

    let target;
    if (this.mode === 'online') {
      target = g.ownerIsMe ? this.remote : this.player;
    } else {
      target = g.ownerIsMe ? this.bot : this.player;
    }

    if (target?.alive) {
      const ray = new THREE.Ray(from, dir);
      const tmp = new THREE.Vector3();
      const boxes = target.getHitboxes();
      for (const box of [boxes.head, boxes.body]) {
        const hit = ray.intersectBox(box, tmp);
        if (!hit) continue;
        const d = hit.distanceTo(from);
        if (d <= travel && d < best) best = d;
      }
    }

    return best <= travel ? from.clone().add(dir.multiplyScalar(best)) : null;
  }

  _updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.age += dt;
      g.vel.y -= (g.gravity ?? 18) * dt;
      const previous = g.pos.clone();
      const next = g.pos.clone().add(g.vel.clone().multiplyScalar(dt));
      let impacted = false;

      if (g.impact) {
        const impactPoint = this._projectileImpact(g, previous, next);
        if (impactPoint) {
          g.pos.copy(impactPoint);
          impacted = true;
        } else {
          g.pos.copy(next);
        }
      } else {
        g.pos.copy(next);
        if (g.pos.y < 0.2) {
          g.pos.y = 0.2;
          g.vel.y *= -0.35;
          g.vel.x *= 0.7;
          g.vel.z *= 0.7;
        }
      }

      // Draw the path before resolving the explosion so even an immediate hit
      // leaves a visible segment. Missed rockets build a continuous trail.
      if (g.kind === 'rocket') {
        g.trailT = (g.trailT || 0) + dt;
        const trailInterval =
          this.settings.effects === 'low' || this.settings.reducedMotion ? 0.05 : 0;
        if (g.trailT >= trailInterval) {
          this._spawnRocketTrail(previous, g.pos, g.color);
          g.trailT = 0;
        }
      }

      if (!g.mesh) {
        g.mesh = this._acquireProjectile(
          g.kind,
          g.color ?? 0x4ade80,
          g.radius || (g.kind === 'rocket' ? 0.18 : 0.15)
        );
      }
      g.mesh.position.copy(g.pos);
      if (g.kind === 'rocket' && g.vel.lengthSq() > 0.001) {
        g.mesh.quaternion.setFromUnitVectors(
          this._up,
          g.vel.clone().normalize()
        );
      }

      if (impacted || g.age >= g.fuse) {
        this._explode(g);
        this._releaseProjectile(g.mesh, g.kind);
        this.grenades.splice(i, 1);
      }
    }
  }

  _explode(g) {
    const blast = this._acquireFx(
      'blast',
      g.kind === 'rocket' ? 0xf97316 : 0xfbbf24
    );
    blast.position.copy(g.pos);
    blast.scale.setScalar(g.splash * 0.5);
    blast.material.opacity = 0.45;
    this.tracers.push({
      line: blast,
      life: 0.12,
      maxLife: 0.12,
      startOpacity: 0.45,
      poolKind: 'blast',
    });
    this.audio.explosion(!g.ownerIsMe);

    // Damage only applied by owner (avoid double damage online)
    if (this.mode === 'online' && g.fromNet) {
      // Peer owns damage calc for their nade — wait, peer sent nade for FX only.
      // Owner applies damage to remote + self and nets damage.
    }

    const applyTo = (ent, isMe) => {
      if (this.state !== 'playing' && this.state !== 'pause') return;
      if (!ent.alive) return;
      const chest = ent.position.clone().add(new THREE.Vector3(0, 1, 0));
      const d = chest.distanceTo(g.pos);
      if (d >= g.splash) return;
      if (!this.hasLOS(g.pos, chest, 0.25)) return;
      const falloff = 1 - d / g.splash;
      const dmg = Math.round(g.damage * falloff);
      if (dmg < 5) return;

      if (this.mode === 'online') {
        // The projectile owner reports the candidate damage; the server owns HP,
        // death, score and round completion.
        if (!g.ownerIsMe) return;
        if (isMe) {
          this.player.takeDamage(dmg);
          this.hurtVignette();
          this.audio.hurt();
          this.net.send({
            type: 'damage',
            damage: dmg,
            head: false,
            weapon: g.weapon,
            weaponId: g.weaponId,
            eventId: g.eventId,
            target: 'self',
          });
        } else {
          this.flashHitmarker(false);
          this.audio.hit(false);
          this.showDamageNumber(false, dmg);
          this.net.send({
            type: 'damage',
            damage: dmg,
            head: false,
            weapon: g.weapon,
            weaponId: g.weaponId,
            eventId: g.eventId,
            target: 'other',
          });
        }
        return;
      }

      // AI mode
      const dead = ent.takeDamage(dmg);
      if (isMe) {
        this.hurtVignette();
        this.audio.hurt();
        if (dead) this._onKill(false, g.weapon);
      } else {
        this.flashHitmarker(dead);
        this.showDamageNumber(false, dmg);
        if (dead) this._onKill(true, g.weapon);
      }
    };

    if (this.mode === 'online') {
      applyTo(this.player, true);
      applyTo(this.remote, false);
    } else {
      applyTo(this.player, true);
      applyTo(this.bot, false);
    }
  }

  _onKill(playerWonRound, weapon) {
    if (this.state !== 'playing' && this.state !== 'pause') return;
    // Online HP, score and round results are owned by the server.
    if (this.mode === 'online') return;

    if (playerWonRound) this.score.you++;
    else this.score.enemy++;

    this._applyRoundEnd(playerWonRound, weapon, this.score);
  }

  _applyRoundEnd(playerWonRound, weapon, score) {
    if (this.state !== 'playing' && this.state !== 'pause') return;
    this.state = 'round_end';
    this.ui.pause.classList.add('hidden');

    if (score && score.you !== undefined) {
      this.score = { you: score.you, enemy: score.enemy };
    }

    if (playerWonRound) {
      this.addKillFeed('YOU', this.mode === 'online' ? 'PLAYER' : 'RIVAL', weapon, false);
      this.ui.roundEndTitle.textContent = 'ELIMINATED';
      this.ui.roundEndTitle.classList.remove('defeat');
      this.ui.roundEndSub.textContent = 'You won the round';
    } else {
      this.addKillFeed(this.mode === 'online' ? 'PLAYER' : 'RIVAL', 'YOU', weapon, true);
      this.ui.roundEndTitle.textContent = 'YOU DIED';
      this.ui.roundEndTitle.classList.add('defeat');
      this.ui.roundEndSub.textContent = 'Rival won the round';
    }
    this._updateScore();
    this.ui.roundEnd.classList.remove('hidden');

    if (this.score.you >= WIN_SCORE || this.score.enemy >= WIN_SCORE) {
      this._pendingT = setTimeout(() => {
        this._matchEnd();
      }, 1600);
    } else {
      this._pendingT = setTimeout(() => {
        if (this.mode === 'online') {
          // Host drives next round
          if (this.net.role === 'host') this.startRound();
          // Guest waits for round_start
        } else {
          this.startRound();
        }
      }, 2200);
    }
  }

  _matchEnd() {
    this.state = 'match_end';
    this.player.unlock();
    this.ui.pause.classList.add('hidden');
    this.ui.roundEnd.classList.add('hidden');
    this.ui.matchEnd.classList.remove('hidden');
    const won = this.score.you >= WIN_SCORE;
    this.ui.matchEndTitle.textContent = won ? 'VICTORY' : 'DEFEAT';
    this.ui.matchEndTitle.classList.toggle('defeat', !won);
    this.ui.matchEndScore.textContent = `${this.score.you} — ${this.score.enemy}`;
  }
}
