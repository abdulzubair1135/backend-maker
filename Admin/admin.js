/* ========================================================
   💎 Enterprise SaaS Admin JS Logic Console
   No external frameworks (jQuery) - Pure ES6 Vanilla JS
   ======================================================== */

// Global State
let activeTab = 'dashboard';
let tokenVal = localStorage.getItem('wss_admin_token');
let refreshTokenVal = localStorage.getItem('wss_admin_refresh_token');
let currentUser = localStorage.getItem('wss_admin_user') || 'Admin';
let leadsListGlobal = [];
let chartTrafficInstance = null;
let chartBrowserInstance = null;

// Auth check on init
if (!tokenVal && window.location.pathname.indexOf('login.html') === -1) {
  window.location.href = './login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // Init Icons
  lucide.createIcons();
  
  // Set current meta
  document.getElementById('sidebarProfileName').textContent = currentUser;
  document.getElementById('navbarUsername').textContent = currentUser;
  
  // Event listeners init
  setupCoreUIListeners();
  loadTabContent(activeTab);
  
  // Start server status simulated socket tickers (Phase 5 real-time metrics emulation)
  startDiagnosticTickers();
});

// ========================================================
// CORE NAV & UI HANDLERS
// ========================================================
function setupCoreUIListeners() {
  // Sidebar tab click routers
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const tab = item.getAttribute('data-tab');
      activeTab = tab;
      loadTabContent(tab);
    });
  });

  // Collapsible sidebar toggle button
  const sidebar = document.getElementById('sidebar');
  document.getElementById('sidebarCollapseBtn').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
  document.getElementById('menuToggleBtn').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // Global search input handling (CMD/ctrl search bar)
  document.getElementById('globalSearchInput').addEventListener('input', (e) => {
    const searchVal = e.target.value.toLowerCase();
    if (activeTab === 'leads') {
      renderLeadsList(leadsListGlobal.filter(l => 
        l.name.toLowerCase().includes(searchVal) || 
        l.phone.toLowerCase().includes(searchVal) || 
        (l.email && l.email.toLowerCase().includes(searchVal))
      ));
    }
  });

  // Fullscreen trigger
  document.getElementById('fullscreenToggleBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {});
    } else {
      document.exitFullscreen();
    }
  });

  // Notifications bell dropdown
  const bellBtn = document.getElementById('notificationBellBtn');
  const notifDropdown = document.getElementById('notificationDropdown');
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('hidden');
    document.getElementById('languageDropdown').classList.add('hidden');
    document.getElementById('profileDropdown').classList.add('hidden');
  });

  // Language selection dropdown
  const langBtn = document.getElementById('languageBtn');
  const langDropdown = document.getElementById('languageDropdown');
  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langDropdown.classList.toggle('hidden');
    notifDropdown.classList.add('hidden');
    document.getElementById('profileDropdown').classList.add('hidden');
  });

  // Language selectors click
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      document.querySelectorAll('.lang-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      showToast(`Language switched to: ${opt.textContent}`, 'success');
      langDropdown.classList.add('hidden');
    });
  });

  // Profile dropdown
  document.getElementById('userPill').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('profileDropdown').classList.toggle('hidden');
    notifDropdown.classList.add('hidden');
    langDropdown.classList.add('hidden');
  });

  // Dismiss dropdowns on document click
  document.addEventListener('click', () => {
    notifDropdown.classList.add('hidden');
    langDropdown.classList.add('hidden');
    document.getElementById('profileDropdown').classList.add('hidden');
  });

  // Sidebar signout
  document.getElementById('sidebarLogoutBtn').addEventListener('click', handleLogout);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // General settings general submission
  document.getElementById('settingsGeneralForm').addEventListener('submit', handleSettingsSubmit);
  
  // Leads category filter pills
  document.querySelectorAll('#leadsCategoryFilter .pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#leadsCategoryFilter .pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.getAttribute('data-category');
      if (cat === 'All') {
        renderLeadsList(leadsListGlobal);
      } else {
        renderLeadsList(leadsListGlobal.filter(l => l.category === cat));
      }
    });
  });

  // DB Backup trigger button
  document.getElementById('createBackupBtn').addEventListener('click', triggerDatabaseBackup);

  // Global escape shortcut to clear search
  window.addEventListener('keydown', (e) => {
    if (e.key === '/') {
      const searchInput = document.getElementById('globalSearchInput');
      if (document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    }
  });

  // Modals dismiss handlers
  document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('leadModal').classList.add('hidden');
  });
  document.getElementById('closeUserModalBtn').addEventListener('click', () => {
    document.getElementById('userModal').classList.add('hidden');
  });
  document.getElementById('closeSliderModalBtn').addEventListener('click', () => {
    document.getElementById('sliderModal').classList.add('hidden');
  });
}

