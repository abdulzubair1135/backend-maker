// Authentication Check
let token = localStorage.getItem('wss_admin_token');
let refreshTokenVal = localStorage.getItem('wss_admin_refresh_token');
const user = localStorage.getItem('wss_admin_user');

if (!token && !window.location.pathname.endsWith('login.html')) {
  window.location.href = './login.html';
}

if (user && document.getElementById('adminUsername')) {
  document.getElementById('adminUsername').textContent = user;
}

// State Management
let activeTab = 'dashboard';
let allLeads = [];
let allUsers = [];
let allSliders = [];
let allBackups = [];

// Cookie reader helper for CSRF
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

// Fetch Wrapper with CSRF header injection & Refresh Token rotation support
async function secureFetch(url, options = {}) {
  options.headers = options.headers || {};
  
  // Inject access token
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  // Inject CSRF token for mutations
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    options.headers['X-CSRF-Token'] = getCookie('csrfToken');
    if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
  }

  let response = await fetch(url, options);

  // If 401 Unauthorized, try rotating token with Refresh Token
  if (response.status === 401 && refreshTokenVal) {
    try {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCookie('csrfToken') },
        body: JSON.stringify({ token: refreshTokenVal })
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        token = refreshData.accessToken;
        localStorage.setItem('wss_admin_token', token);

        // Retry primary request
        options.headers['Authorization'] = `Bearer ${token}`;
        response = await fetch(url, options);
      } else {
        // Refresh token invalid/expired, log out
        handleLogout();
      }
    } catch (err) {
      handleLogout();
    }
  }

  return response;
}

function handleLogout() {
  localStorage.removeItem('wss_admin_token');
  localStorage.removeItem('wss_admin_refresh_token');
  localStorage.removeItem('wss_admin_user');
  window.location.href = './login.html';
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    setupTabNavigation();
    setupEventListeners();
    loadTabContent('dashboard');
  }
});

// Setup Main Tab Navigation
function setupTabNavigation() {
  const sidebarButtons = document.querySelectorAll('.sidebar-nav .nav-btn');
  const viewTitle = document.getElementById('viewTitle');

  sidebarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sidebarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.getAttribute('data-tab');
      activeTab = tab;
      
      // Update header title
      viewTitle.textContent = btn.innerText.trim();

      // Show tab content
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');

      loadTabContent(tab);
    });
  });
}

// Load tab specific contents
function loadTabContent(tab) {
  switch (tab) {
    case 'dashboard':
      fetchDashboardStats();
      break;
    case 'leads':
      fetchLeads();
      break;
    case 'cms':
      loadCMSSection('about');
      break;
    case 'users':
      fetchUsers();
      break;
    case 'media':
      fetchMediaFiles();
      break;
    case 'logs':
      fetchLogs('activity');
      break;
    case 'backups':
      fetchBackups();
      break;
  }
}

