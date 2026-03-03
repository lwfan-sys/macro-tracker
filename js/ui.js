import { state, updateState } from './state.js';
import { loadFoodsForDate, saveFoodsForDate, hasDataForDate } from './storage.js';
import { capturePhoto } from './camera.js';
import { analyzeFood } from './gemini.js';

// ============================================
// DASHBOARD RENDERING
// ============================================

export function renderDashboard(container) {
  const totals = calculateTotals();
  const dateLabel = getDateLabel(state.currentDate);
  const remaining = Math.max(state.goals.calories - totals.calories, 0);
  const calPercent = Math.min((totals.calories / state.goals.calories) * 100, 100);
  const isOver = totals.calories > state.goals.calories;
  const weekDays = getWeekDays(state.currentDate);

  container.innerHTML = `
    <div class="header">
      <div class="header-top">
        <h1>Today</h1>
        <div class="date-picker">
          <button data-action="date-prev" aria-label="Previous day">&#8249;</button>
          <div class="date-text">${dateLabel}</div>
          <button data-action="date-next" aria-label="Next day">&#8250;</button>
        </div>
      </div>
    </div>

    <div class="week-strip">
      ${weekDays.map(day => {
        const hasData = hasDataForDate(day.dateStr);
        const classes = [
          'week-day-dot',
          day.isCurrent ? 'today' : '',
          hasData && !day.isCurrent ? 'has-data' : ''
        ].filter(Boolean).join(' ');
        const dayNum = parseInt(day.dateStr.split('-')[2]);
        return `
          <div class="week-day" data-action="go-to-date" data-date="${day.dateStr}">
            <span class="week-day-label">${day.label}</span>
            <span class="${classes}">${day.isCurrent ? dayNum : (hasData ? '\u2713' : dayNum)}</span>
          </div>`;
      }).join('')}
    </div>

    <div class="container">
      <div class="calorie-summary">
        <div class="calorie-header">
          <span class="calorie-title">Calories</span>
          <span class="calorie-remaining">${isOver ? 'Over by ' + (totals.calories - state.goals.calories) : remaining + ' left'}</span>
        </div>
        <div class="calorie-numbers">
          <span class="calorie-current">${totals.calories}</span>
          <span class="calorie-goal-text">/ ${state.goals.calories} cal</span>
        </div>
        <div class="calorie-bar">
          <div class="calorie-bar-fill${isOver ? ' over' : ''}" style="width: ${calPercent}%"></div>
        </div>
      </div>

      <div class="macros-card">
        <div class="macros-card-title">Macros</div>
        ${renderMacroRow('Carbs', 'carbs', totals.carbs, state.goals.carbs)}
        ${renderMacroRow('Fat', 'fat', totals.fat, state.goals.fat)}
        ${renderMacroRow('Protein', 'protein', totals.protein, state.goals.protein)}
      </div>

      ${renderMealCard('breakfast', 'Breakfast')}
      ${renderMealCard('lunch', 'Lunch')}
      ${renderMealCard('dinner', 'Dinner')}
      ${renderMealCard('snacks', 'Snacks')}
    </div>
  `;
}

function renderMacroRow(label, key, value, goal) {
  const percent = Math.min((value / goal) * 100, 100);
  return `
    <div class="macro-row">
      <span class="macro-row-label">${label}</span>
      <div class="macro-row-bar">
        <div class="macro-row-fill ${key}" style="width: ${percent}%"></div>
      </div>
      <span class="macro-row-value"><strong>${value}g</strong> / ${goal}g</span>
    </div>
  `;
}

function renderMealCard(meal, title) {
  const mealFoods = state.foods.filter(f => f.meal === meal);
  const mealCals = mealFoods.reduce((sum, f) => sum + f.calories, 0);

  const foodsHtml = mealFoods.length > 0
    ? mealFoods.map(food => `
        <div class="food-item">
          <div class="food-info">
            <h4>${escapeHtml(food.name)}</h4>
            <div class="food-macros">P: ${food.protein}g &middot; C: ${food.carbs}g &middot; F: ${food.fat}g</div>
          </div>
          <div class="food-item-right">
            <span class="food-cals">${food.calories}</span>
            <button class="delete-btn" data-action="delete-food" data-id="${food.id}">&times;</button>
          </div>
        </div>
      `).join('')
    : '<div class="empty-meal">No foods logged</div>';

  return `
    <div class="meal-card">
      <div class="meal-card-header">
        <span class="meal-card-title">${title}</span>
        <span class="meal-card-cals">${mealCals} cal</span>
      </div>
      <div class="meal-card-body">
        ${foodsHtml}
      </div>
      <button class="meal-log-btn" data-action="add-food" data-meal="${meal}">+ Log Food</button>
    </div>
  `;
}

