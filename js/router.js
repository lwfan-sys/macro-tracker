import { updateState } from './state.js';
import { renderDashboard, renderSettings, renderPlaceholder } from './ui.js';

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
  } else if (hash === 'plan') {
    renderPlaceholder(app, 'Meal Plan', 'Plan your meals ahead of time. Coming soon!');
  } else if (hash === 'progress') {
    renderPlaceholder(app, 'Progress', 'Track your macro trends over time. Coming soon!');
  } else {
    renderDashboard(app);
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    const route = btn.dataset.route;
    btn.classList.toggle('active',
      route === hash ||
      (route === 'dashboard' && (hash === '' || hash === 'dashboard'))
    );
  });
}