// Global Event Listeners Setup
function setupEventListeners() {
  // Global refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadTabContent(activeTab);
  });

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await secureFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ token: refreshTokenVal })
      });
    } catch(e) {}
    handleLogout();
  });

  // Lead modal dismiss
  document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('leadModal').classList.add('hidden');
  });

  // CMS Sub navigation tabs click events
  document.querySelectorAll('.cms-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.cms-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const section = e.target.getAttribute('data-cms-section');
      loadCMSSection(section);
    });
  });

  // CMS: about form submit
  document.getElementById('aboutPageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const heroTitle = document.getElementById('aboutHeroTitle').value;
    const heroSubtitle = document.getElementById('aboutHeroSubtitle').value;
    const history = document.getElementById('aboutHistory').value;

    const response = await secureFetch('/api/cms/pages/about', {
      method: 'PUT',
      body: JSON.stringify({
        title: 'About Websoft Solutions',
        content: { heroTitle, heroSubtitle, history }
      })
    });
    if (response.ok) alert('About Page content updated successfully!');
  });

  // CMS: general settings page form submit
  document.getElementById('settingsPageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const companyName = document.getElementById('settingsCompanyName').value;
    const supportHours = document.getElementById('settingsSupportHours').value;
    const metaTitle = document.getElementById('settingsMetaTitle').value;
    const metaDesc = document.getElementById('settingsMetaDesc').value;

    const response = await secureFetch('/api/cms/pages/settings', {
      method: 'PUT',
      body: JSON.stringify({
        title: companyName,
        content: { companyName, supportHours },
        meta_title: metaTitle,
        meta_description: metaDesc
      })
    });
    if (response.ok) alert('Site settings updated successfully!');
  });

  // Leads Category filter group
  document.getElementById('leadsCategoryFilter').addEventListener('click', (e) => {
    if (e.target.classList.contains('pill')) {
      document.querySelectorAll('#leadsCategoryFilter .pill').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderLeads(e.target.getAttribute('data-category'));
    }
  });

  // Backup create button
  document.getElementById('createBackupBtn').addEventListener('click', async () => {
    const response = await secureFetch('/api/backup', { method: 'POST' });
    if (response.ok) {
      alert('Database backup created successfully!');
      fetchBackups();
    } else {
      alert('Failed to trigger database backup.');
    }
  });

  // Logs sub tabs click
  document.querySelectorAll('.log-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.log-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      fetchLogs(e.target.getAttribute('data-log-type'));
    });
  });

  // Create user account modal setup
  document.getElementById('createUserBtn').addEventListener('click', () => {
    openUserModal();
  });

  document.getElementById('closeUserModalBtn').addEventListener('click', () => {
    document.getElementById('userModal').classList.add('hidden');
  });

  document.getElementById('userForm').addEventListener('submit', handleUserFormSubmit);
  document.getElementById('deleteUserBtn').addEventListener('click', handleDeleteUser);

  // Upload Media setup
  document.getElementById('uploadMediaForm').addEventListener('submit', handleMediaUpload);

  // Add new slider setup
  document.getElementById('addSliderBtn').addEventListener('click', () => {
    openSliderModal();
  });
  document.getElementById('closeSliderModalBtn').addEventListener('click', () => {
    document.getElementById('sliderModal').classList.add('hidden');
  });
  document.getElementById('sliderForm').addEventListener('submit', handleSliderFormSubmit);
}

// ----------------------------------------------------
// TAB logic implementations
// ----------------------------------------------------

