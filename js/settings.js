const KEY = 'rivals.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  sensitivity: 1,
  volume: 0.55,
  fov: 80,
  effects: 'high',
  autoQuality: true,
  touchLayout: { leftHanded: false, portrait: {}, landscape: {} },
  reducedMotion: false,
});

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export function normalizeSettings(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    sensitivity: clamp(value.sensitivity, 0.25, 2, DEFAULT_SETTINGS.sensitivity),
    volume: clamp(value.volume, 0, 1, DEFAULT_SETTINGS.volume),
    fov: clamp(value.fov, 65, 100, DEFAULT_SETTINGS.fov),
    effects: value.effects === 'low' ? 'low' : 'high',
    autoQuality: value.autoQuality !== false,
    touchLayout: normalizeTouchLayout(value.touchLayout),
    reducedMotion: Boolean(value.reducedMotion),
  };
}

export function normalizeTouchLayout(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const layout = { leftHanded: Boolean(value.leftHanded), portrait: {}, landscape: {} };
  for (const orientation of ['portrait', 'landscape']) {
    for (const id of ['joystick', 'fire', 'jump', 'slide', 'reload', 'pause']) {
      const item = value[orientation]?.[id];
      if (!item || typeof item !== 'object') continue;
      layout[orientation][id] = {
        x: clamp(item.x, 0, 1, 0.5), y: clamp(item.y, 0, 1, 0.5),
        size: clamp(item.size, id === 'joystick' ? 80 : 44, id === 'joystick' ? 160 : 110, 64),
        opacity: clamp(item.opacity, 0.3, 1, 0.85),
      };
    }
  }
  return layout;
}

export function loadSettings() {
  const touchDefault =
    new URLSearchParams(window.location.search).has('touch') ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches;
  const defaults = {
    ...DEFAULT_SETTINGS,
    effects: touchDefault ? 'low' : DEFAULT_SETTINGS.effects,
  };
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? normalizeSettings(JSON.parse(saved)) : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized));
  } catch {
    // Storage may be unavailable in privacy mode; settings still apply in memory.
  }
  return normalized;
}
