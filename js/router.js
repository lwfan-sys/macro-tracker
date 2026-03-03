import { updateState } from './state.js';
import { renderDashboard, renderSettings } from './ui.js';

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  updateState({ currentRoute: hash });

  const app = document.getElementById('app');
  if (hash === 'settings') {
    renderSettings(app);
  } else {
    renderDashboard(app);
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    const route = btn.dataset.route;
    btn.classList.toggle('active', route === hash || (route === 'dashboard' && hash === ''));
  });
}
