export const catalog = [
  { key: 'carbine', slot: 0, name: 'SCOUT CARBINE', short: 'CAR', price: 200, damage: 10, reloadTime: 1.05, description: 'Faster reload · lower damage per shot' },
  { key: 'sidearm', slot: 1, name: 'COMPACT PISTOL', short: 'CPT', price: 150, damage: 15, reloadTime: 0.75, description: 'Faster reload · lower damage per shot' },
];

const KEY = 'rivals.armory.v1';
export function bindArmory(player) {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const credits = Number.isSafeInteger(saved?.credits) ? Math.max(0, saved.credits) : 100;
  const owned = catalog.filter(item => Array.isArray(saved?.owned) && saved.owned.includes(item.key)).map(item => item.key);
  const state = { credits, owned, equipped: {} };
  for (const item of catalog) {
    if (owned.includes(item.key) && saved?.equipped?.[item.slot] === item.key) state.equipped[item.slot] = item.key;
  }
  const dialog = document.getElementById('armory-dialog');
  const list = document.getElementById('armory-list');
  const balance = document.getElementById('armory-balance');
  const status = document.getElementById('armory-status');
  const persist = () => {
    player.armory = { ...state.equipped };
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { status.textContent = 'Storage unavailable. Progress lasts until you close this page.'; }
  };
  const render = () => {
    balance.textContent = state.credits + ' CR';
    list.replaceChildren();
    for (const item of catalog) {
      const unlocked = state.owned.includes(item.key);
      const equipped = state.equipped[item.slot] === item.key;
      const row = document.createElement('li');
      const title = document.createElement('h3');
      title.textContent = item.name;
      const info = document.createElement('p');
      info.textContent = item.description;
      const button = document.createElement('button');
      button.className = 'btn-secondary';
      button.type = 'button';
      button.textContent = equipped ? 'USE DEFAULT' : unlocked ? 'EQUIP' : 'BUY · ' + item.price + ' CR';
      button.disabled = !unlocked && state.credits < item.price;
      button.addEventListener('click', () => {
        if (!unlocked) {
          if (state.credits < item.price || state.owned.includes(item.key)) return;
          state.credits -= item.price;
          state.owned.push(item.key);
        }
        if (equipped) delete state.equipped[item.slot];
        else state.equipped[item.slot] = item.key;
        status.textContent = equipped ? 'Default weapon selected.' : item.name + ' equipped for your next match.';
        persist();
        render();
        list.children[catalog.indexOf(item)].querySelector('button').focus();
      });
      if (equipped) title.append(' · EQUIPPED');
      row.append(title, info, button);
      list.append(row);
    }
  };
  document.getElementById('btn-open-armory').addEventListener('click', () => {
    render();
    dialog.showModal();
  });
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  persist();
  return () => {
    state.credits = Math.min(Number.MAX_SAFE_INTEGER, state.credits + 50);
    persist();
  };
}
