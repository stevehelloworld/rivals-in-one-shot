import { normalizeTouchLayout } from './settings.js';

export class TouchLayoutEditor {
  constructor(controls) {
    this.controls = controls;
    this.root = controls.root;
    this.panel = document.getElementById('touch-editor');
    this.select = document.getElementById('layout-control');
    this.size = document.getElementById('layout-size');
    this.opacity = document.getElementById('layout-opacity');
    this.x = document.getElementById('layout-x');
    this.y = document.getElementById('layout-y');
    this.hand = document.getElementById('layout-left-hand');
    this.items = new Map([['joystick', controls.joystick],
      ...controls.actionButtons.map(button => [button.dataset.action, button])]);
    this.layout = normalizeTouchLayout(controls.options.getLayout?.());
    this.editing = false;
    this.drag = null;
    document.getElementById('btn-touch-layout').addEventListener('click', () => this.open());
    document.getElementById('layout-save').addEventListener('click', () => this.close(true));
    document.getElementById('layout-cancel').addEventListener('click', () => this.close(false));
    document.getElementById('layout-reset').addEventListener('click', () => {
      this.layout[this.orientation] = {};
      this.apply(); this.sync();
    });
    this.select.addEventListener('change', () => this.sync());
    const change = () => {
      const item = this.current();
      item.size = Number(this.size.value);
      item.opacity = Number(this.opacity.value);
      this.apply(); this.sync();
    };
    this.size.addEventListener('input', change);
    this.opacity.addEventListener('input', change);
    for (const input of [this.x, this.y]) input.addEventListener('input', () => {
      const item = this.current();
      const x = Number(this.x.value) / 100;
      item.x = this.layout.leftHanded ? 1 - x : x;
      item.y = Number(this.y.value) / 100;
      this.apply(); this.sync();
    });
    this.hand.addEventListener('change', () => {
      this.layout.leftHanded = this.hand.checked;
      this.apply(); this.sync();
    });
    this.root.addEventListener('pointerdown', event => {
      if (!this.editing || this.panel.contains(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const element = event.target.closest('.touch-action, .touch-joystick');
      if (!element) return;
      const id = element.dataset.action || 'joystick';
      this.select.value = id;
      const rect = element.getBoundingClientRect();
      this.drag = { id, pointer: event.pointerId,
        dx: event.clientX - rect.left - rect.width / 2,
        dy: event.clientY - rect.top - rect.height / 2 };
      element.setPointerCapture(event.pointerId);
      this.sync();
    }, true);
    this.root.addEventListener('pointermove', event => {
      if (!this.editing || !this.drag || event.pointerId !== this.drag.pointer) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const item = this.current();
      const x = (event.clientX - this.drag.dx) / innerWidth;
      item.x = this.layout.leftHanded ? 1 - x : x;
      item.y = (event.clientY - this.drag.dy) / innerHeight;
      this.apply();
    }, true);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.root.addEventListener(type, event => {
        if (!this.editing || !this.drag || event.pointerId !== this.drag.pointer) return;
        this.drag = null;
        event.stopImmediatePropagation();
      }, true);
    }
    window.addEventListener('resize', () => {
      this.drag = null;
      if (controls.active || this.editing) this.apply();
      if (this.editing) this.sync();
    });
    document.addEventListener('keydown', event => {
      if (this.editing && event.code === 'Escape') this.close(false);
      if (this.editing && event.code === 'Tab') {
        const focusable = [...this.panel.querySelectorAll('button, input, select')];
        const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1];
        if (document.activeElement === edge) {
          event.preventDefault();
          (event.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus();
        }
      }
    });
  }

  get orientation() { return innerWidth > innerHeight ? 'landscape' : 'portrait'; }

  open() {
    this.layout = normalizeTouchLayout(this.controls.options.getLayout?.());
    this.controls.reset();
    this.editing = true;
    document.getElementById('menu').inert = true;
    this.root.classList.add('editing');
    this.root.setAttribute('aria-hidden', 'false');
    this.panel.hidden = false;
    this.apply(); this.sync();
    this.select.focus();
  }

  close(save) {
    if (save) this.controls.options.saveLayout?.(normalizeTouchLayout(this.layout));
    else this.layout = normalizeTouchLayout(this.controls.options.getLayout?.());
    this.editing = false;
    this.drag = null;
    this.panel.hidden = true;
    document.getElementById('menu').inert = false;
    this.root.classList.remove('editing');
    this.root.setAttribute('aria-hidden', String(!this.controls.active));
    document.getElementById('btn-touch-layout').focus();
  }

  current() {
    const id = this.select.value;
    const map = this.layout[this.orientation];
    if (!map[id]) {
      const rect = this.items.get(id).getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / innerWidth;
      map[id] = { x: this.layout.leftHanded ? 1 - x : x,
        y: (rect.top + rect.height / 2) / innerHeight,
        size: rect.width, opacity: 0.85 };
    }
    return map[id];
  }

  sync() {
    const item = this.current();
    this.size.min = this.select.value === 'joystick' ? 80 : 44;
    this.size.max = this.select.value === 'joystick' ? 160 : 110;
    this.size.value = item.size;
    this.opacity.value = item.opacity;
    this.x.value = (this.layout.leftHanded ? 1 - item.x : item.x) * 100;
    this.y.value = item.y * 100;
    this.hand.checked = this.layout.leftHanded;
    document.getElementById('layout-orientation').textContent = this.orientation;
    document.getElementById('layout-size-value').textContent = `${Math.round(item.size)}px`;
    document.getElementById('layout-opacity-value').textContent = `${Math.round(item.opacity * 100)}%`;
    for (const [id, element] of this.items) element.classList.toggle('layout-selected', id === this.select.value);
  }

  apply() {
    this.root.classList.toggle('left-handed', this.layout.leftHanded);
    const safe = getComputedStyle(this.root);
    const left = Math.max(14, parseFloat(safe.paddingLeft) || 0);
    const right = Math.max(14, parseFloat(safe.paddingRight) || 0);
    const top = Math.max(14, parseFloat(safe.paddingTop) || 0);
    const bottom = Math.max(14, parseFloat(safe.paddingBottom) || 0);
    for (const [id, element] of this.items) {
      element.removeAttribute('style');
      const base = element.getBoundingClientRect();
      const item = this.layout[this.orientation][id];
      const size = item?.size || base.width;
      let x = item ? item.x * innerWidth : base.left + base.width / 2;
      if (this.layout.leftHanded) x = innerWidth - x;
      const y = item ? item.y * innerHeight : base.top + base.height / 2;
      const px = Math.max(left, Math.min(innerWidth - right - size, x - size / 2));
      const py = Math.max(top, Math.min(innerHeight - bottom - size, y - size / 2));
      Object.assign(element.style, { left: `${px}px`, top: `${py}px`, right: 'auto', bottom: 'auto',
        width: `${size}px`, height: `${size}px`, minWidth: '44px', minHeight: '44px', opacity: String(item?.opacity ?? 0.85) });
    }
  }
}
