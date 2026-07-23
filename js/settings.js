const KEY = 'rivals.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  sensitivity: 1,
  volume: 0.55,
  fov: 80,
  effects: 'high',
  reducedMotion: false,
});

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export function normalizeSettings(value = {}) {
  return {
    sensitivity: clamp(value.sensitivity, 0.25, 2, DEFAULT_SETTINGS.sensitivity),
    volume: clamp(value.volume, 0, 1, DEFAULT_SETTINGS.volume),
    fov: clamp(value.fov, 65, 100, DEFAULT_SETTINGS.fov),
    effects: value.effects === 'low' ? 'low' : 'high',
    reducedMotion: Boolean(value.reducedMotion),
  };
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
