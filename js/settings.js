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
    // Re-render if on dashboard
    if (state.currentRoute === 'dashboard' || state.currentRoute === '') {
      import('./ui.js').then(mod => {
        mod.renderDashboard(document.getElementById('app'));
      });
    }
  }
}

export async function testApiKey(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with just the word OK' }] }]
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}
