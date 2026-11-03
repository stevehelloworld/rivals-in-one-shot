import { maps, getMap } from './maps/index.mjs';

/** Lobby state is independent from the match/network state. */
export function bindLobby(onStart) {
  let difficulty = 'easy';
  const tabs = [document.getElementById('tab-ai'), document.getElementById('tab-online')];
  const panels = [document.getElementById('ai-panel'), document.getElementById('online-panel')];
  const picker = document.getElementById('ai-map');
  const preview = document.querySelector('.arena-preview');
  const previewName = preview.querySelector('.arena-preview-name');
  const image = preview.querySelector('img');
  picker.replaceChildren(...maps.map(map => new Option(map.name, map.id)), new Option('Random', 'random'));
  const updatePreview = () => {
    const map = tabs[1].getAttribute('aria-selected') === 'true' ? 'sunset' : picker.value;
    preview.dataset.map = map;
    const selected = getMap(map);
    image.src = 'assets/images/' + selected.preview;
    image.alt = selected.name + ' in-game preview';
    previewName.textContent = map === 'random' ? `Random · ${maps.length} arenas · chosen at match start` : selected.name;
  };
  picker.addEventListener('change', updatePreview);
  updatePreview();
  const mode = index => {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    updatePreview();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => mode(index));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
      mode(next); tabs[next].focus();
    });
  });
  document.getElementById('btn-online-shortcut').addEventListener('click', () => {
    mode(1); tabs[1].focus();
  });
  for (const diff of ['easy', 'hard']) {
    document.getElementById(`btn-play-${diff}`).addEventListener('click', () => {
      difficulty = diff;
      for (const value of ['easy', 'hard']) {
        document.getElementById(`btn-play-${value}`).setAttribute('aria-pressed', String(value === diff));
      }
      document.querySelector('#btn-start-ai span').textContent = `PLAY ${diff.toUpperCase()}`;
    });
  }
  document.getElementById('btn-start-ai').addEventListener('click', () => onStart(difficulty));
  const settings = document.getElementById('settings-dialog');
  const controls = document.getElementById('controls-dialog');
  document.getElementById('btn-open-settings').addEventListener('click', () => settings.showModal());
  document.getElementById('btn-open-controls').addEventListener('click', () => controls.showModal());
  for (const dialog of [settings, controls]) {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  }
}
