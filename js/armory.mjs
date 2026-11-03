export const catalog = [
  { key: 'smg', slot: 0, name: 'VECTOR SMG', short: 'SMG', price: 200, stats: { id: 'smg', damage: 8, headMult: 1.25, fireRate: 0.065, magSize: 32, reloadTime: 1.35, spread: 0.028, range: 65, recoil: 0.008 }, description: 'Primary · close range · rapid fire · 32 rounds' },
  { key: 'shotgun', slot: 0, name: 'BREACH SHOTGUN', short: 'SG', price: 250, stats: { id: 'shotgun', damage: 10, headMult: 1.2, fireRate: 0.85, magSize: 6, reloadTime: 2.4, auto: false, spread: 0.14, range: 28, recoil: 0.05, pellets: 6 }, description: 'Primary · 6 pellets per shot · strongest up close' },
  { key: 'marksman', slot: 0, name: 'SENTINEL DMR', short: 'DMR', price: 300, stats: { id: 'marksman', damage: 32, headMult: 1.5, fireRate: 0.38, magSize: 10, reloadTime: 1.9, auto: false, spread: 0.003, range: 150, recoil: 0.028 }, description: 'Primary · semi-auto precision · 10 rounds' },
  { key: 'sniper', slot: 0, name: 'LONGSHOT SNIPER', short: 'SNP', price: 400, stats: { id: 'sniper', damage: 65, headMult: 1.6, fireRate: 1.35, magSize: 5, reloadTime: 2.8, auto: false, spread: 0.001, range: 180, recoil: 0.065 }, description: 'Primary · high damage · slow follow-up · 5 rounds' },
  { key: 'lmg', slot: 0, name: 'BASTION LMG', short: 'LMG', price: 350, stats: { id: 'lmg', damage: 11, headMult: 1.25, fireRate: 0.12, magSize: 60, reloadTime: 3.4, spread: 0.024, range: 100, recoil: 0.017 }, description: 'Primary · sustained fire · 60 rounds · slow reload' },
  { key: 'revolver', slot: 1, name: 'IRON SIX REVOLVER', short: 'REV', price: 250, stats: { id: 'revolver', damage: 38, headMult: 1.5, fireRate: 0.48, magSize: 6, reloadTime: 2.1, spread: 0.009, range: 100, recoil: 0.045 }, description: 'Secondary · heavy six-shooter · deliberate shots' },
  { key: 'carbine', slot: 0, name: 'SCOUT CARBINE', short: 'CAR', price: 200, damage: 10, reloadTime: 1.05, description: 'Faster reload · lower damage per shot' },
  { key: 'sidearm', slot: 1, name: 'COMPACT PISTOL', short: 'CPT', price: 150, damage: 15, reloadTime: 0.75, description: 'Faster reload · lower damage per shot' },
  { key: 'cobalt', slot: 'skin', name: 'COBALT STRIPE', price: 100, color: 0x518aff, description: 'Rifle and pistol finish · cosmetic only' },
  { key: 'coral', slot: 'skin', name: 'CORAL STRIPE', price: 100, color: 0xff806d, description: 'Rifle and pistol finish · cosmetic only' },
];

export const defaultItems = [
  { key: 'ar', slot: 0, name: 'ASSAULT RIFLE', description: 'Primary · balanced automatic rifle · 20 rounds' },
  { key: 'handgun', slot: 1, name: 'HANDGUN', description: 'Secondary · semi-automatic pistol · 12 rounds' },
  { key: 'fists', slot: 2, name: 'FISTS', description: 'Melee · close combat · enables double jump' },
  { key: 'grenade', slot: 3, name: 'GRENADE', description: 'Utility · bouncing explosive · recharges over time' },
  { key: 'rpg', slot: 4, name: 'RPG', description: 'Launcher · explosive rocket · single-shot reload' },
].map(item => ({ ...item, isDefault: true, price: 0 }));

export const armoryItems = [...catalog.filter(item => item.slot !== 'skin'), ...defaultItems, ...catalog.filter(item => item.slot === 'skin')]
  .map(item => ({ ...item, image: `assets/images/weapons/${item.key}.png` }));

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
    for (const item of armoryItems) {
      const unlocked = item.isDefault || state.owned.includes(item.key);
      const equipped = item.isDefault ? !state.equipped[item.slot] : state.equipped[item.slot] === item.key;
      const row = document.createElement('li');
      row.dataset.weapon = item.key;
      row.classList.toggle('equipped', equipped);
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = item.name + ' in-game model';
      image.width = 512;
      image.height = 256;
      image.decoding = 'async';
      const detail = document.createElement('div');
      detail.className = 'armory-detail';
      const title = document.createElement('h3');
      title.textContent = item.name;
      const info = document.createElement('p');
      info.textContent = item.description;
      const button = document.createElement('button');
      button.className = 'btn-secondary';
      button.type = 'button';
      button.textContent = equipped ? (item.isDefault ? 'EQUIPPED' : 'USE DEFAULT') : unlocked ? 'EQUIP' : 'BUY · ' + item.price + ' CR';
      button.setAttribute('aria-label', button.textContent + ' · ' + item.name);
      button.disabled = (item.isDefault && equipped) || (!unlocked && state.credits < item.price);
      button.addEventListener('click', () => {
        if (!unlocked) {
          if (state.credits < item.price || state.owned.includes(item.key)) return;
          state.credits -= item.price;
          state.owned.push(item.key);
        }
        if (equipped || item.isDefault) delete state.equipped[item.slot];
        else state.equipped[item.slot] = item.key;
        status.textContent = equipped ? 'Default weapon selected.' : item.name + ' equipped for your next match.';
        persist();
        render();
        list.children[armoryItems.indexOf(item)].querySelector('button').focus();
      });
      if (equipped) title.append(' · EQUIPPED');
      detail.append(title, info, button);
      row.append(image, detail);
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
