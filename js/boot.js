// Keep this independent of the game module graph so load failures stay visible.
(() => {
  const status = document.getElementById('boot-status');
  const title = document.getElementById('boot-title');
  const message = document.getElementById('boot-message');
  const retry = document.getElementById('boot-retry');
  const fail = () => {
    status.classList.remove('hidden');
    title.textContent = 'COULD NOT START';
    message.textContent = 'The game could not load. Check your connection and try again. If it keeps failing, try a browser with WebGL support.';
    retry.hidden = false;
  };
  retry.addEventListener('click', () => location.reload());
  const timeout = setTimeout(fail, 20000);
  import('./main.js').then(() => {
    clearTimeout(timeout);
    status.classList.add('hidden');
  }).catch((error) => {
    clearTimeout(timeout);
    console.error('Game startup failed:', error);
    fail();
  });
})();
