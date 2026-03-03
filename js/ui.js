import { state, updateState } from './state.js';
import { loadFoodsForDate, saveFoodsForDate } from './storage.js';
import { capturePhoto } from './camera.js';
import { analyzeFood } from './gemini.js';

// ============================================
// DASHBOARD RENDERING
// ============================================

export function renderDashboard(container) {
  const totals = calculateTotals();
  const dateLabel = getDateLabel(state.currentDate);
  const insight = generateInsightText(totals, state.goals);

  container.innerHTML = `
    <div class="header">
      <div class="header-top">
        <h1>Macro Tracker</h1>
      </div>
      <div class="date-picker">
        <button data-action="date-prev">&#8249;</button>
        <div class="date-text">${dateLabel}</div>
        <button data-action="date-next">&#8250;</button>
      </div>
    </div>

    <div class="container">
      <div class="ai-insights">
        <h3>🤖 AI Insights</h3>
        <p>${insight}</p>
      </div>

      <div class="macros-overview">
        <div class="calories-ring">
          <div class="ring-container">
            <div class="ring-bg"></div>
            <div class="ring-progress" id="calories-ring" style="--progress: ${getCalorieProgress(totals)}deg"></div>
            <div class="ring-inner">
              <div class="ring-value">${totals.calories}</div>
              <div class="ring-label">calories</div>
            </div>
          </div>
          <div class="calories-info">
            ${Math.max(state.goals.calories - totals.calories, 0)} remaining of ${state.goals.calories} goal
          </div>
        </div>

        <div class="macros-grid">
          ${renderMacroItem('Protein', 'protein', totals.protein, state.goals.protein)}
          ${renderMacroItem('Carbs', 'carbs', totals.carbs, state.goals.carbs)}
          ${renderMacroItem('Fat', 'fat', totals.fat, state.goals.fat)}
        </div>
      </div>

      <div class="timeline">
        ${renderMealSection('breakfast', '🌅 Breakfast', totals.breakfast)}
        ${renderMealSection('lunch', '☀️ Lunch', totals.lunch)}
        ${renderMealSection('dinner', '🌙 Dinner', totals.dinner)}
        ${renderMealSection('snacks', '🍎 Snacks', totals.snacks)}
      </div>
    </div>
  `;
}

function renderMacroItem(label, key, value, goal) {
  const percent = Math.min((value / goal) * 100, 100);
  return `
    <div class="macro-item">
      <div class="macro-label">${label}</div>
      <div class="macro-bar">
        <div class="macro-progress ${key}" style="width: ${percent}%"></div>
      </div>
      <div class="macro-value">${value}g</div>
      <div class="macro-goal">of ${goal}g</div>
    </div>
  `;
}

function renderMealSection(meal, title, mealCals) {
  const mealFoods = state.foods.filter(f => f.meal === meal);
  const foodsHtml = mealFoods.length > 0
    ? mealFoods.map(food => `
        <div class="food-item">
          <div class="food-info">
            <h4>${escapeHtml(food.name)}</h4>
            <div class="food-macros">
              ${food.calories} cal &bull; P: ${food.protein}g &bull; C: ${food.carbs}g &bull; F: ${food.fat}g
            </div>
          </div>
          <button class="delete-btn" data-action="delete-food" data-id="${food.id}">&times;</button>
        </div>
      `).join('')
    : '<div class="empty-state">No foods logged yet</div>';

  return `
    <div class="meal-section">
      <div class="meal-header">
        <div class="meal-title">${title}</div>
        <div class="meal-cals">${mealCals} cal</div>
      </div>
      ${foodsHtml}
      <button class="add-food-btn" data-action="add-food" data-meal="${meal}">
        <span>+</span> Add Food
      </button>
    </div>
  `;
}

// ============================================
// SETTINGS RENDERING
// ============================================

