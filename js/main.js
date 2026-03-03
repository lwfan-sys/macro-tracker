import { state, updateState } from './state.js';
import { loadFoodsForDate, loadSettings, loadGoals, saveFoodsForDate } from './storage.js';
import { initRouter } from './router.js';
import { initCamera } from './camera.js';
import { initBottomNav, initModal } from './ui.js';

function init() {
  const settings = loadSettings();
  const goals = loadGoals();
  const today = new Date().toISOString().split('T')[0];

  migrateLegacyData(today);

  const foods = loadFoodsForDate(today);

  updateState({ settings, goals, currentDate: today, foods });

  initCamera();
  initBottomNav();
  initModal();
  initRouter();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function migrateLegacyData(today) {
  const legacy = localStorage.getItem('nutritionData');
  if (legacy) {
    const foods = JSON.parse(legacy);
    if (foods.length > 0) {
      const existing = loadFoodsForDate(today);
      if (existing.length === 0) {
        saveFoodsForDate(today, foods);
      }
    }
    localStorage.removeItem('nutritionData');
  }
}

document.addEventListener('DOMContentLoaded', init);