// ========================================================
// TOAST NOTIFICATIONS HELPER
// ========================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const alertBox = document.createElement('div');
  alertBox.className = `toast-alert ${type}`;
  
  const iconName = type === 'success' ? 'check-circle' : 'alert-triangle';
  alertBox.innerHTML = `
    <i data-lucide="${iconName}" style="width: 16px; height: 16px;"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(alertBox);
  lucide.createIcons();
  
  setTimeout(() => {
    alertBox.style.opacity = '0';
    alertBox.style.transform = 'translateY(15px)';
    setTimeout(() => alertBox.remove(), 300);
  }, 4000);
}

// ========================================================
// SECURE FETCH WRAPPER
// ========================================================
async function secureFetch(url, options = {}) {
  options.headers = options.headers || {};
  options.headers['Content-Type'] = 'application/json';
  if (tokenVal) {
    options.headers['Authorization'] = `Bearer ${tokenVal}`;
  }
  
  // Read CSRF Token from cookie
  const getCsrf = () => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; csrfToken=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  };
  options.headers['X-CSRF-Token'] = getCsrf();

  let response = await fetch(url, options);

  // If unauthorized, rotate token using refresh token
  if (response.status === 401 && refreshTokenVal) {
    console.warn('⚠️ Access Token expired. Rotating tokens...');
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refreshTokenVal })
    });
    
    if (refreshRes.ok) {
      const refreshResult = await refreshRes.json();
      tokenVal = refreshResult.token;
      localStorage.setItem('wss_admin_token', tokenVal);
      
      // Retry request with rotated token
      options.headers['Authorization'] = `Bearer ${tokenVal}`;
      response = await fetch(url, options);
    } else {
      // Rotation failed, redirect to login
      handleLogout();
    }
  }

  return response;
}

// ========================================================
// REAL-TIME STATS TICKERS (Phase 5 real-time mock monitoring)
// ========================================================
function startDiagnosticTickers() {
  setInterval(() => {
    const randomCpu = Math.floor(Math.random() * 25) + 12; // 12% to 37%
    const randomRam = Math.floor(Math.random() * 15) + 40; // 40% to 55%
    
    const cpuVal = document.getElementById('widgetCpu');
    const ramVal = document.getElementById('widgetRam');
    const cpuFill = document.getElementById('widgetCpuProgress');
    const ramFill = document.getElementById('widgetRamProgress');

    if (cpuVal) cpuVal.textContent = `${randomCpu}%`;
    if (ramVal) ramVal.textContent = `${randomRam}%`;
    
    if (cpuFill) cpuFill.style.width = `${randomCpu}%`;
    if (ramFill) ramFill.style.width = `${randomRam}%`;

    // Dynamic Chart Update (update Chart.js datasets)
    if (chartTrafficInstance) {
      const data = chartTrafficInstance.data.datasets[0].data;
      data.shift();
      data.push(Math.floor(Math.random() * 300) + 150);
      chartTrafficInstance.update();
    }
  }, 3000);
}

// ========================================================
// TAB LOAD SWITCH ROUTER
// ========================================================
function loadTabContent(tab) {
  document.getElementById('breadcrumbActive').textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
  
  // Hide all sections
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  
  const activePane = document.getElementById(`tab-${tab}`);
  if (activePane) activePane.classList.add('active');

  switch (tab) {
    case 'dashboard':
      fetchDashboardData();
      break;
    case 'leads':
      fetchLeadsData();
      break;
    case 'cms':
      fetchCMSData();
      break;
    case 'media':
      fetchMediaData();
      break;
    case 'users':
      fetchUsersData();
      break;
    case 'logs':
      fetchLogsData('activity');
      break;
    case 'backups':
      fetchBackupsData();
      break;
  }
}

// ========================================================
// PHASE 2: DASHBOARD STATS & CHART BINDINGS
// ========================================================
async function fetchDashboardData() {
  try {
    const response = await secureFetch('/api/admin/stats');
    const data = await response.json();
    
    document.getElementById('widgetLiveUsers').textContent = data.stats.liveUsers || '4';
    document.getElementById('widgetTotalLeads').textContent = data.stats.leads || '0';
    document.getElementById('widgetCpu').textContent = data.stats.cpu || '18%';
    document.getElementById('widgetRam').textContent = data.stats.ram || '41%';

    // Build timeline activities list
    const timelineList = document.getElementById('recentActivityList');
    timelineList.innerHTML = '';
    
    const logs = data.recentActivities || [];
    if (logs.length === 0) {
      timelineList.innerHTML = `<p class="text-muted text-sm">Koi recent activity record nahi mila.</p>`;
    } else {
      logs.forEach(log => {
        const date = new Date(log.created_at).toLocaleString();
        timelineList.innerHTML += `
          <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div class="timeline-meta">
              <p><strong>${log.username || 'System'}</strong>: ${log.details || log.action}</p>
              <span>${date}</span>
            </div>
          </div>
        `;
      });
    }

    // Build Chart.js metrics
    renderAnalyticsCharts();

  } catch (err) {
    console.error('Stats load failed. Applying offline display dashboard metrics fallback.');
    renderAnalyticsCharts();
  }
}

function renderAnalyticsCharts() {
  const trafficCtx = document.getElementById('trafficChart').getContext('2d');
  const browserCtx = document.getElementById('browserChart').getContext('2d');

  if (chartTrafficInstance) chartTrafficInstance.destroy();
  if (chartBrowserInstance) chartBrowserInstance.destroy();

  // Traffic Line Area Chart
  chartTrafficInstance = new Chart(trafficCtx, {
    type: 'line',
    data: {
      labels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
      datasets: [{
        label: 'Active Hits',
        data: [120, 240, 190, 310, 280, 420, 350],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' } }
      }
    }
  });

  // Browser shares Pie Donut Chart
  chartBrowserInstance = new Chart(browserCtx, {
    type: 'doughnut',
    data: {
      labels: ['Chrome', 'Safari', 'Firefox', 'Mobile App'],
      datasets: [{
        data: [55, 25, 12, 8],
        backgroundColor: ['#8b5cf6', '#ec4899', '#3b82f6', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#a1a1aa' } } }
    }
  });
}

// ========================================================
// PHASE 3: LEADS MANAGEMENT BINDINGS
// ========================================================
async function fetchLeadsData() {
  try {
    const response = await secureFetch('/api/admin/leads');
    const data = await response.json();
    leadsListGlobal = data;
    renderLeadsList(data);
  } catch (err) {
    showToast('Leads loading error occurred.', 'error');
  }
}

function renderLeadsList(leads) {
  const tbody = document.getElementById('leadsTableBody');
  tbody.innerHTML = '';
  
  if (leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;">Koi lead entries nahi mili.</td></tr>`;
    return;
  }

  leads.forEach(l => {
    const date = new Date(l.created_at).toLocaleDateString();
    
    // Status color
    const statusClass = l.status === 'Resolved' ? 'badge-green' : l.status === 'Contacted' ? 'badge-blue' : 'badge-amber';
    
    // Category mapping
    const categoryMapping = {
      'contact': 'Inquiry',
      'audit': 'Audit Request',
      'dish_billing': 'Dish Recharge',
      'ott_billing': 'OTT Recharge'
    };
    const showCategory = categoryMapping[l.category] || l.category;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${l.name}</strong></td>
      <td>
        <div>${l.phone}</div>
        <div class="text-muted text-sm">${l.email || 'N/A'}</div>
      </td>
      <td><span class="badge badge-blue">${showCategory}</span></td>
      <td>${date}</td>
      <td><span class="badge ${statusClass}">${l.status}</span></td>
      <td>
        <button class="btn btn-secondary text-sm edit-lead-btn" data-id="${l.id}">View Details</button>
      </td>
    `;
    
    row.querySelector('.edit-lead-btn').addEventListener('click', () => openLeadModalDetails(l));
    tbody.appendChild(row);
  });
}

function openLeadModalDetails(lead) {
  const modal = document.getElementById('leadModal');
  document.getElementById('modalTitle').textContent = 'Process customer lead';
  
  // Format details text
  let detailsContent = '';
  if (typeof lead.details === 'object' && lead.details !== null) {
    detailsContent = Object.entries(lead.details).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('');
  } else {
    detailsContent = `<div>${lead.details || 'No additional notes provided'}</div>`;
  }

  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div><strong>Client Name:</strong> ${lead.name}</div>
      <div><strong>Phone Link:</strong> ${lead.phone}</div>
      <div><strong>Email Link:</strong> ${lead.email || 'N/A'}</div>
      <hr style="border:0; border-top:1px solid var(--border-color);">
      <div><strong>Form Details Metadata:</strong></div>
      <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:4px; font-size:11px;">
        ${detailsContent}
      </div>
      <div class="input-group">
        <label>Workflow Status</label>
        <select id="updateLeadStatus">
          <option value="Pending" ${lead.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Contacted" ${lead.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
          <option value="Resolved" ${lead.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
        </select>
      </div>
      <div class="input-group">
        <label>Admin Resolution Notes</label>
        <textarea id="updateLeadNotes" rows="3">${lead.notes || ''}</textarea>
      </div>
    </div>
  `;

  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-danger" id="deleteLeadBtn" style="margin-right:auto;">Delete Lead</button>
    <button class="btn btn-secondary" id="cancelLeadModal">Cancel</button>
    <button class="btn btn-primary" id="saveLeadModalBtn">Save Status</button>
  `;

  modal.classList.remove('hidden');

  // Modal actions listeners
  document.getElementById('cancelLeadModal').onclick = () => modal.classList.add('hidden');
  
  document.getElementById('saveLeadModalBtn').onclick = async () => {
    const status = document.getElementById('updateLeadStatus').value;
    const notes = document.getElementById('updateLeadNotes').value;
    
    const res = await secureFetch(`/api/admin/leads/${lead.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes, category: lead.category })
    });
    
    if (res.ok) {
      showToast('Lead entry updated successfully!', 'success');
      modal.classList.add('hidden');
      fetchLeadsData();
    } else {
      showToast('Failed to update lead.', 'error');
    }
  };

  document.getElementById('deleteLeadBtn').onclick = async () => {
    if (confirm('Bhai, kya sach me ye lead delete karni hai?')) {
      const res = await secureFetch(`/api/admin/leads/${lead.id}?category=${lead.category}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Lead deleted successfully!', 'success');
        modal.classList.add('hidden');
        fetchLeadsData();
      }
    }
  };
}

// ========================================================
// PHASE 3: CMS & HOME SLIDERS
// ========================================================
async function fetchCMSData() {
  try {
    // 1. Fetch Page about us content
    const pageRes = await secureFetch('/api/cms/pages/about');
    if (pageRes.ok) {
      const page = await pageRes.json();
      document.getElementById('aboutHeroTitle').value = page.title || '';
      document.getElementById('aboutHeroSubtitle').value = page.content ? page.content.heroSubtitle : '';
      document.getElementById('aboutHistory').value = page.content ? page.content.history : '';
    }

    // 2. Fetch Sliders List
    fetchSlidersList();

  } catch(e) {
    showToast('CMS settings load error.', 'error');
  }
}

// CMS Tabs Navigation trigger click handles
document.querySelectorAll('.cms-tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.cms-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.cms-editor-pane').forEach(p => p.classList.remove('active'));
    const sec = btn.getAttribute('data-cms-section');
    document.getElementById(`cms-editor-${sec}`).classList.add('active');
  });
});

// About Form Submit
document.getElementById('aboutPageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const heroTitle = document.getElementById('aboutHeroTitle').value;
  const heroSubtitle = document.getElementById('aboutHeroSubtitle').value;
  const history = document.getElementById('aboutHistory').value;

  const res = await secureFetch('/api/cms/pages/about', {
    method: 'PUT',
    body: JSON.stringify({
      title: heroTitle,
      content: { heroSubtitle, history }
    })
  });
  if (res.ok) showToast('About Page updated successfully!', 'success');
});

// Sliders operations
async function fetchSlidersList() {
  const container = document.getElementById('slidersList');
  container.innerHTML = '<p class="text-muted">Loading sliders...</p>';
  
  try {
    const res = await secureFetch('/api/cms/sliders');
    const sliders = await res.json();
    container.innerHTML = '';
    
    if (sliders.length === 0) {
      container.innerHTML = '<p class="text-muted">No slider banners created yet.</p>';
      return;
    }

    sliders.forEach(slide => {
      const row = document.createElement('div');
      row.className = 'slide-row';
      row.innerHTML = `
        <img src="${slide.image_url}" class="slide-img-preview" alt="Banner">
        <div class="slide-info-meta">
          <span>${slide.title}</span>
          <p>${slide.subtitle || 'No subtitle'}</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary text-sm edit-slide-btn">Edit</button>
          <button class="btn btn-danger text-sm delete-slide-btn">Delete</button>
        </div>
      `;
      
      row.querySelector('.edit-slide-btn').onclick = () => openSliderModal(slide);
      row.querySelector('.delete-slide-btn').onclick = () => deleteSlide(slide.id);
      
      container.appendChild(row);
    });
  } catch(e) {}
}

document.getElementById('addSliderBtn').onclick = () => openSliderModal();

function openSliderModal(slide = null) {
  const modal = document.getElementById('sliderModal');
  document.getElementById('sliderModalTitle').textContent = slide ? 'Edit Slide Banner' : 'Create Slide Banner';
  
  document.getElementById('slideTitle').value = slide ? slide.title : '';
  document.getElementById('slideSubtitle').value = slide ? slide.subtitle : '';
  document.getElementById('slideImageUrl').value = slide ? slide.image_url : '';
  document.getElementById('slideLinkUrl').value = slide ? slide.link_url : '';
  document.getElementById('slideSortOrder').value = slide ? slide.sort_order : 0;

  modal.classList.remove('hidden');

  document.getElementById('sliderForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('slideTitle').value,
      subtitle: document.getElementById('slideSubtitle').value,
      image_url: document.getElementById('slideImageUrl').value,
      link_url: document.getElementById('slideLinkUrl').value,
      sort_order: parseInt(document.getElementById('slideSortOrder').value)
    };

    let res;
    if (slide) {
      res = await secureFetch(`/api/cms/sliders/${slide.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await secureFetch('/api/cms/sliders', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res.ok) {
      showToast('Slide banner saved successfully!', 'success');
      modal.classList.add('hidden');
      fetchSlidersList();
    }
  };
}

async function deleteSlide(id) {
  if (confirm('Bhai, kya slider delete karna hai?')) {
    const res = await secureFetch(`/api/cms/sliders/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Slide banner removed!', 'success');
      fetchSlidersList();
    }
  }
}

// ========================================================
// PHASE 3: MEDIA MANAGER INTEGRATION
// ========================================================
async function fetchMediaData() {
  const grid = document.getElementById('mediaGrid');
  grid.innerHTML = '<p class="text-muted">Loading assets list...</p>';

  try {
    const res = await secureFetch('/api/media');
    const files = await res.json();
    grid.innerHTML = '';

    if (files.length === 0) {
      grid.innerHTML = '<p class="text-muted">No uploaded assets found.</p>';
      return;
    }

    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'media-file-card';
      
      const isImg = file.mime_type && file.mime_type.startsWith('image/');
      const preview = isImg ? `<img src="${file.file_url}" alt="Img">` : `<i data-lucide="file-text"></i>`;

      card.innerHTML = `
        <div class="media-preview-container">${preview}</div>
        <div class="media-card-title">${file.filename}</div>
        <button class="media-delete-overlay" title="Delete File"><i data-lucide="trash-2" style="width:12px; height:12px;"></i></button>
      `;

      card.querySelector('.media-delete-overlay').onclick = async () => {
        if (confirm('Bhai, kya file permanently delete karni hai?')) {
          const deleteRes = await secureFetch(`/api/media/${file.id}`, { method: 'DELETE' });
          if (deleteRes.ok) {
            showToast('File removed successfully!', 'success');
            fetchMediaData();
          }
        }
      };

      grid.appendChild(card);
    });
    lucide.createIcons();

  } catch(e) {}
}

// Media Drag and drop bulk upload Base64 conversion
const uploadZone = document.getElementById('mediaUploadZone');
uploadZone.onclick = () => document.getElementById('mediaFileInput').click();

uploadZone.ondragover = (e) => { e.preventDefault(); uploadZone.style.borderColor = 'var(--primary)'; };
uploadZone.ondragleave = () => { uploadZone.style.borderColor = 'var(--border-color)'; };
uploadZone.ondrop = (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = 'var(--border-color)';
  handleBulkFiles(e.dataTransfer.files);
};

document.getElementById('mediaFileInput').onchange = (e) => {
  handleBulkFiles(e.target.files);
};

async function handleBulkFiles(files) {
  if (files.length === 0) return;
  showToast(`Uploading ${files.length} assets...`, 'info');

  for (let file of files) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result;
      const res = await secureFetch('/api/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          base64Data: base64
        })
      });
      if (res.ok) {
        showToast(`Uploaded: ${file.name}`, 'success');
        fetchMediaData();
      } else {
        showToast(`Failed to upload ${file.name}`, 'error');
      }
    };
  }
}

// ========================================================
// PHASE 4: USER & ROLE ACCOUNTS
// ========================================================
async function fetchUsersData() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Loading user accounts...</td></tr>';

  try {
    const res = await secureFetch('/api/admin/users');
    const users = await res.json();
    tbody.innerHTML = '';

    users.forEach(user => {
      const date = new Date(user.created_at).toLocaleDateString();
      const statusBadge = user.status === 'Active' ? 'badge-green' : 'badge-danger';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${user.username}</strong></td>
        <td>${user.email}</td>
        <td><span class="badge badge-blue">${user.roleName || 'Viewer'}</span></td>
        <td><span class="badge ${statusBadge}">${user.status}</span></td>
        <td>${date}</td>
        <td>
          <button class="btn btn-secondary text-sm edit-user-btn">Manage</button>
        </td>
      `;

      row.querySelector('.edit-user-btn').onclick = () => openUserManageModal(user);
      tbody.appendChild(row);
    });
  } catch(e) {}
}

document.getElementById('createUserBtn').onclick = () => openUserManageModal();

function openUserManageModal(user = null) {
  const modal = document.getElementById('userModal');
  document.getElementById('userModalTitle').textContent = user ? `Manage Account: ${user.username}` : 'Create User Account';
  
  document.getElementById('userUsername').value = user ? user.username : '';
  document.getElementById('userUsername').disabled = user ? true : false;
  document.getElementById('userEmail').value = user ? user.email : '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userRole').value = user ? user.roleId : '2';
  document.getElementById('userStatus').value = user ? user.status : 'Active';

  modal.classList.remove('hidden');

  document.getElementById('deleteUserBtn').onclick = async () => {
    if (!user) return;
    if (confirm('Bhai, kya is account ko uda dena hai?')) {
      const res = await secureFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('User account deleted successfully!', 'success');
        modal.classList.add('hidden');
        fetchUsersData();
      }
    }
  };

  document.getElementById('userForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      email: document.getElementById('userEmail').value,
      password: document.getElementById('userPassword').value,
      roleId: parseInt(document.getElementById('userRole').value),
      status: document.getElementById('userStatus').value
    };

    let res;
    if (user) {
      res = await secureFetch(`/api/admin/users/${user.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      payload.username = document.getElementById('userUsername').value;
      res = await secureFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res.ok) {
      showToast('User account details updated!', 'success');
      modal.classList.add('hidden');
      fetchUsersData();
    } else {
      const errData = await res.json();
      showToast(errData.error || 'Failed to save user info.', 'error');
    }
  };
}

// ========================================================
// PHASE 4: AUDIT LOGS SEARCH & CSV EXPORTS
// ========================================================
let logsListGlobal = [];

async function fetchLogsData(logType) {
  const tbody = document.getElementById('logsTableBody');
  const thead = document.getElementById('logsTableHeader');
  
  tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Loading logs...</td></tr>';
  
  // Set headers
  if (logType === 'activity') {
    thead.innerHTML = `
      <tr>
        <th>Performed By</th>
        <th>Action</th>
        <th>Details Info</th>
        <th>IP Address</th>
        <th>Time Logged</th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr>
        <th>Username</th>
        <th>IP Address</th>
        <th>Login Status</th>
        <th>Audit Details</th>
        <th>Time Logged</th>
      </tr>
    `;
  }

  try {
    const res = await secureFetch(`/api/admin/logs/${logType}`);
    const logs = await res.json();
    logsListGlobal = logs;
    renderLogsList(logs, logType);
  } catch(e) {}
}

function renderLogsList(logs, logType) {
  const tbody = document.getElementById('logsTableBody');
  tbody.innerHTML = '';

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;">No audit records stored.</td></tr>`;
    return;
  }

  logs.forEach(log => {
    const date = new Date(log.created_at).toLocaleString();
    const row = document.createElement('tr');
    
    if (logType === 'activity') {
      row.innerHTML = `
        <td><strong>${log.username || 'System'}</strong></td>
        <td><span class="badge badge-blue">${log.action}</span></td>
        <td>${log.details || ''}</td>
        <td>${log.ip_address || '127.0.0.1'}</td>
        <td>${date}</td>
      `;
    } else {
      const statusBadge = log.status === 'Success' ? 'badge-green' : 'badge-danger';
      row.innerHTML = `
        <td><strong>${log.username}</strong></td>
        <td>${log.ip_address || '127.0.0.1'}</td>
        <td><span class="badge ${statusBadge}">${log.status}</span></td>
        <td>${log.details || ''}</td>
        <td>${date}</td>
      `;
    }
    tbody.appendChild(row);
  });
}

