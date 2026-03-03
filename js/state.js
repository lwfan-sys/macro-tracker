const state = {
  currentDate: new Date().toISOString().split('T')[0],
  foods: [],
  goals: { calories: 2000, protein: 150, carbs: 250, fat: 65 },
  settings: { geminiApiKey: '' },
  currentRoute: 'dashboard',
  currentMeal: 'breakfast',
  modalOpen: false,
  modalTab: 'camera',
  aiResult: null,
  aiLoading: false,
};

const listeners = {};

export function on(event, fn) {
  (listeners[event] ||= []).push(fn);
}

export function emit(event, data) {
  (listeners[event] || []).forEach(fn => fn(data));
}

export function updateState(patch) {
  Object.assign(state, patch);
  emit('stateChanged', state);
}

export { state };