export function renderSettings(container) {
  const apiKey = state.settings.geminiApiKey || '';
  const g = state.goals;

  container.innerHTML = `
    <div class="settings-page">
      <div class="settings-header">
        <h1>Settings</h1>
      </div>
      <div class="settings-body">
        <div class="settings-section">
          <h3>🔑 Gemini API Key</h3>
          <div class="settings-row">
            <input type="password" id="api-key-input" value="${escapeHtml(apiKey)}" placeholder="Paste your API key here">
            <button class="btn-secondary" id="toggle-key-btn">Show</button>
          </div>
          <button class="btn-secondary" id="test-key-btn" style="width:100%; margin-bottom: 8px;">Test API Key</button>
          <div class="key-status" id="key-status"></div>
          <div class="settings-help">
            <strong>Get a free API key:</strong><br>
            1. Go to <a href="https://ai.google.dev" target="_blank" rel="noopener">ai.google.dev</a><br>
            2. Sign in with Google<br>
            3. Click "Get API key" &rarr; "Create API key"<br>
            4. Copy and paste it above<br>
            <br>Free tier: 15 requests/minute — plenty for personal use.
          </div>
        </div>

        <div class="settings-section">
          <h3>🎯 Daily Macro Goals</h3>
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
          <h3>📦 Data</h3>
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
    const { saveApiKey } = require('./settings.js');
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
      const ok = await mod.testApiKey(key);
      if (ok) {
        statusEl.textContent = '✓ API key is valid!';
        statusEl.className = 'key-status success';
        mod.saveApiKey(key);
      } else {
        statusEl.textContent = '✗ API key is invalid.';
        statusEl.className = 'key-status error';
      }
    } catch {
      statusEl.textContent = '✗ Could not verify key. Check your connection.';
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

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close button
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  // Method tab switching
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

  // Camera capture button
  document.getElementById('camera-capture-btn').addEventListener('click', handleCameraCapture);

  // Camera add food button
  document.getElementById('camera-add-btn').addEventListener('click', () => {
    addFoodFromForm('camera');
  });

  // Manual add food button
  document.getElementById('manual-add-btn').addEventListener('click', () => {
    addFoodFromForm('manual');
  });
}

export function openModal(meal) {
  const modal = document.getElementById('addFoodModal');
  updateState({ currentMeal: meal || 'breakfast', modalOpen: true });

  // Set meal selectors
  document.getElementById('food-meal').value = state.currentMeal;
  document.getElementById('camera-meal').value = state.currentMeal;

  // Reset camera view
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

    // Show preview
    const preview = document.getElementById('photo-preview');
    preview.src = dataUrl;
    preview.style.display = 'block';
    document.getElementById('camera-placeholder').style.display = 'none';

    // Check for API key
    if (!state.settings.geminiApiKey) {
      showCameraError('Set up your Gemini API key in Settings to enable AI food scanning.');
      document.getElementById('camera-capture-btn').textContent = '📸 Take Photo';
      return;
    }

    // Show loading
    document.getElementById('ai-loading').style.display = 'block';
    document.getElementById('camera-capture-btn').style.display = 'none';

    const result = await analyzeFood(base64, mimeType, state.settings.geminiApiKey);

    // Hide loading, show result
    document.getElementById('ai-loading').style.display = 'none';

    const resultCard = document.getElementById('ai-result');
    resultCard.style.display = 'block';
    document.getElementById('ai-result-name').textContent = result.name;
    document.getElementById('ai-confidence').textContent = result.confidence ? `(${result.confidence} confidence)` : '';
    document.getElementById('ai-result-portion').textContent = result.portion || '';

    // Fill in the camera form
    document.getElementById('camera-food-name').value = result.name;
    document.getElementById('camera-calories').value = result.calories;
    document.getElementById('camera-protein').value = result.protein;
    document.getElementById('camera-carbs').value = result.carbs;
    document.getElementById('camera-fat').value = result.fat;

    // Show confirm form
    document.getElementById('camera-confirm').style.display = 'block';

    updateState({ aiResult: result });
  } catch (err) {
    document.getElementById('ai-loading').style.display = 'none';
    document.getElementById('camera-capture-btn').style.display = '';
    document.getElementById('camera-capture-btn').textContent = '📸 Retry Photo';

    const message = getErrorMessage(err);
    showCameraError(message);
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
  if (msg === 'No file selected') return ''; // User cancelled, no error to show
  return 'Something went wrong. Try again or use manual entry.';
}

// ============================================
// ADD FOOD
// ============================================

function addFoodFromForm(source) {
  const prefix = source === 'camera' ? 'camera-' : 'food-';
  const mealId = source === 'camera' ? 'camera-meal' : 'food-meal';

  const name = document.getElementById(prefix + (source === 'camera' ? 'food-name' : 'name')).value.trim();
  const calories = parseInt(document.getElementById(prefix + 'calories').value) || 0;
  const protein = parseInt(document.getElementById(prefix + 'protein').value) || 0;
  const carbs = parseInt(document.getElementById(prefix + 'carbs').value) || 0;
  const fat = parseInt(document.getElementById(prefix + 'fat').value) || 0;
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

  // Re-render dashboard
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

function getCalorieProgress(totals) {
  return Math.min((totals.calories / state.goals.calories) * 360, 360);
}

function generateInsightText(totals, goals) {
  if (state.foods.length === 0) {
    return 'Start logging meals to get personalized insights about your nutrition.';
  }

  const insights = [];

  if (totals.calories < goals.calories * 0.7) {
    insights.push("You're under your calorie goal. Consider adding a protein-rich snack.");
  } else if (totals.calories > goals.calories * 1.2) {
    insights.push("You've exceeded your calorie goal. Fine occasionally, especially after intense workouts!");
  }

  if (totals.protein < goals.protein * 0.8) {
    insights.push('Protein is low today. Try lean meats, fish, or plant-based proteins.');
  }

  if (totals.protein > goals.protein && totals.carbs < goals.carbs * 0.7) {
    insights.push('Great protein! Consider adding complex carbs for sustained energy.');
  }

  if (insights.length === 0) {
    insights.push("You're hitting your targets well! Keep up the balanced approach.");
  }

  return insights[0];
}

// ============================================
// BOTTOM NAV
// ============================================

export function initBottomNav() {
  // Camera button opens modal and triggers capture
  document.getElementById('nav-camera-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openModal(state.currentMeal);
  });

  // Event delegation on #app for dashboard actions
  document.getElementById('app').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'add-food') openModal(btn.dataset.meal);
    if (action === 'delete-food') deleteFood(Number(btn.dataset.id));
    if (action === 'date-prev') changeDate(-1);
    if (action === 'date-next') changeDate(1);
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