function getWeekDays(currentDateStr) {
  const current = new Date(currentDateStr + 'T12:00:00');
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = current.getDay();
  const startOfWeek = new Date(current);
  startOfWeek.setDate(current.getDate() - dayOfWeek);

  const days = [];
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      label: labels[i],
      dateStr,
      isToday: dateStr === today,
      isCurrent: dateStr === currentDateStr,
    });
  }
  return days;
}

// ============================================
// SETTINGS RENDERING
// ============================================

export function renderSettings(container) {
  const apiKey = state.settings.geminiApiKey || '';
  const g = state.goals;

  container.innerHTML = `
    <div class="settings-page">
      <div class="header">
        <div class="header-top">
          <h1>Settings</h1>
        </div>
      </div>
      <div class="settings-body">
        <div class="settings-section">
          <h3>Gemini API Key</h3>
          <div class="settings-row">
            <input type="password" id="api-key-input" value="${escapeHtml(apiKey)}" placeholder="Paste your API key here">
            <button class="btn-secondary" id="toggle-key-btn">Show</button>
          </div>
          <button class="btn-secondary" id="test-key-btn" style="width:100%; margin-bottom: 8px;">Test API Key</button>
          <div class="key-status" id="key-status"></div>
          <div class="settings-help">
            <strong>Get a free API key:</strong><br>
            1. Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a><br>
            2. Sign in with Google<br>
            3. Click "Create API key"<br>
            4. Copy and paste it above<br>
            <br>Free tier: 15 requests/minute.
          </div>
        </div>

        <div class="settings-section">
          <h3>Daily Macro Goals</h3>
          <div class="goals-grid">
            <div class="goal-input">
              <label>Calories</label>
              <input type="number" id="goal-calories" value="${g.calories}">
            </div>
            <div class="goal-input">
              <label>Protein (g)</label>
              <input type="number" id="goal-protein" value="${g.protein}">
            </div>
            <div class="goal-input">
              <label>Carbs (g)</label>
              <input type="number" id="goal-carbs" value="${g.carbs}">
            </div>
            <div class="goal-input">
              <label>Fat (g)</label>
              <input type="number" id="goal-fat" value="${g.fat}">
            </div>
          </div>
          <button class="btn-primary" id="save-goals-btn">Save Goals</button>
        </div>

        <div class="settings-section">
          <h3>Data</h3>
          <div class="data-actions">
            <button class="btn-secondary" id="export-btn">Export Data</button>
            <button class="btn-danger" id="clear-btn">Clear All Data</button>
          </div>
        </div>
      </div>
    </div>
  `;

  attachSettingsListeners();
}

