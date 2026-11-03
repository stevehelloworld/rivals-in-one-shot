/** Lobby state is independent from the match/network state. */
export function bindLobby(onStart) {
  let difficulty = 'easy';
  const tabs = [document.getElementById('tab-ai'), document.getElementById('tab-online')];
  const panels = [document.getElementById('ai-panel'), document.getElementById('online-panel')];
  const mode = index => {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
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