// 1. Dashboard Tab
async function fetchDashboardStats() {
  try {
    const response = await secureFetch('/api/admin/stats');
    if (!response.ok) throw new Error('Failed to load stats');
    const data = await response.json();

    // Set stats
    document.getElementById('statTotal').textContent = data.stats.leads;
    document.getElementById('statPending').textContent = data.stats.pending;
    document.getElementById('statContacted').textContent = data.stats.contacted;
    document.getElementById('statCompleted').textContent = data.stats.completed;

    // Render category list
    const categoryList = document.getElementById('categoryDistributionList');
    categoryList.innerHTML = '';
    if (data.categories.length === 0) {
      categoryList.innerHTML = '<p class="text-muted">No categories recorded yet.</p>';
    } else {
      data.categories.forEach(cat => {
        categoryList.innerHTML += `
          <div class="category-row">
            <span style="text-transform: capitalize;">${cat.category.replace('_', ' ')}</span>
            <strong>${cat.count}</strong>
          </div>
        `;
      });
    }

    // Render timeline
    const activityList = document.getElementById('recentActivityList');
    activityList.innerHTML = '';
    if (data.recentActivities.length === 0) {
      activityList.innerHTML = '<p class="text-muted">No recent activities.</p>';
    } else {
      data.recentActivities.forEach(act => {
        const dateStr = new Date(act.created_at).toLocaleTimeString();
        activityList.innerHTML += `
          <div class="timeline-item">
            <div class="timeline-meta">
              <span>👤 ${act.username || 'System'}</span>
              <span>${dateStr}</span>
            </div>
            <div class="timeline-desc">${act.action} - <span style="font-weight: normal; font-size: 13px; color: var(--text-muted);">${act.details}</span></div>
          </div>
        `;
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// 2. Leads Tab
async function fetchLeads() {
  const container = document.getElementById('leadsList');
  container.innerHTML = '<p class="text-muted">Loading leads...</p>';

  try {
    const response = await secureFetch('/api/admin/leads');
    if (!response.ok) throw new Error('Failed to get leads list');
    allLeads = await response.json();
    renderLeads('All');
  } catch (err) {
    container.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
  }
}

function renderLeads(categoryFilter) {
  const container = document.getElementById('leadsList');
  container.innerHTML = '';

  const filtered = allLeads.filter(l => categoryFilter === 'All' || l.category === categoryFilter);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state glass"><h3>No inquiries found</h3></div>';
    return;
  }

  filtered.forEach(lead => {
    const item = document.createElement('div');
    item.className = 'lead-item glass';
    item.addEventListener('click', () => openLeadDetailModal(lead));

    const dateStr = new Date(lead.created_at).toLocaleString();
    const statusClass = `badge-status-${lead.status.toLowerCase()}`;

    let subText = lead.details?.message || lead.details?.details || lead.details?.address || '';
    if (lead.details?.vcNumber) subText = `VC Card: ${lead.details.vcNumber}. ${subText}`;
    if (lead.details?.packName) subText = `Package: ${lead.details.packName}. ${subText}`;

    item.innerHTML = `
      <div class="lead-left">
        <div class="lead-meta">
          <span class="badge badge-category">${lead.category.replace('_', ' ')}</span>
          <span class="badge badge-status ${statusClass}">${lead.status}</span>
          <span class="lead-date">${dateStr}</span>
        </div>
        <div class="lead-name">${lead.name} (${lead.phone})</div>
        ${subText ? `<div class="lead-preview-text" style="font-size: 13px; color: var(--text-muted);">${subText}</div>` : ''}
      </div>
      <div class="lead-right">
        ${lead.details?.amount ? `<div class="lead-amount">₹${lead.details.amount}</div>` : ''}
      </div>
    `;
    container.appendChild(item);
  });
}

function openLeadDetailModal(lead) {
  const modal = document.getElementById('leadModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const footer = document.getElementById('modalFooter');

  title.textContent = `${lead.category.toUpperCase()} Submission`;

  let detailsRows = '';
  if (lead.details) {
    for (const [key, val] of Object.entries(lead.details)) {
      detailsRows += `
        <div class="detail-item">
          <span class="detail-label" style="text-transform: capitalize;">${key}</span>
          <span class="detail-value">${val || 'N/A'}</span>
        </div>
      `;
    }
  }

  body.innerHTML = `
    <div class="modal-detail-grid">
      <div class="detail-item">
        <span class="detail-label">Client Name</span>
        <span class="detail-value">${lead.name}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Phone</span>
        <span class="detail-value">${lead.phone}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Email</span>
        <span class="detail-value">${lead.email || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Date Submitted</span>
        <span class="detail-value">${new Date(lead.created_at).toLocaleString()}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Status</span>
        <span class="detail-value"><span class="badge badge-status badge-status-${lead.status.toLowerCase()}">${lead.status}</span></span>
      </div>
      ${detailsRows}
      <div class="detail-item">
        <span class="detail-label">Admin Notes (Saves automatically)</span>
        <textarea id="leadNotesArea" class="input-group" style="min-height: 80px;">${lead.notes || ''}</textarea>
      </div>
    </div>
  `;

  // Autosave notes
  const notesArea = document.getElementById('leadNotesArea');
  let saveNotesTimeout;
  notesArea.addEventListener('input', () => {
    clearTimeout(saveNotesTimeout);
    saveNotesTimeout = setTimeout(async () => {
      await secureFetch(`/api/admin/leads/${lead.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: lead.status, notes: notesArea.value })
      });
      lead.notes = notesArea.value;
    }, 1000);
  });

  // Footer Actions
  footer.innerHTML = `
    <button class="btn btn-danger" onclick="deleteLead(${lead.id})">Delete</button>
    <div class="modal-actions-right">
      <button class="btn btn-secondary" onclick="updateLeadStatus(${lead.id}, 'Contacted', '${lead.notes || ''}')">Mark Contacted</button>
      <button class="btn btn-success" onclick="updateLeadStatus(${lead.id}, 'Completed', '${lead.notes || ''}')">Mark Completed</button>
    </div>
  `;

  modal.classList.remove('hidden');
}

window.updateLeadStatus = async function(id, newStatus, currentNotes) {
  const response = await secureFetch(`/api/admin/leads/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus, notes: currentNotes })
  });

  if (response.ok) {
    document.getElementById('leadModal').classList.add('hidden');
    fetchLeads();
  }
};

window.deleteLead = async function(id) {
  if (!confirm('Are you sure you want to delete this lead?')) return;
  const response = await secureFetch(`/api/admin/leads/${id}`, { method: 'DELETE' });
  if (response.ok) {
    document.getElementById('leadModal').classList.add('hidden');
    fetchLeads();
  }
};

// 3. CMS Tab
async function loadCMSSection(section) {
  document.querySelectorAll('.cms-editor-pane').forEach(pane => pane.classList.remove('active'));
  document.getElementById(`cms-editor-${section}`).classList.add('active');

  if (section === 'about') {
    const res = await secureFetch('/api/cms/pages/about');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('aboutHeroTitle').value = data.content?.heroTitle || '';
      document.getElementById('aboutHeroSubtitle').value = data.content?.heroSubtitle || '';
      document.getElementById('aboutHistory').value = data.content?.history || '';
    }
  } else if (section === 'settings') {
    const res = await secureFetch('/api/cms/pages/settings');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('settingsCompanyName').value = data.content?.companyName || '';
      document.getElementById('settingsSupportHours').value = data.content?.supportHours || '';
      document.getElementById('settingsMetaTitle').value = data.meta_title || '';
      document.getElementById('settingsMetaDesc').value = data.meta_description || '';
    }
  } else if (section === 'sliders') {
    fetchSliders();
  }
}

async function fetchSliders() {
  const list = document.getElementById('slidersList');
  list.innerHTML = '<p class="text-muted">Loading banners...</p>';
  try {
    const res = await secureFetch('/api/cms/sliders');
    if (res.ok) {
      allSliders = await res.json();
      list.innerHTML = '';
      if (allSliders.length === 0) {
        list.innerHTML = '<p class="text-muted">No banners found.</p>';
      } else {
        allSliders.forEach(slide => {
          list.innerHTML += `
            <div class="slider-item">
              <div>
                <strong>${slide.title}</strong>
                <p style="font-size:12px; color:var(--text-muted);">${slide.subtitle || ''} | URL: ${slide.image_url}</p>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" onclick="openSliderModal(${slide.id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteSlider(${slide.id})">Delete</button>
              </div>
            </div>
          `;
        });
      }
    }
  } catch(e) {}
}

let activeSliderId = null;
function openSliderModal(id = null) {
  activeSliderId = id;
  const modal = document.getElementById('sliderModal');
  const title = document.getElementById('sliderModalTitle');
  const form = document.getElementById('sliderForm');

  if (id) {
    title.textContent = 'Edit Slide Banner';
    const slide = allSliders.find(s => s.id === id);
    document.getElementById('slideTitle').value = slide.title;
    document.getElementById('slideSubtitle').value = slide.subtitle || '';
    document.getElementById('slideImageUrl').value = slide.image_url;
    document.getElementById('slideLinkUrl').value = slide.link_url || '';
    document.getElementById('slideSortOrder').value = slide.sort_order;
  } else {
    title.textContent = 'Add Slide Banner';
    form.reset();
  }

  modal.classList.remove('hidden');
}

async function handleSliderFormSubmit(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('slideTitle').value,
    subtitle: document.getElementById('slideSubtitle').value,
    image_url: document.getElementById('slideImageUrl').value,
    link_url: document.getElementById('slideLinkUrl').value,
    sort_order: parseInt(document.getElementById('slideSortOrder').value || '0')
  };

  let res;
  if (activeSliderId) {
    res = await secureFetch(`/api/cms/sliders/${activeSliderId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, active: 1 })
    });
  } else {
    res = await secureFetch('/api/cms/sliders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  if (res.ok) {
    document.getElementById('sliderModal').classList.add('hidden');
    fetchSliders();
  }
}

window.deleteSlider = async function(id) {
  if (!confirm('Are you sure you want to delete this slide?')) return;
  const res = await secureFetch(`/api/cms/sliders/${id}`, { method: 'DELETE' });
  if (res.ok) fetchSliders();
};

// 4. Users Management Tab
async function fetchUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Loading users...</td></tr>';

  try {
    const response = await secureFetch('/api/admin/users');
    if (response.ok) {
      allUsers = await response.json();
      tbody.innerHTML = '';
      allUsers.forEach(u => {
        tbody.innerHTML += `
          <tr>
            <td><strong>${u.username}</strong></td>
            <td>${u.email}</td>
            <td><span class="badge badge-category">${u.roleName || 'No Role'}</span></td>
            <td><span class="badge ${u.status === 'Active' ? 'badge-status-completed' : 'badge-status-pending'}">${u.status}</span></td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-secondary btn-icon" onclick="openUserModal(${u.id})">Edit</button>
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

let activeUserId = null;
function openUserModal(id = null) {
  activeUserId = id;
  const modal = document.getElementById('userModal');
  const deleteBtn = document.getElementById('deleteUserBtn');
  const title = document.getElementById('userModalTitle');

  if (id) {
    title.textContent = 'Edit User Account';
    deleteBtn.classList.remove('hidden');
    const u = allUsers.find(user => user.id === id);
    document.getElementById('userUsername').value = u.username;
    document.getElementById('userUsername').disabled = true;
    document.getElementById('userEmail').value = u.email;
    document.getElementById('userRole').value = u.roleId || '3';
    document.getElementById('userStatus').value = u.status;
  } else {
    title.textContent = 'Create User Account';
    deleteBtn.classList.add('hidden');
    document.getElementById('userUsername').disabled = false;
    document.getElementById('userForm').reset();
  }

  modal.classList.remove('hidden');
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('userUsername').value;
  const email = document.getElementById('userEmail').value;
  const password = document.getElementById('userPassword').value;
  const roleId = document.getElementById('userRole').value;
  const status = document.getElementById('userStatus').value;

  let res;
  if (activeUserId) {
    res = await secureFetch(`/api/admin/users/${activeUserId}`, {
      method: 'PUT',
      body: JSON.stringify({ email, roleId, status, password })
    });
  } else {
    if (!password) {
      alert('Password is required for new users.');
      return;
    }
    res = await secureFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, roleId })
    });
  }

  if (res.ok) {
    document.getElementById('userModal').classList.add('hidden');
    fetchUsers();
  } else {
    const data = await res.json();
    alert(data.error || 'Failed to save user.');
  }
}

async function handleDeleteUser() {
  if (!activeUserId) return;
  if (!confirm('Are you sure you want to delete this user?')) return;

  const res = await secureFetch(`/api/admin/users/${activeUserId}`, { method: 'DELETE' });
  if (res.ok) {
    document.getElementById('userModal').classList.add('hidden');
    fetchUsers();
  } else {
    const data = await res.json();
    alert(data.error || 'Failed to delete user.');
  }
}

// 5. Media Manager Tab
async function fetchMediaFiles() {
  const grid = document.getElementById('mediaGrid');
  grid.innerHTML = '<p class="text-muted">Loading media...</p>';

  try {
    const res = await secureFetch('/api/media');
    if (res.ok) {
      const files = await res.json();
      grid.innerHTML = '';
      if (files.length === 0) {
        grid.innerHTML = '<p class="text-muted">No uploaded files. Upload one above!</p>';
        return;
      }
      files.forEach(f => {
        const isImage = /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(f.name);
        const previewContent = isImage 
          ? `<img src="${f.url}" alt="${f.name}">` 
          : `<span>📄</span>`;

        grid.innerHTML += `
          <div class="media-item glass">
            <div class="media-preview">${previewContent}</div>
            <div class="media-name">${f.name}</div>
            <button class="media-delete-btn" onclick="deleteMediaFile('${f.name}')">&times;</button>
          </div>
        `;
      });
    }
  } catch (e) {
    grid.innerHTML = '<p class="text-danger">Failed to load media.</p>';
  }
}

async function handleMediaUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('mediaFileInput');
  const file = fileInput.files[0];
  if (!file) return;

  // Convert to base64
  const reader = new FileReader();
  reader.onloadend = async () => {
    const response = await secureFetch('/api/media/upload', {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        content: reader.result
      })
    });

    if (response.ok) {
      fileInput.value = '';
      fetchMediaFiles();
    } else {
      alert('Failed to upload file.');
    }
  };
  reader.readAsDataURL(file);
}

