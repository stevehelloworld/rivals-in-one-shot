const AudioContextClass = window.AudioContext || window.webkitAudioContext;

/** Lightweight synthesized game audio; no external asset download is required. */
export class GameAudio {
  constructor(volume = 0.55) {
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
    this.volume = volume;
  }

  async resume() {
    if (!AudioContextClass) return;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.context.createBuffer(
        1,
        this.context.sampleRate,
        this.context.sampleRate
      );
      const noise = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    }
  }

  _tone(frequency, duration, gain, type = 'square', slideTo = null, delay = 0) {
    if (!this.context || !this.master || this.volume <= 0) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    }
    envelope.gain.setValueAtTime(Math.max(0.0001, gain), now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  _noise(duration, gain, filterFrequency = 1200, delay = 0) {
    if (!this.context || !this.master || this.volume <= 0) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const now = this.context.currentTime + delay;
    source.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    envelope.gain.setValueAtTime(Math.max(0.0001, gain), now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    const maxOffset = Math.max(0, 1 - duration);
    source.start(now, Math.random() * maxOffset, duration);
  }

  shoot(weaponId, remote = false) {
    const level = remote ? 0.35 : 0.7;
    if (weaponId === 'rpg') {
      this._noise(0.32, 0.42 * level, 700);
      this._tone(95, 0.28, 0.32 * level, 'sawtooth', 42);
    } else if (weaponId === 'handgun') {
      this._noise(0.1, 0.28 * level, 2100);
      this._tone(190, 0.08, 0.18 * level, 'square', 90);
    } else {
      this._noise(0.09, 0.25 * level, 1500);
      this._tone(135, 0.075, 0.16 * level, 'square', 65);
    }
  }

  melee(remote = false) {
    const level = remote ? 0.3 : 0.55;
    this._noise(0.1, level, 650);
    this._tone(115, 0.08, level * 0.25, 'sine', 55);
  }

  throw(remote = false) {
    const level = remote ? 0.18 : 0.32;
    this._noise(0.11, level, 900);
    this._tone(145, 0.1, level * 0.35, 'sine', 95);
  }

  reloadStart(weaponId) {
    const base = weaponId === 'rpg' ? 125 : 220;
    this._tone(base, 0.055, 0.13, 'square', base * 0.75);
    this._tone(base * 0.8, 0.06, 0.1, 'square', base * 1.1, 0.12);
  }

  reloadComplete(weaponId) {
    const base = weaponId === 'rpg' ? 145 : 280;
    this._tone(base, 0.05, 0.12, 'square', base * 1.4);
    this._tone(base * 1.4, 0.055, 0.09, 'square', base * 1.8, 0.055);
  }

  hit(kill = false) {
    this._tone(kill ? 760 : 620, kill ? 0.13 : 0.07, 0.11, 'sine', kill ? 1120 : 760);
  }

  hurt() {
    this._noise(0.14, 0.18, 420);
    this._tone(82, 0.15, 0.12, 'sawtooth', 48);
  }

  explosion(remote = false) {
    const level = remote ? 0.28 : 0.5;
    this._noise(0.42, level, 620);
    this._tone(72, 0.38, level * 0.55, 'sawtooth', 28);
  }
}
