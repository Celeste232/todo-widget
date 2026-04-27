const API_BASE = 'https://wony-todo-api.vivwonvc.workers.dev';
const CACHE_KEY = 'wony_todo_widget_cache_v2';
const SYNC_INTERVAL_MS = 15000;

const state = {
  tasks: [],
  filter: 'all',
  loading: false,
  pendingDateFor: null,
};

const els = {
  form: document.getElementById('addForm'),
  input: document.getElementById('taskInput'),
  list: document.getElementById('taskList'),
  empty: document.getElementById('emptyState'),
  clearBtn: document.getElementById('clearAllBtn'),
  tabs: document.querySelectorAll('.tab'),
  toggleBtn: document.getElementById('toggleAddBtn'),
};

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) state.tasks = JSON.parse(raw);
  } catch (e) {}
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.tasks));
  } catch (e) {}
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchTasks() {
  try {
    const { tasks } = await api('/tasks');
    state.tasks = tasks;
    saveCache();
    render();
  } catch (e) {
    console.warn('fetchTasks failed:', e.message);
  }
}

async function addTask(text, date = null) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const optimistic = {
    id: 'temp_' + Date.now(),
    text: trimmed, done: false, starred: false, date,
    createdAt: Date.now(),
    pending: true,
  };
  state.tasks.unshift(optimistic);
  render();
  try {
    const { task } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ text: trimmed, date }),
    });
    const idx = state.tasks.findIndex(x => x.id === optimistic.id);
    if (idx !== -1) state.tasks[idx] = task;
    saveCache();
    render();
  } catch (e) {
    const idx = state.tasks.findIndex(x => x.id === optimistic.id);
    if (idx !== -1) state.tasks.splice(idx, 1);
    render();
    alert('할 일 추가 실패: ' + e.message);
  }
}

async function patchTask(id, patch) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const before = { ...t };
  Object.assign(t, patch);
  render();
  try {
    const { task } = await api(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    const idx = state.tasks.findIndex(x => x.id === id);
    if (idx !== -1) state.tasks[idx] = task;
    saveCache();
    render();
  } catch (e) {
    const idx = state.tasks.findIndex(x => x.id === id);
    if (idx !== -1) state.tasks[idx] = before;
    render();
    alert('변경 실패: ' + e.message);
  }
}

function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  patchTask(id, { done: !t.done });
}

function toggleStar(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  patchTask(id, { starred: !t.starred });
}

function setTaskDate(id, date) {
  patchTask(id, { date });
}

async function deleteTask(id) {
  const idx = state.tasks.findIndex(x => x.id === id);
  if (idx === -1) return;
  const removed = state.tasks.splice(idx, 1)[0];
  render();
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    saveCache();
  } catch (e) {
    state.tasks.splice(idx, 0, removed);
    render();
    alert('삭제 실패: ' + e.message);
  }
}

async function clearAll() {
  let targets;
  let msg;
  if (state.filter === 'completed') {
    targets = state.tasks.filter(t => t.done);
    msg = `완료된 ${targets.length}개를 삭제할까?`;
  } else if (state.filter === 'pending') {
    targets = state.tasks.filter(t => !t.done);
    msg = `진행 중 ${targets.length}개를 삭제할까?`;
  } else {
    targets = state.tasks.slice();
    msg = `모든 할 일 ${targets.length}개를 삭제할까?`;
  }
  if (targets.length === 0) return;
  if (!confirm(msg)) return;

  await Promise.allSettled(targets.map(t =>
    api(`/tasks/${t.id}`, { method: 'DELETE' })
  ));
  await fetchTasks();
}

function setFilter(filter) {
  state.filter = filter;
  els.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  render();
}

function getVisible() {
  let list;
  if (state.filter === 'pending') list = state.tasks.filter(t => !t.done);
  else if (state.filter === 'completed') list = state.tasks.filter(t => t.done);
  else list = state.tasks.slice();

  list.sort((a, b) => {
    if (a.starred !== b.starred) return b.starred - a.starred;
    return b.createdAt - a.createdAt;
  });
  return list;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}

function render() {
  const visible = getVisible();
  els.list.innerHTML = '';

  if (visible.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent =
      state.filter === 'completed' ? '완료한 항목이 없어'
      : state.filter === 'pending' ? '진행 중인 항목이 없어'
      : '아직 할 일이 없어 ☕️';
    return;
  }
  els.empty.hidden = true;

  for (const t of visible) {
    const li = document.createElement('li');
    li.className = 'task-item' + (t.done ? ' done' : '') + (t.pending ? ' pending' : '');
    li.dataset.id = t.id;

    const checkbox = document.createElement('button');
    checkbox.className = 'checkbox' + (t.done ? ' checked' : '');
    checkbox.setAttribute('aria-label', t.done ? '완료 취소' : '완료 표시');
    checkbox.addEventListener('click', () => toggleTask(t.id));

    const textWrap = document.createElement('div');
    textWrap.className = 'task-text-wrap';

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = t.text;
    text.addEventListener('click', () => toggleTask(t.id));
    textWrap.appendChild(text);

    if (t.date) {
      const badge = document.createElement('span');
      badge.className = 'date-badge';
      badge.textContent = formatDate(t.date);
      textWrap.appendChild(badge);
    }

    const dateBtn = document.createElement('button');
    dateBtn.className = 'date-btn' + (t.date ? ' has-date' : '');
    dateBtn.setAttribute('aria-label', t.date ? '마감일 변경' : '마감일 추가');
    dateBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'date-input';
    dateInput.value = t.date || '';
    dateInput.addEventListener('change', (e) => {
      setTaskDate(t.id, e.target.value || null);
    });
    dateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
        else dateInput.click();
      } catch {
        dateInput.click();
      }
    });
    if (t.date) {
      dateBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm('마감일을 지울까?')) setTaskDate(t.id, null);
      });
    }

    const star = document.createElement('button');
    star.className = 'star-btn' + (t.starred ? ' active' : '');
    star.setAttribute('aria-label', t.starred ? '중요 해제' : '중요 표시');
    star.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStar(t.id);
    });

    const menu = document.createElement('button');
    menu.className = 'task-menu';
    menu.innerHTML = '&#x2715;';
    menu.setAttribute('aria-label', '삭제');
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(t.id);
    });

    li.appendChild(checkbox);
    li.appendChild(textWrap);
    li.appendChild(dateInput);
    li.appendChild(dateBtn);
    li.appendChild(star);
    li.appendChild(menu);
    els.list.appendChild(li);
  }
}

function setAddOpen(open) {
  els.form.classList.toggle('collapsed', !open);
  els.toggleBtn.classList.toggle('open', open);
  els.toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    setTimeout(() => els.input.focus(), 80);
  } else {
    els.input.value = '';
  }
}

els.toggleBtn.addEventListener('click', () => {
  const isOpen = !els.form.classList.contains('collapsed');
  setAddOpen(!isOpen);
});

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = els.input.value;
  els.input.value = '';
  addTask(value);
  els.input.focus();
});

els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setAddOpen(false);
});

document.addEventListener('click', (e) => {
  if (els.form.classList.contains('collapsed')) return;
  if (els.form.contains(e.target) || els.toggleBtn.contains(e.target)) return;
  if (!els.input.value.trim()) setAddOpen(false);
});

els.tabs.forEach(tab => {
  tab.addEventListener('click', () => setFilter(tab.dataset.filter));
});

els.clearBtn.addEventListener('click', clearAll);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') fetchTasks();
});

loadCache();
render();
fetchTasks();
setInterval(fetchTasks, SYNC_INTERVAL_MS);
