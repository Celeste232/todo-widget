const STORAGE_KEY = 'wony_todo_widget_v1';

const state = {
  tasks: [],
  filter: 'all',
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

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.tasks = JSON.parse(raw);
  } catch (e) {
    state.tasks = [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (e) {}
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  state.tasks.unshift({ id: uid(), text: trimmed, done: false, starred: false, createdAt: Date.now() });
  save();
  render();
}

function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  save();
  render();
}

function toggleStar(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.starred = !t.starred;
  save();
  render();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(x => x.id !== id);
  save();
  render();
}

function clearAll() {
  if (state.tasks.length === 0) return;
  const msg = state.filter === 'completed'
    ? '완료된 항목을 모두 삭제할까?'
    : state.filter === 'pending'
      ? '진행 중 항목을 모두 삭제할까?'
      : '모든 할 일을 삭제할까?';
  if (!confirm(msg)) return;
  if (state.filter === 'all') {
    state.tasks = [];
  } else if (state.filter === 'completed') {
    state.tasks = state.tasks.filter(t => !t.done);
  } else {
    state.tasks = state.tasks.filter(t => t.done);
  }
  save();
  render();
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
    li.className = 'task-item' + (t.done ? ' done' : '');
    li.dataset.id = t.id;

    const checkbox = document.createElement('button');
    checkbox.className = 'checkbox' + (t.done ? ' checked' : '');
    checkbox.setAttribute('aria-label', t.done ? '완료 취소' : '완료 표시');
    checkbox.addEventListener('click', () => toggleTask(t.id));

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = t.text;
    text.addEventListener('click', () => toggleTask(t.id));

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
    li.appendChild(text);
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
  addTask(els.input.value);
  els.input.value = '';
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

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    load();
    render();
  }
});

load();
if (state.tasks.length === 0) {
  state.tasks = [
    { id: uid(), text: 'Update Notion', done: true, createdAt: Date.now() - 3000 },
    { id: uid(), text: 'Update to-do list', done: false, createdAt: Date.now() - 2000 },
    { id: uid(), text: 'Familiarize myself with dashboard', done: false, createdAt: Date.now() - 1000 },
  ];
  save();
}
render();
