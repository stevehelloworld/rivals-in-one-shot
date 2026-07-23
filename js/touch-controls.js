import { clampStick } from './touch-math.mjs';

function touchCapable() {
  return (
    new URLSearchParams(window.location.search).has('touch') ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches
  );
}

export class TouchControls {
  constructor(root, player, options = {}) {
    this.root = root;
    this.player = player;
    this.options = options;
    this.supported = touchCapable() && Boolean(root);
    this.active = false;
    this.movePointer = null;
    this.lookPointer = null;
    this.lookX = 0;
    this.lookY = 0;

    if (!this.supported) return;
    this.joystick = root.querySelector('[data-touch="joystick"]');
    this.knob = root.querySelector('[data-touch="joystick-knob"]');
    this.lookZone = root.querySelector('[data-touch="look"]');
    this.actionButtons = [...root.querySelectorAll('[data-action]')];
    this.weaponSlots = [...document.querySelectorAll('.wslot[data-slot]')];

    document.body.classList.add('touch-capable');
    this._bindJoystick();
    this._bindLook();
    this._bindActions();
    root.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  setActive(active) {
    if (!this.supported) return;
    this.active = Boolean(active);
    this.root.classList.toggle('active', this.active);
    this.root.setAttribute('aria-hidden', String(!this.active));
    document.body.classList.toggle('touch-playing', this.active);
    if (!this.active) this.reset();
  }

  reset() {
    this.movePointer = null;
    this.lookPointer = null;
    this.player.setTouchMove(0, 0);
    this.player.cancelFire();
    this.player.jumpQueued = false;
    this.player.slideQueued = false;
    this.player.keys.crouch = false;
    this.player.keys.jump = false;
    if (this.knob) this.knob.style.transform = 'translate3d(0, 0, 0)';
    for (const button of this.actionButtons) button.classList.remove('pressed');
  }

  _bindJoystick() {
    if (!this.joystick || !this.knob) return;

    const update = (event) => {
      const rect = this.joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = Math.max(24, rect.width * 0.32);
      const stick = clampStick(event.clientX - centerX, event.clientY - centerY, radius);
      this.player.setTouchMove(stick.x, stick.y);
      this.knob.style.transform = `translate3d(${stick.dx}px, ${stick.dy}px, 0)`;
    };

    this.joystick.addEventListener('pointerdown', (event) => {
      if (!this.active || this.movePointer !== null) return;
      event.preventDefault();
      this.movePointer = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      update(event);
    });
    this.joystick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.movePointer) return;
      event.preventDefault();
      update(event);
    });
    const release = (event) => {
      if (event.pointerId !== this.movePointer) return;
      this.movePointer = null;
      this.player.setTouchMove(0, 0);
      this.knob.style.transform = 'translate3d(0, 0, 0)';
    };
    this.joystick.addEventListener('pointerup', release);
    this.joystick.addEventListener('pointercancel', release);
    this.joystick.addEventListener('lostpointercapture', release);
  }

  _bindLook() {
    if (!this.lookZone) return;
    this.lookZone.addEventListener('pointerdown', (event) => {
      if (!this.active || this.lookPointer !== null) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      this.lookX = event.clientX;
      this.lookY = event.clientY;
      this.lookZone.setPointerCapture(event.pointerId);
    });
    this.lookZone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointer) return;
      event.preventDefault();
      const dx = event.clientX - this.lookX;
      const dy = event.clientY - this.lookY;
      this.lookX = event.clientX;
      this.lookY = event.clientY;
      this.player.applyTouchLook(dx, dy, this.options.getSensitivity?.() ?? 1);
    });
    const release = (event) => {
      if (event.pointerId === this.lookPointer) this.lookPointer = null;
    };
    this.lookZone.addEventListener('pointerup', release);
    this.lookZone.addEventListener('pointercancel', release);
    this.lookZone.addEventListener('lostpointercapture', release);
  }

  _bindActions() {
    for (const button of this.actionButtons) {
      const action = button.dataset.action;
      const press = (event) => {
        if (!this.active) return;
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add('pressed');
        navigator.vibrate?.(8);

        if (action === 'fire') this.player.pressFire();
        if (action === 'jump') this.player.requestJump();
        if (action === 'slide') this.player.requestSlide();
        if (action === 'reload') this.player.requestReload();
        if (action === 'weapon') this.player.cycleWeapon();
        if (action === 'pause') this.options.onPause?.();
      };
      const release = (event) => {
        event.preventDefault();
        button.classList.remove('pressed');
        if (action === 'fire') this.player.releaseFire();
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    }

    for (const slot of this.weaponSlots) {
      const selectSlot = (event) => {
        if (!this.active) return;
        event.preventDefault();
        const index = Number(slot.dataset.slot);
        if (Number.isInteger(index)) {
          navigator.vibrate?.(6);
          this.player.switchSlot(index);
        }
      };
      slot.addEventListener('pointerdown', selectSlot);
      slot.addEventListener('click', selectSlot);
    }
  }
}
