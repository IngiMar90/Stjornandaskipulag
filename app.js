const cfg = window.APP_CONFIG || {};
const canUseSupabase = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
const sb = canUseSupabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const els = {
  filters: document.querySelector('#managerFilters'),
  taskManagers: document.querySelector('#taskManagers'),
  managerSettings: document.querySelector('#managerSettings'),
  taskDialog: document.querySelector('#taskDialog'),
  settingsDialog: document.querySelector('#settingsDialog'),
  taskForm: document.querySelector('#taskForm'),
  managerForm: document.querySelector('#managerForm'),
  syncStatus: document.querySelector('#syncStatus'),
  connectionHeadline: document.querySelector('#connectionHeadline'),
  connectionText: document.querySelector('#connectionText')
};

let managers = [];
let tasks = [];
let visibleManagerIds = new Set();
let realtimeChannel = null;

const defaults = {
  managers: [
    { id: crypto.randomUUID(), name: 'Stjórnandi 1', color: '#4f46e5' },
    { id: crypto.randomUUID(), name: 'Stjórnandi 2', color: '#0f9f6e' },
    { id: crypto.randomUUID(), name: 'Stjórnandi 3', color: '#e67e22' }
  ],
  tasks: []
};

function loadLocal() {
  const savedManagers = JSON.parse(localStorage.getItem('stjornendur') || 'null');
  const savedTasks = JSON.parse(localStorage.getItem('verkefni') || 'null');
  managers = savedManagers?.length ? savedManagers : defaults.managers;
  tasks = Array.isArray(savedTasks) ? savedTasks : defaults.tasks;
  visibleManagerIds = new Set(managers.map(m => m.id));
  persistLocal();
}

function persistLocal() {
  localStorage.setItem('stjornendur', JSON.stringify(managers));
  localStorage.setItem('verkefni', JSON.stringify(tasks));
}

async function loadRemote() {
  if (!sb) return false;
  const [{ data: remoteManagers, error: me }, { data: remoteTasks, error: te }] = await Promise.all([
    sb.from('managers').select('*').order('created_at'),
    sb.from('tasks').select('*, task_managers(manager_id)').order('created_at')
  ]);
  if (me || te) {
    console.error(me || te);
    return false;
  }
  managers = (remoteManagers || []).map(m => ({ id: m.id, name: m.name, color: m.color }));
  tasks = (remoteTasks || []).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
    dueDate: t.due_date || '',
    priority: t.priority || 'normal',
    status: t.status || 'todo',
    managerIds: (t.task_managers || []).map(x => x.manager_id)
  }));
  visibleManagerIds = new Set(managers.map(m => m.id));
  setOnline(true);
  return true;
}

function setOnline(online) {
  els.syncStatus.textContent = online ? 'Rauntímatenging virk' : 'Staðbundin vistun';
  els.syncStatus.className = `sync-status ${online ? 'online' : 'offline'}`;
  els.connectionHeadline.textContent = online ? 'Tengt við sameiginlegan gagnagrunn' : 'Staðbundin stilling';
  els.connectionText.textContent = online
    ? 'Breytingar uppfærast sjálfkrafa hjá öllum tengdum tækjum.'
    : 'Gögn vistast aðeins á þessu tæki þar til Supabase er tengt.';
}

