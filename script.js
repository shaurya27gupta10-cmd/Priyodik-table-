const ADMIN_EMAIL = 'shaurya27gupta10@gamil.com';
const DB_KEY = 'keyshop_inventory_pro_v1';

const state = {
  user: null,
  inventory: [],
  releases: [],
  logs: [],
  search: '',
};

const els = {
  loginForm: document.getElementById('login-form'),
  userName: document.getElementById('user-name'),
  userEmail: document.getElementById('user-email'),
  authMsg: document.getElementById('auth-msg'),
  authCard: document.getElementById('auth-card'),
  dashboard: document.getElementById('dashboard'),
  sessionInfo: document.getElementById('session-info'),
  logoutBtn: document.getElementById('logout-btn'),
  addForm: document.getElementById('add-form'),
  releaseForm: document.getElementById('release-form'),
  releaseProduct: document.getElementById('r-product'),
  inventoryList: document.getElementById('inventory-list'),
  approvalPanel: document.getElementById('approval-panel'),
  approvalList: document.getElementById('approval-list'),
  logList: document.getElementById('log-list'),
  search: document.getElementById('search'),
  stats: document.getElementById('stats'),
};

function loadState() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.inventory = parsed.inventory || [];
    state.releases = parsed.releases || [];
    state.logs = parsed.logs || [];
    state.user = parsed.user || null;
  } catch {
    state.logs = [];
  }
}

function saveState() {
  localStorage.setItem(DB_KEY, JSON.stringify({
    user: state.user,
    inventory: state.inventory,
    releases: state.releases,
    logs: state.logs,
  }));
}

function now() {
  return new Date().toLocaleString();
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function addLog(type, text) {
  state.logs.unshift({ id: uid('log'), type, text, at: now() });
  state.logs = state.logs.slice(0, 250);
}

function googleEmailValid(email) {
  return /@gmail\.com$/i.test(email.trim());
}

function login(name, email) {
  if (!googleEmailValid(email)) {
    els.authMsg.textContent = 'Only valid Google IDs ending with @gmail.com are allowed.';
    els.authMsg.style.color = '#fca5a5';
    return;
  }

  state.user = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: email.trim().toLowerCase() === ADMIN_EMAIL ? 'admin' : 'staff',
  };
  addLog('AUTH', `${state.user.name} signed in with Google ID (${state.user.email}).`);
  saveState();
  render();
}

function logout() {
  if (state.user) {
    addLog('AUTH', `${state.user.name} logged out.`);
  }
  state.user = null;
  saveState();
  render();
}

function renderStats() {
  const totalProducts = state.inventory.length;
  const totalUnits = state.inventory.reduce((sum, p) => sum + p.quantity, 0);
  const lowStock = state.inventory.filter((p) => p.quantity <= p.reorderLevel).length;
  const pending = state.releases.filter((r) => r.status === 'pending').length;

  els.stats.innerHTML = [
    ['Total Products', totalProducts],
    ['Total Units', totalUnits],
    ['Low Stock Items', lowStock],
    ['Pending Releases', pending],
  ].map(([label, value]) => `
      <div class="stat">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      </div>
    `).join('');
}

function renderReleaseOptions() {
  if (!state.inventory.length) {
    els.releaseProduct.innerHTML = '<option value="">No products available</option>';
    return;
  }

  els.releaseProduct.innerHTML = state.inventory
    .map((p) => `<option value="${p.id}">${p.name} (${p.sku}) - Qty: ${p.quantity}</option>`)
    .join('');
}

function escapeHtml(str = '') {
  return str.replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[ch]));
}

function renderInventory() {
  const q = state.search.toLowerCase();
  const rows = state.inventory
    .filter((p) => [p.name, p.sku, p.category].join(' ').toLowerCase().includes(q))
    .map((p) => {
      const low = p.quantity <= p.reorderLevel;
      return `
      <article class="item">
        <img src="${escapeHtml(p.image || 'https://placehold.co/300x300?text=No+Image')}" alt="${escapeHtml(p.name)}" onerror="this.src='https://placehold.co/300x300?text=Image+Error'" />
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <div class="muted">SKU: ${escapeHtml(p.sku)} • Category: ${escapeHtml(p.category || 'General')}</div>
          <div class="badges">
            <span class="badge ${low ? 'low' : 'ok'}">Qty: ${p.quantity}</span>
            <span class="badge">Reorder ≤ ${p.reorderLevel}</span>
            ${p.notes ? `<span class="badge">${escapeHtml(p.notes)}</span>` : ''}
          </div>
        </div>
        <div class="controls">${low ? '<button class="warn" disabled>Low Stock</button>' : ''}</div>
      </article>
      `;
    }).join('');

  els.inventoryList.innerHTML = rows || '<p class="muted">No inventory records found.</p>';
}

function renderApprovals() {
  if (state.user?.role !== 'admin') {
    els.approvalPanel.classList.add('hidden');
    return;
  }

  els.approvalPanel.classList.remove('hidden');
  const pending = state.releases.filter((r) => r.status === 'pending');
  if (!pending.length) {
    els.approvalList.innerHTML = '<p class="muted">No release requests pending approval.</p>';
    return;
  }

  els.approvalList.innerHTML = pending.map((r) => `
    <div class="activity">
      <div><strong>${escapeHtml(r.productName)}</strong> • Qty ${r.quantity}</div>
      <div class="muted">Requested by ${escapeHtml(r.requestedBy)} for ${escapeHtml(r.releaseTo)} (${escapeHtml(r.purpose)}) on ${r.requestedAt}</div>
      <div class="row" style="margin-top:.55rem;">
        <button data-approve="${r.id}">Approve</button>
        <button data-reject="${r.id}" class="danger">Reject</button>
      </div>
    </div>
  `).join('');
}

