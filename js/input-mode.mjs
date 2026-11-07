// Touch hardware alone does not tell us how a player is operating the browser.
export function prefersTouchControls(search, matches) {
  const touch = new URLSearchParams(search).get('touch');
  if (touch === '0') return false;
  if (touch === '1' || touch === '') return true;

  if (matches('(pointer: fine)') ||
      (matches('(any-pointer: fine)') && matches('(any-hover: hover)'))) return false;
  return matches('(pointer: coarse)') || matches('(any-pointer: coarse)');
}

export function browserPrefersTouchControls() {
  return prefersTouchControls(window.location.search,
    query => window.matchMedia?.(query)?.matches ?? false);
}