export function renderPlaceholder(container, title, message) {
  container.innerHTML = `
    <div class="header">
      <div class="header-top">
        <h1>${escapeHtml(title)}</h1>
      </div>
    </div>
    <div class="container">
      <div class="calorie-summary" style="text-align: center; padding: 40px 20px;">
        <p style="font-size: 16px; color: var(--text-secondary);">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

function attachSettingsListeners() {
  const toggleBtn = document.getElementById('toggle-key-btn');
  const apiInput = document.getElementById('api-key-input');

  toggleBtn?.addEventListener('click', () => {
    const isPassword = apiInput.type === 'password';
    apiInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  });

  // Auto-save API key on blur
  apiInput?.addEventListener('blur', () => {
    const key = apiInput.value.trim();
    if (key) {
      import('./settings.js').then(mod => mod.saveApiKey(key));
    }
  });

  // Save API key on change
  apiInput?.addEventListener('change', () => {
    import('./settings.js').then(mod => {
      mod.saveApiKey(apiInput.value);
    });
  });

  document.getElementById('test-key-btn')?.addEventListener('click', async () => {
    const key = apiInput.value.trim();
    const statusEl = document.getElementById('key-status');
    if (!key) {
      statusEl.textContent = 'Please enter an API key first.';
      statusEl.className = 'key-status error';
      return;
    }
    statusEl.textContent = 'Testing...';
    statusEl.className = 'key-status';
    try {
      const mod = await import('./settings.js');
      const result = await mod.testApiKey(key);
      if (result.valid) {
        statusEl.textContent = '\u2713 API key is valid!';
        statusEl.className = 'key-status success';
        mod.saveApiKey(key);
      } else {
        const messages = {
          INVALID_KEY: '\u2717 API key is invalid. Please check and try again.',
          RATE_LIMITED: '\u2717 Rate limited. Wait a moment and try again.',
          TIMEOUT: '\u2717 Request timed out. Check your internet connection.',
          NETWORK_ERROR: '\u2717 Network error. Check your connection.',
        };
        statusEl.textContent = messages[result.reason] || '\u2717 Could not verify key.';
        statusEl.className = 'key-status error';
      }
    } catch (err) {
      console.error('Test key error:', err);
      statusEl.textContent = '\u2717 Unexpected error. Check browser console.';
      statusEl.className = 'key-status error';
    }
  });

  document.getElementById('save-goals-btn')?.addEventListener('click', async () => {
    const goals = {
      calories: parseInt(document.getElementById('goal-calories').value) || 2000,
      protein: parseInt(document.getElementById('goal-protein').value) || 150,
      carbs: parseInt(document.getElementById('goal-carbs').value) || 250,
      fat: parseInt(document.getElementById('goal-fat').value) || 65,
    };
    const mod = await import('./settings.js');
    mod.saveUserGoals(goals);
    const btn = document.getElementById('save-goals-btn');
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save Goals'; }, 1500);
  });

  document.getElementById('export-btn')?.addEventListener('click', async () => {
    const mod = await import('./settings.js');
    mod.handleExport();
  });

  document.getElementById('clear-btn')?.addEventListener('click', async () => {
    const mod = await import('./settings.js');
    mod.handleClear();
  });
}

// ============================================
// MODAL MANAGEMENT
// ============================================

export function initModal() {
  const modal = document.getElementById('addFoodModal');

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  document.querySelectorAll('.method-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const method = tab.dataset.method;
      document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.input-view').forEach(v => v.style.display = 'none');
      document.getElementById(method + '-view').style.display = 'block';
      updateState({ modalTab: method });
    });
  });

  document.getElementById('camera-capture-btn').addEventListener('click', handleCameraCapture);

  document.getElementById('camera-add-btn').addEventListener('click', () => {
    addFoodFromForm('camera');
  });

  document.getElementById('manual-add-btn').addEventListener('click', () => {
    addFoodFromForm('manual');
  });
}

export function openModal(meal) {
  const modal = document.getElementById('addFoodModal');
  updateState({ currentMeal: meal || 'breakfast', modalOpen: true });

  document.getElementById('food-meal').value = state.currentMeal;
  document.getElementById('camera-meal').value = state.currentMeal;

  resetCameraView();
  modal.classList.add('active');
}

export function closeModal() {
  const modal = document.getElementById('addFoodModal');
  modal.classList.remove('active');
  updateState({ modalOpen: false, aiResult: null, aiLoading: false });
  clearForms();
}

function resetCameraView() {
  document.getElementById('camera-placeholder').style.display = '';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('ai-loading').style.display = 'none';
  document.getElementById('ai-result').style.display = 'none';
  document.getElementById('ai-error').style.display = 'none';
  document.getElementById('camera-capture-btn').style.display = '';
  document.getElementById('camera-confirm').style.display = 'none';
}

function clearForms() {
  ['food-name', 'food-calories', 'food-protein', 'food-carbs', 'food-fat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['camera-food-name', 'camera-calories', 'camera-protein', 'camera-carbs', 'camera-fat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ============================================
// CAMERA + AI FLOW
// ============================================

async function handleCameraCapture() {
  try {
    const { base64, mimeType, dataUrl } = await capturePhoto();

    const preview = document.getElementById('photo-preview');
    preview.src = dataUrl;
    preview.style.display = 'block';
    document.getElementById('camera-placeholder').style.display = 'none';

    if (!state.settings.geminiApiKey) {
      showCameraError('Set up your Gemini API key in Settings to enable AI food scanning.');
      document.getElementById('camera-capture-btn').textContent = 'Take Photo';
      return;
    }

    document.getElementById('ai-loading').style.display = 'block';
    document.getElementById('camera-capture-btn').style.display = 'none';

    const result = await analyzeFood(base64, mimeType, state.settings.geminiApiKey);

    document.getElementById('ai-loading').style.display = 'none';

    const resultCard = document.getElementById('ai-result');
    resultCard.style.display = 'block';
    document.getElementById('ai-result-name').textContent = result.name;
    document.getElementById('ai-confidence').textContent = result.confidence ? `(${result.confidence} confidence)` : '';
    document.getElementById('ai-result-portion').textContent = result.portion || '';

    document.getElementById('camera-food-name').value = result.name;
    document.getElementById('camera-calories').value = result.calories;
    document.getElementById('camera-protein').value = result.protein;
    document.getElementById('camera-carbs').value = result.carbs;
    document.getElementById('camera-fat').value = result.fat;

    document.getElementById('camera-confirm').style.display = 'block';

    updateState({ aiResult: result });
  } catch (err) {
    document.getElementById('ai-loading').style.display = 'none';
    document.getElementById('camera-capture-btn').style.display = '';
    document.getElementById('camera-capture-btn').textContent = 'Retry Photo';

    const message = getErrorMessage(err);
    if (message) showCameraError(message);
  }
}

function showCameraError(message) {
  const errorEl = document.getElementById('ai-error');
  errorEl.style.display = 'block';
  document.getElementById('ai-error-text').textContent = message;
}

function getErrorMessage(err) {
  const msg = err.message || '';
  if (msg === 'NO_API_KEY') return 'Set up your Gemini API key in Settings to enable AI food scanning.';
  if (msg === 'INVALID_API_KEY') return 'Your API key appears to be invalid. Check Settings.';
  if (msg === 'RATE_LIMITED') return 'Too many requests. Wait a moment and try again.';
  if (msg === 'PARSE_ERROR' || msg === 'EMPTY_RESPONSE' || msg === 'INVALID_FORMAT') return 'Could not identify this food. Try again or enter manually.';
  if (msg === 'No file selected') return '';
  return 'Something went wrong. Try again or use manual entry.';
}

// ============================================
// ADD FOOD
// ============================================

function addFoodFromForm(source) {
  const prefix = source === 'camera' ? 'camera-' : 'food-';
  const mealId = source === 'camera' ? 'camera-meal' : 'food-meal';

  const name = document.getElementById(prefix + (source === 'camera' ? 'food-name' : 'name')).value.trim();
  const calories = Math.max(0, parseInt(document.getElementById(prefix + 'calories').value) || 0);
  const protein = Math.max(0, parseInt(document.getElementById(prefix + 'protein').value) || 0);
  const carbs = Math.max(0, parseInt(document.getElementById(prefix + 'carbs').value) || 0);
  const fat = Math.max(0, parseInt(document.getElementById(prefix + 'fat').value) || 0);
  const meal = document.getElementById(mealId).value;

  if (!name) {
    alert('Please enter a food name');
    return;
  }

  const food = {
    id: Date.now(),
    name,
    calories,
    protein,
    carbs,
    fat,
    meal,
    timestamp: new Date().toISOString()
  };

  const foods = [...state.foods, food];
  saveFoodsForDate(state.currentDate, foods);
  updateState({ foods });

  closeModal();

  if (state.currentRoute === 'dashboard' || state.currentRoute === '') {
    renderDashboard(document.getElementById('app'));
  }
}

function deleteFood(id) {
  const foods = state.foods.filter(f => f.id !== id);
  saveFoodsForDate(state.currentDate, foods);
  updateState({ foods });

  if (state.currentRoute === 'dashboard' || state.currentRoute === '') {
    renderDashboard(document.getElementById('app'));
  }
}

// ============================================
// DATE NAVIGATION
// ============================================

export function changeDate(offset) {
  const d = new Date(state.currentDate + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  const newDate = d.toISOString().split('T')[0];
  const foods = loadFoodsForDate(newDate);
  updateState({ currentDate: newDate, foods });

  if (state.currentRoute === 'dashboard' || state.currentRoute === '') {
    renderDashboard(document.getElementById('app'));
  }
}

export function goToDate(dateStr) {
  const foods = loadFoodsForDate(dateStr);
  updateState({ currentDate: dateStr, foods });
  if (state.currentRoute === 'dashboard' || state.currentRoute === '') {
    renderDashboard(document.getElementById('app'));
  }
}

function getDateLabel(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  if (dateStr === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ============================================
// CALCULATIONS
// ============================================

function calculateTotals() {
  return state.foods.reduce((acc, food) => {
    acc.calories += food.calories;
    acc.protein += food.protein;
    acc.carbs += food.carbs;
    acc.fat += food.fat;
    acc[food.meal] = (acc[food.meal] || 0) + food.calories;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, breakfast: 0, lunch: 0, dinner: 0, snacks: 0 });
}

// ============================================
// BOTTOM NAV
// ============================================

export function initBottomNav() {
  document.getElementById('nav-camera-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openModal(state.currentMeal);
  });

  document.getElementById('app').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'add-food') openModal(btn.dataset.meal);
    if (action === 'delete-food') deleteFood(Number(btn.dataset.id));
    if (action === 'date-prev') changeDate(-1);
    if (action === 'date-next') changeDate(1);
    if (action === 'go-to-date') goToDate(btn.dataset.date);
  });
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