function getManager(id) { return managers.find(m => m.id === id); }
function escapeHtml(text = '') { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

function render() {
  renderFilters();
  renderTaskManagerChecks();
  renderManagerSettings();
  renderBoard();
}

function renderFilters() {
  els.filters.innerHTML = '';
  managers.forEach(m => {
    const b = document.createElement('button');
    b.className = `manager-chip ${visibleManagerIds.has(m.id) ? '' : 'inactive'}`;
    b.style.borderColor = visibleManagerIds.has(m.id) ? m.color : 'transparent';
    b.innerHTML = `<span class="manager-color" style="background:${m.color}"></span>${escapeHtml(m.name)}`;
    b.onclick = () => {
      visibleManagerIds.has(m.id) ? visibleManagerIds.delete(m.id) : visibleManagerIds.add(m.id);
      renderFilters(); renderBoard();
    };
    els.filters.appendChild(b);
  });
}

function renderTaskManagerChecks(selected = null) {
  const selectedIds = selected || [...els.taskManagers.querySelectorAll('input:checked')].map(i => i.value);
  els.taskManagers.innerHTML = '';
  managers.forEach(m => {
    const label = document.createElement('label');
    label.className = 'manager-check';
    label.innerHTML = `<input type="checkbox" value="${m.id}" ${selectedIds.includes(m.id) ? 'checked' : ''}><span class="manager-color" style="background:${m.color}"></span>${escapeHtml(m.name)}`;
    els.taskManagers.appendChild(label);
  });
}

function renderManagerSettings() {
  els.managerSettings.innerHTML = managers.map(m => `
    <div class="manager-setting-row" data-id="${m.id}">
      <div class="manager-setting-name"><span class="manager-color" style="background:${m.color}"></span><span>${escapeHtml(m.name)}</span></div>
      <input class="manager-color-input" type="color" value="${m.color}" aria-label="Litur ${escapeHtml(m.name)}">
      <button class="small-btn remove-manager" type="button">Eyða</button>
    </div>`).join('');

  els.managerSettings.querySelectorAll('.manager-color-input').forEach(input => {
    input.addEventListener('change', async e => {
      const id = e.target.closest('[data-id]').dataset.id;
      const m = getManager(id); if (!m) return;
      m.color = e.target.value;
      await saveManager(m); render();
    });
  });

  els.managerSettings.querySelectorAll('.remove-manager').forEach(btn => {
    btn.onclick = async e => {
      const id = e.target.closest('[data-id]').dataset.id;
      if (!confirm('Viltu eyða þessum stjórnanda? Verkefnin verða áfram til en stjórnandinn fjarlægður af þeim.')) return;
      await deleteManager(id);
    };
  });
}

function taskVisible(task) {
  if (!task.managerIds?.length) return true;
  return task.managerIds.some(id => visibleManagerIds.has(id));
}

function renderBoard() {
  ['todo','doing','done'].forEach(status => {
    const list = document.querySelector(`#${status}List`);
    const filtered = tasks.filter(t => t.status === status && taskVisible(t));
    list.innerHTML = '';
    filtered.forEach(task => list.appendChild(createTaskCard(task)));
    document.querySelector(`#${status}Count`).textContent = filtered.length;
    if (!filtered.length) list.innerHTML = '<div class="empty-state">Engin verkefni hér</div>';
  });
}

function createTaskCard(task) {
  const node = document.querySelector('#taskTemplate').content.firstElementChild.cloneNode(true);
  node.dataset.id = task.id;
  const assigned = (task.managerIds || []).map(getManager).filter(Boolean);
  const accent = assigned[0]?.color || '#98a2b3';
  node.querySelector('.task-accent').style.background = assigned.length > 1
    ? `linear-gradient(to bottom, ${assigned.map((m,i)=>`${m.color} ${i/assigned.length*100}% ${(i+1)/assigned.length*100}%`).join(',')})`
    : accent;
  node.querySelector('h4').textContent = task.title;
  const desc = node.querySelector('.task-desc');
  desc.textContent = task.description || '';
  if (!task.description) desc.style.display = 'none';
  const p = node.querySelector('.priority-badge');
  p.className = `priority-badge priority-${task.priority}`;
  p.textContent = task.priority === 'high' ? 'Mikill forgangur' : task.priority === 'low' ? 'Lítill forgangur' : 'Venjulegur';
  node.querySelector('.due-date').textContent = task.dueDate ? `📅 ${new Date(task.dueDate+'T00:00:00').toLocaleDateString('is-IS')}` : 'Enginn skiladagur';
  node.querySelector('.task-manager-row').innerHTML = assigned.map(m => `<span class="manager-mini" style="color:${m.color}">${escapeHtml(m.name)}</span>`).join('') || '<span class="manager-mini">Óúthlutað</span>';
  node.querySelector('.task-menu').onclick = () => openTaskDialog(task);
  node.ondblclick = () => openTaskDialog(task);
  node.addEventListener('dragstart', e => { node.classList.add('dragging'); e.dataTransfer.setData('text/plain', task.id); });
  node.addEventListener('dragend', () => node.classList.remove('dragging'));
  return node;
}

function openTaskDialog(task = null) {
  document.querySelector('#taskDialogTitle').textContent = task ? 'Breyta verkefni' : 'Nýtt verkefni';
  document.querySelector('#taskId').value = task?.id || '';
  document.querySelector('#taskTitle').value = task?.title || '';
  document.querySelector('#taskDescription').value = task?.description || '';
  document.querySelector('#taskDueDate').value = task?.dueDate || '';
  document.querySelector('#taskPriority').value = task?.priority || 'normal';
  document.querySelector('#taskStatus').value = task?.status || 'todo';
  renderTaskManagerChecks(task?.managerIds || []);
  document.querySelector('#deleteTaskBtn').classList.toggle('hidden', !task);
  els.taskDialog.showModal();
}

async function saveTask(task) {
  if (!sb) {
    const idx = tasks.findIndex(t => t.id === task.id);
    idx >= 0 ? tasks[idx] = task : tasks.push(task);
    persistLocal(); render(); return;
  }
  const payload = { id: task.id, title: task.title, description: task.description, due_date: task.dueDate || null, priority: task.priority, status: task.status };
  const { error } = await sb.from('tasks').upsert(payload);
  if (error) return alert('Ekki tókst að vista verkefni: ' + error.message);
  await sb.from('task_managers').delete().eq('task_id', task.id);
  if (task.managerIds.length) {
    const { error: linkError } = await sb.from('task_managers').insert(task.managerIds.map(manager_id => ({ task_id: task.id, manager_id })));
    if (linkError) return alert('Verkefni vistaðist en ekki ábyrgðaraðilar: ' + linkError.message);
  }
  await loadRemote(); render();
}

async function removeTask(id) {
  if (!sb) {
    tasks = tasks.filter(t => t.id !== id); persistLocal(); render(); return;
  }
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) alert(error.message); else { await loadRemote(); render(); }
}

