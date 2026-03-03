import { saveSettings, loadSettings, saveGoals as persistGoals, exportAllData, clearAllData } from './storage.js';
import { updateState, state } from './state.js';
import { loadFoodsForDate } from './storage.js';

export function saveApiKey(key) {
  const settings = { ...state.settings, geminiApiKey: key.trim() };
  saveSettings(settings);
  updateState({ settings });
}

export function saveUserGoals(goals) {
  persistGoals(goals);
  updateState({ goals });
}

export function handleExport() {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `macro-tracker-export-${state.currentDate}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function handleClear() {
  if (confirm('Delete all tracked data? This cannot be undone.')) {
    clearAllData();
    updateState({ foods: [] });
    if (state.currentRoute === 'dashboard' || state.currentRoute === '') {
      import('./ui.js').then(mod => {
        mod.renderDashboard(document.getElementById('app'));
      });
    }
  }
}

export async function testApiKey(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) return { valid: true };
    if (res.status === 400 || res.status === 403) return { valid: false, reason: 'INVALID_KEY' };
    if (res.status === 429) return { valid: false, reason: 'RATE_LIMITED' };
    return { valid: false, reason: 'UNKNOWN', status: res.status };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { valid: false, reason: 'TIMEOUT' };
    }
    console.error('API key test error:', err);
    return { valid: false, reason: 'NETWORK_ERROR', error: err.message };
  }
}
