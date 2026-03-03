const DATE_PREFIX = 'macroTracker_foods_';
const SETTINGS_KEY = 'macroTracker_settings';
const GOALS_KEY = 'macroTracker_goals';

export function loadFoodsForDate(dateStr) {
  const raw = localStorage.getItem(DATE_PREFIX + dateStr);
  return raw ? JSON.parse(raw) : [];
}

export function saveFoodsForDate(dateStr, foods) {
  localStorage.setItem(DATE_PREFIX + dateStr, JSON.stringify(foods));
}

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : { geminiApiKey: '' };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadGoals() {
  const raw = localStorage.getItem(GOALS_KEY);
  return raw ? JSON.parse(raw) : { calories: 2000, protein: 150, carbs: 250, fat: 65 };
}

export function saveGoals(goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function exportAllData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('macroTracker_')) {
      data[key] = JSON.parse(localStorage.getItem(key));
    }
  }
  return data;
}

export function clearAllData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('macroTracker_')) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
}