async function saveManager(manager) {
  if (!sb) { persistLocal(); return; }
  const { error } = await sb.from('managers').upsert({ id: manager.id, name: manager.name, color: manager.color });
  if (error) alert(error.message);
}

async function deleteManager(id) {
  if (!sb) {
    managers = managers.filter(m => m.id !== id);
    tasks.forEach(t => t.managerIds = (t.managerIds || []).filter(x => x !== id));
    visibleManagerIds.delete(id); persistLocal(); render(); return;
  }
  const { error } = await sb.from('managers').delete().eq('id', id);
  if (error) alert(error.message); else { await loadRemote(); render(); }
}

els.taskForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.querySelector('#taskId').value || crypto.randomUUID();
  const task = {
    id,
    title: document.querySelector('#taskTitle').value.trim(),
    description: document.querySelector('#taskDescription').value.trim(),
    dueDate: document.querySelector('#taskDueDate').value,
    priority: document.querySelector('#taskPriority').value,
    status: document.querySelector('#taskStatus').value,
    managerIds: [...els.taskManagers.querySelectorAll('input:checked')].map(i => i.value)
  };
  if (!task.title) return;
  await saveTask(task);
  els.taskDialog.close();
});

document.querySelector('#deleteTaskBtn').onclick = async () => {
  const id = document.querySelector('#taskId').value;
  if (id && confirm('Viltu eyða verkefninu?')) { await removeTask(id); els.taskDialog.close(); }
};

els.managerForm.addEventListener('submit', async e => {
  e.preventDefault();
  const m = { id: crypto.randomUUID(), name: document.querySelector('#managerName').value.trim(), color: document.querySelector('#managerColor').value };
  if (!m.name) return;
  managers.push(m); visibleManagerIds.add(m.id); await saveManager(m);
  document.querySelector('#managerName').value = '';
  render();
});

document.querySelector('#addTaskBtn').onclick = () => openTaskDialog();
document.querySelector('#settingsBtn').onclick = () => els.settingsDialog.showModal();
document.querySelector('#showAllBtn').onclick = () => { visibleManagerIds = new Set(managers.map(m=>m.id)); renderFilters(); renderBoard(); };
document.querySelector('#hideAllBtn').onclick = () => { visibleManagerIds.clear(); renderFilters(); renderBoard(); };
document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => els.taskDialog.close());
document.querySelectorAll('.close-settings').forEach(b => b.onclick = () => els.settingsDialog.close());

for (const column of document.querySelectorAll('.column')) {
  column.addEventListener('dragover', e => e.preventDefault());
  column.addEventListener('drop', async e => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.status = column.dataset.status;
    await saveTask(task);
  });
}

async function setupRealtime() {
  if (!sb) return;
  realtimeChannel = sb.channel('stjornandaskipulag-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refreshRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_managers' }, refreshRemote)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'managers' }, refreshRemote)
    .subscribe(status => setOnline(status === 'SUBSCRIBED'));
}

let refreshTimer;
function refreshRemote() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => { await loadRemote(); render(); }, 120);
}

(async function init() {
  loadLocal();
  if (canUseSupabase) {
    const ok = await loadRemote();
    if (ok) await setupRealtime(); else setOnline(false);
  } else setOnline(false);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();