window.deleteMediaFile = async function(filename) {
  if (!confirm(`Delete file "${filename}"?`)) return;
  const res = await secureFetch(`/api/media/${filename}`, { method: 'DELETE' });
  if (res.ok) fetchMediaFiles();
};

// 6. System Logs Tab
async function fetchLogs(type) {
  const header = document.getElementById('logsTableHeader');
  const body = document.getElementById('logsTableBody');
  body.innerHTML = '<tr><td colspan="4" class="text-muted">Loading logs...</td></tr>';

  try {
    const response = await secureFetch(`/api/admin/logs/${type}`);
    if (response.ok) {
      const logs = await response.json();
      body.innerHTML = '';
      
      if (type === 'activity') {
        header.innerHTML = `
          <tr>
            <th>Timestamp</th>
            <th>Admin User</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        `;
        logs.forEach(l => {
          body.innerHTML += `
            <tr>
              <td>${new Date(l.created_at).toLocaleString()}</td>
              <td><strong>${l.username || 'System'}</strong></td>
              <td>${l.action}</td>
              <td><span style="font-size: 13px; color: var(--text-muted);">${l.details || ''}</span></td>
            </tr>
          `;
        });
      } else {
        header.innerHTML = `
          <tr>
            <th>Timestamp</th>
            <th>Username Provided</th>
            <th>IP Address</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        `;
        logs.forEach(l => {
          body.innerHTML += `
            <tr>
              <td>${new Date(l.created_at).toLocaleString()}</td>
              <td><strong>${l.username}</strong></td>
              <td>${l.ip_address || 'Unknown'}</td>
              <td><span class="badge ${l.status === 'Success' ? 'badge-status-completed' : 'badge-status-pending'}">${l.status}</span></td>
              <td><span style="font-size: 13px; color: var(--text-muted);">${l.details || ''}</span></td>
            </tr>
          `;
        });
      }
    }
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="text-danger">Error: ${err.message}</td></tr>`;
  }
}

// 7. Backup Tab
async function fetchBackups() {
  const body = document.getElementById('backupsTableBody');
  body.innerHTML = '<tr><td colspan="4" class="text-muted">Loading backups...</td></tr>';

  try {
    const res = await secureFetch('/api/backup');
    if (res.ok) {
      allBackups = await res.json();
      body.innerHTML = '';
      if (allBackups.length === 0) {
        body.innerHTML = '<tr><td colspan="4" class="text-muted">No database backups available.</td></tr>';
        return;
      }
      allBackups.forEach(b => {
        const sizeKb = (b.size / 1024).toFixed(1);
        body.innerHTML += `
          <tr>
            <td><strong>${b.name}</strong></td>
            <td>${sizeKb} KB</td>
            <td>${new Date(b.createdAt).toLocaleString()}</td>
            <td>
              <button class="btn btn-success" onclick="restoreBackup('${b.name}')">Restore</button>
              <button class="btn btn-danger" onclick="deleteBackup('${b.name}')">Delete</button>
            </td>
          </tr>
        `;
      });
    }
  } catch (e) {
    body.innerHTML = `<tr><td colspan="4" class="text-danger">Failed to load backups.</td></tr>`;
  }
}

window.restoreBackup = async function(filename) {
  if (!confirm(`RESTORE warning: This will overwrite your entire database with backup "${filename}". Proceed?`)) return;
  
  const res = await secureFetch('/api/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ filename })
  });

  if (res.ok) {
    alert('Database successfully restored from backup.');
    loadTabContent(activeTab);
  } else {
    alert('Failed to restore database backup.');
  }
};

window.deleteBackup = async function(filename) {
  if (!confirm(`Delete backup file "${filename}"?`)) return;
  const res = await secureFetch(`/api/backup/${filename}`, { method: 'DELETE' });
  if (res.ok) fetchBackups();
};