// Log Tab toggles
document.querySelectorAll('.log-tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.log-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.getAttribute('data-log-type');
    fetchLogsData(type);
  });
});

// Search input for logs
document.getElementById('logSearchInput').oninput = (e) => {
  const val = e.target.value.toLowerCase();
  const activeLogType = document.querySelector('.log-tab-btn.active').getAttribute('data-log-type');
  
  const filtered = logsListGlobal.filter(log => 
    (log.username && log.username.toLowerCase().includes(val)) ||
    (log.action && log.action.toLowerCase().includes(val)) ||
    (log.details && log.details.toLowerCase().includes(val))
  );
  renderLogsList(filtered, activeLogType);
};

// Export to CSV files utility
document.getElementById('exportCsvBtn').onclick = () => {
  if (logsListGlobal.length === 0) {
    showToast('Export karne ke liye koi data nahi hai.', 'error');
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,";
  
  // Headers
  const keys = Object.keys(logsListGlobal[0]);
  csvContent += keys.join(",") + "\r\n";
  
  // Rows
  logsListGlobal.forEach(row => {
    const line = keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(",");
    csvContent += line + "\r\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `wss_audit_logs_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Logs CSV file downloaded successfully!', 'success');
};

// Export to PDF simulation
document.getElementById('exportPdfBtn').onclick = () => {
  showToast('PDF compilation compiled successfully! Printing...', 'success');
  window.print();
};

// ========================================================
// PHASE 8: BACKUP & RESTORE DATABASE
// ========================================================
async function fetchBackupsData() {
  const tbody = document.getElementById('backupsTableBody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Loading backup history...</td></tr>';

  try {
    const res = await secureFetch('/api/backup');
    const backups = await res.json();
    tbody.innerHTML = '';

    if (backups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center;">No backups created yet.</td></tr>';
      return;
    }

    backups.forEach(b => {
      const date = new Date(b.created_at).toLocaleString();
      const sizeMb = (b.file_size / 1024).toFixed(2) + ' KB';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${b.filename}</strong></td>
        <td>${sizeMb}</td>
        <td>${date}</td>
        <td>
          <button class="btn btn-secondary text-sm restore-backup-btn">Restore</button>
          <a class="btn btn-secondary text-sm" href="/api/backup/download/${b.filename}" target="_blank">Download</a>
        </td>
      `;

      row.querySelector('.restore-backup-btn').onclick = async () => {
        if (confirm('⚠️ Warning: Backup restore karne se saara data replace ho jayega. Kya aap sure hain?')) {
          showToast('Database restore process triggered...', 'info');
          const restoreRes = await secureFetch('/api/backup/restore', {
            method: 'POST',
            body: JSON.stringify({ filename: b.filename })
          });
          if (restoreRes.ok) {
            showToast('Database successfully restored!', 'success');
            loadTabContent('dashboard');
          } else {
            showToast('Restore process failed.', 'error');
          }
        }
      };

      tbody.appendChild(row);
    });
  } catch(e) {}
}

async function triggerDatabaseBackup() {
  showToast('Generating database backup dump...', 'info');
  const res = await secureFetch('/api/backup', { method: 'POST' });
  if (res.ok) {
    showToast('Database backup successfully generated!', 'success');
    fetchBackupsData();
  } else {
    showToast('Failed to trigger database backup.', 'error');
  }
}

// ========================================================
// PLATFORM SETTINGS SUBMIT
// ========================================================
async function handleSettingsSubmit(e) {
  e.preventDefault();
  const theme = document.getElementById('settingsTheme').value;
  const maintenanceMode = document.getElementById('settingsMaintenanceMode').checked ? 'true' : 'false';
  const smtpHost = document.getElementById('settingsSmtpHost').value;
  const smtpPassword = document.getElementById('settingsSmtpPassword').value;

  const res = await secureFetch('/api/cms/pages/settings', {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Websoft Solutions Settings',
      content: { theme, maintenanceMode, smtpHost, smtpPassword }
    })
  });

  if (res.ok) {
    showToast('Platform settings saved successfully!', 'success');
    if (maintenanceMode === 'true') {
      showToast('⚠️ Maintenance Mode is now ACTIVE!', 'error');
    }
  } else {
    showToast('Failed to update platform settings.', 'error');
  }
}

// ========================================================
// LOGOUT PROCESSOR
// ========================================================
function handleLogout() {
  localStorage.removeItem('wss_admin_token');
  localStorage.removeItem('wss_admin_refresh_token');
  localStorage.removeItem('wss_admin_user');
  window.location.href = './login.html';
}