function renderLogs() {
  els.logList.innerHTML = state.logs
    .slice(0, 40)
    .map((l) => `<div class="activity"><strong>${l.type}</strong> — ${escapeHtml(l.text)} <span class="muted">(${l.at})</span></div>`)
    .join('') || '<p class="muted">No activity yet.</p>';
}

function applyRelease(release, approver = null, rejected = false) {
  const item = state.inventory.find((p) => p.id === release.productId);
  if (!item) return;

  if (rejected) {
    release.status = 'rejected';
    release.approvedBy = approver;
    release.approvedAt = now();
    addLog('RELEASE', `Release rejected for ${release.productName}, qty ${release.quantity}, request by ${release.requestedBy}.`);
    saveState();
    render();
    return;
  }

  if (item.quantity < release.quantity) {
    release.status = 'rejected';
    release.approvedBy = approver;
    release.approvedAt = now();
    addLog('RELEASE', `Release auto-rejected due to low stock (${release.productName}).`);
    saveState();
    render();
    return;
  }

  item.quantity -= release.quantity;
  release.status = 'approved';
  release.approvedBy = approver || state.user?.email;
  release.approvedAt = now();

  addLog(
    'RELEASE',
    `${release.quantity} units of ${release.productName} released to ${release.releaseTo}. Approved by ${release.approvedBy}.`
  );

  saveState();
  render();
}

function createProduct(form) {
  const product = {
    id: uid('prod'),
    name: form.name.value.trim(),
    sku: form.sku.value.trim().toUpperCase(),
    category: form.category.value.trim(),
    quantity: Number(form.quantity.value),
    reorderLevel: Number(form.reorder.value || 0),
    image: form.image.value.trim(),
    notes: form.notes.value.trim(),
    createdAt: now(),
    createdBy: state.user.email,
  };

  const duplicate = state.inventory.some((p) => p.sku === product.sku);
  if (duplicate) {
    alert('SKU already exists. Please use a unique SKU.');
    return;
  }

  state.inventory.push(product);
  addLog('ADD', `${product.name} (${product.sku}) added with ${product.quantity} opening qty by ${state.user.email}.`);
  saveState();
  render();
}

function createRelease(form) {
  const product = state.inventory.find((p) => p.id === form.productId.value);
  if (!product) {
    alert('Please select a valid product.');
    return;
  }

  const quantity = Number(form.quantity.value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    alert('Release quantity must be greater than zero.');
    return;
  }

  const release = {
    id: uid('rel'),
    productId: product.id,
    productName: product.name,
    quantity,
    releaseTo: form.releaseTo.value.trim(),
    purpose: form.purpose.value.trim(),
    requestedBy: state.user.email,
    requestedAt: now(),
    status: state.user.role === 'admin' ? 'approved' : 'pending',
  };

  state.releases.unshift(release);

  if (state.user.role === 'admin') {
    applyRelease(release, state.user.email);
  } else {
    addLog('RELEASE', `Release request submitted for ${release.productName}, qty ${release.quantity} by ${release.requestedBy}.`);
    saveState();
    render();
  }
}

function render() {
  const isLoggedIn = Boolean(state.user);

  els.authCard.classList.toggle('hidden', isLoggedIn);
  els.dashboard.classList.toggle('hidden', !isLoggedIn);

  if (!isLoggedIn) return;

  els.sessionInfo.textContent = `Logged in as ${state.user.name} (${state.user.email}) • Role: ${state.user.role.toUpperCase()}`;
  renderStats();
  renderReleaseOptions();
  renderInventory();
  renderApprovals();
  renderLogs();
}

els.loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  login(els.userName.value, els.userEmail.value);
  els.loginForm.reset();
});

els.logoutBtn.addEventListener('click', logout);

els.addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = {
    name: document.getElementById('p-name'),
    sku: document.getElementById('p-sku'),
    category: document.getElementById('p-category'),
    quantity: document.getElementById('p-qty'),
    reorder: document.getElementById('p-reorder'),
    image: document.getElementById('p-image'),
    notes: document.getElementById('p-notes'),
  };
  createProduct(form);
  e.target.reset();
  document.getElementById('p-reorder').value = 5;
});

els.releaseForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = {
    productId: document.getElementById('r-product'),
    quantity: document.getElementById('r-qty'),
    releaseTo: document.getElementById('r-to'),
    purpose: document.getElementById('r-purpose'),
  };
  createRelease(form);
  e.target.reset();
});

els.approvalList.addEventListener('click', (e) => {
  const approveId = e.target.getAttribute('data-approve');
  const rejectId = e.target.getAttribute('data-reject');
  if (approveId) {
    const release = state.releases.find((r) => r.id === approveId);
    if (release) applyRelease(release, state.user.email, false);
  }
  if (rejectId) {
    const release = state.releases.find((r) => r.id === rejectId);
    if (release) applyRelease(release, state.user.email, true);
  }
});

els.search.addEventListener('input', (e) => {
  state.search = e.target.value || '';
  renderInventory();
});

loadState();
render();
