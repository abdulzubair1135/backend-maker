// Authentication Check
const token = localStorage.getItem('wss_admin_token');
const user = localStorage.getItem('wss_admin_user');

if (!token && !window.location.pathname.endsWith('login.html')) {
  window.location.href = './login.html';
}

if (user && document.getElementById('adminUsername')) {
  document.getElementById('adminUsername').textContent = user;
}

// Global State
let allLeads = [];
let filteredLeads = [];
let currentCategory = 'All';
let currentStatus = 'All';
let activeLead = null;

// DOM Elements
const leadsList = document.getElementById('leadsList');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const categoryFilters = document.getElementById('categoryFilters');
const statusFilters = document.getElementById('statusFilters');

// Stats Elements
const statTotal = document.getElementById('statTotal');
const statPending = document.getElementById('statPending');
const statContacted = document.getElementById('statContacted');
const statCompleted = document.getElementById('statCompleted');
const leadsCount = document.getElementById('leadsCount');

// Modal Elements
const leadModal = document.getElementById('leadModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalContactedBtn = document.getElementById('modalContactedBtn');
const modalCompletedBtn = document.getElementById('modalCompletedBtn');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    fetchStats();
    fetchLeads();
    setupEventListeners();
  }
});

// Setup Event Listeners
function setupEventListeners() {
  // Refresh
  refreshBtn.addEventListener('click', () => {
    fetchStats();
    fetchLeads();
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('wss_admin_token');
    localStorage.removeItem('wss_admin_user');
    window.location.href = './login.html';
  });

  // Category Filter Pills
  categoryFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('pill')) {
      document.querySelectorAll('#categoryFilters .pill').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.getAttribute('data-category');
      applyFilters();
    }
  });

  // Status Filter Pills
  statusFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('pill')) {
      document.querySelectorAll('#statusFilters .pill').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      currentStatus = e.target.getAttribute('data-status');
      applyFilters();
    }
  });

  // Stats cards click filter
  document.querySelectorAll('.stats-grid .stat-card').forEach(card => {
    card.addEventListener('click', () => {
      const status = card.getAttribute('data-status');
      // Set active status pill
      document.querySelectorAll('#statusFilters .pill').forEach(p => {
        if (p.getAttribute('data-status') === status) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
      currentStatus = status;
      applyFilters();
    });
  });

  // Modal actions
  closeModalBtn.addEventListener('click', () => leadModal.classList.add('hidden'));
  
  // Close modal on click outside
  leadModal.addEventListener('click', (e) => {
    if (e.target === leadModal) {
      leadModal.classList.add('hidden');
    }
  });

  modalContactedBtn.addEventListener('click', () => updateLeadStatus('Contacted'));
  modalCompletedBtn.addEventListener('click', () => updateLeadStatus('Completed'));
  modalDeleteBtn.addEventListener('click', deleteActiveLead);
}

// Fetch Stats
async function fetchStats() {
  try {
    const response = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    const data = await response.json();
    
    statTotal.textContent = data.counts.total;
    statPending.textContent = data.status.pending;
    statContacted.textContent = data.status.contacted;
    statCompleted.textContent = data.status.completed;
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

// Fetch Leads
async function fetchLeads() {
  try {
    const response = await fetch('/api/admin/leads', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('wss_admin_token');
      window.location.href = './login.html';
      return;
    }
    if (!response.ok) throw new Error('Failed to fetch leads');
    allLeads = await response.json();
    applyFilters();
  } catch (err) {
    console.error('Error fetching leads:', err);
    leadsList.innerHTML = `<div class="empty-state glass"><h3>Error loading leads</h3><p>${err.message}</p></div>`;
  }
}

// Map Lead Category to DB Type
function getDbType(category) {
  switch (category) {
    case 'Contact Inquiry': return 'contact';
    case 'Audit Request': return 'audit';
    case 'DishTV Billing': return 'dish-billing';
    case 'OTT Subscription': return 'ott-billing';
    default: return '';
  }
}

// Apply Filters
function applyFilters() {
  filteredLeads = allLeads.filter(lead => {
    const matchesCategory = currentCategory === 'All' || lead.category === currentCategory;
    const matchesStatus = currentStatus === 'All' || lead.status === currentStatus;
    return matchesCategory && matchesStatus;
  });

  leadsCount.textContent = filteredLeads.length;
  renderLeadsList();
}

// Render Leads List
function renderLeadsList() {
  if (filteredLeads.length === 0) {
    leadsList.innerHTML = `
      <div class="empty-state glass">
        <div class="empty-icon">📁</div>
        <h3>No leads match your filter</h3>
        <p>Try selecting a different category or status.</p>
      </div>
    `;
    return;
  }

  leadsList.innerHTML = '';
  filteredLeads.forEach(lead => {
    const item = document.createElement('div');
    item.className = 'lead-item glass';
    item.addEventListener('click', () => openLeadModal(lead));

    const dateStr = new Date(lead.createdAt).toLocaleString();
    const statusClass = `badge-status-${lead.status.toLowerCase()}`;
    
    // Amount or sub info
    let rightCol = '';
    if (lead.amount) {
      rightCol = `<div class="lead-amount">₹${lead.amount}</div>`;
    } else if (lead.plan) {
      rightCol = `<div class="lead-amount" style="font-size: 14px; color: var(--text-muted)">Plan: ${lead.plan}</div>`;
    }

    // Detail preview
    let detailPreview = lead.message || lead.details || lead.address || '';
    if (lead.services && lead.services.length > 0) {
      detailPreview = `Services requested: ${lead.services.join(', ')}. ${detailPreview}`;
    }

    item.innerHTML = `
      <div class="lead-left">
        <div class="lead-meta">
          <span class="badge badge-category">${lead.category}</span>
          <span class="badge badge-status ${statusClass}">${lead.status}</span>
          <span class="lead-date">${dateStr}</span>
        </div>
        <div class="lead-name">${lead.name}</div>
        <div class="lead-contact-info">
          <span>📞 ${lead.phone}</span>
          ${lead.email ? `<span>✉️ ${lead.email}</span>` : ''}
        </div>
        ${detailPreview ? `<div class="lead-preview-text">${detailPreview}</div>` : ''}
      </div>
      <div class="lead-right">
        ${rightCol}
      </div>
    `;
    leadsList.appendChild(item);
  });
}

// Open Lead Details Modal
function openLeadModal(lead) {
  activeLead = lead;
  modalTitle.textContent = `${lead.category} Details`;
  
  // Customize status buttons
  modalContactedBtn.classList.toggle('hidden', lead.status === 'Contacted');
  modalCompletedBtn.classList.toggle('hidden', lead.status === 'Completed');

  const dateStr = new Date(lead.createdAt).toLocaleString();
  const dbType = getDbType(lead.category);

  let dynamicDetails = '';
  if (lead.category === 'Contact Inquiry') {
    dynamicDetails = `
      <div class="detail-item">
        <span class="detail-label">Subject</span>
        <span class="detail-value">${lead.subject || 'N/A'}</span>
      </div>
      <div class="detail-item full-width">
        <span class="detail-label">Requested Services</span>
        <span class="detail-value">${lead.services && lead.services.length ? lead.services.join(', ') : 'None specified'}</span>
      </div>
      <div class="detail-item full-width">
        <span class="detail-label">Message</span>
        <span class="detail-value" style="white-space: pre-wrap;">${lead.message || 'No message'}</span>
      </div>
    `;
  } else if (lead.category === 'Audit Request') {
    dynamicDetails = `
      <div class="detail-item">
        <span class="detail-label">Company</span>
        <span class="detail-value">${lead.company || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Division / Service</span>
        <span class="detail-value">${lead.division || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Request Type</span>
        <span class="detail-value">${lead.requestType || 'N/A'}</span>
      </div>
      <div class="detail-item full-width">
        <span class="detail-label">Details</span>
        <span class="detail-value" style="white-space: pre-wrap;">${lead.details || 'No details'}</span>
      </div>
    `;
  } else if (lead.category === 'DishTV Billing') {
    dynamicDetails = `
      <div class="detail-item">
        <span class="detail-label">Viewing Card (VC) Number</span>
        <span class="detail-value" style="font-weight: 700; color: #f59e0b;">${lead.vcNumber || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Plan ID / Name</span>
        <span class="detail-value">${lead.plan || 'N/A'}</span>
      </div>
      <div class="detail-item full-width">
        <span class="detail-label">Installation Address</span>
        <span class="detail-value">${lead.address || 'N/A'}</span>
      </div>
    `;
  } else if (lead.category === 'OTT Subscription') {
    dynamicDetails = `
      <div class="detail-item">
        <span class="detail-label">Package Purchased</span>
        <span class="detail-value" style="font-weight: 700; color: #a855f7;">${lead.packName || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Amount Paid</span>
        <span class="detail-value" style="font-weight: 700; color: #10b981;">₹${lead.amount || '0'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Payment Method</span>
        <span class="detail-value">${lead.paymentMethod || 'UPI'}</span>
      </div>
      <div class="detail-item full-width">
        <span class="detail-label">Billing/Delivery Address</span>
        <span class="detail-value">${lead.address || 'N/A'}</span>
      </div>
    `;
  }

  modalBody.innerHTML = `
    <div class="modal-detail-grid">
      <div class="detail-item">
        <span class="detail-label">Customer Name</span>
        <span class="detail-value">${lead.name}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Phone Number</span>
        <span class="detail-value"><a href="tel:${lead.phone}" style="color: #60a5fa; text-decoration: none;">📞 ${lead.phone}</a></span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Email Address</span>
        <span class="detail-value">${lead.email ? `<a href="mailto:${lead.email}" style="color: #60a5fa; text-decoration: none;">✉️ ${lead.email}</a>` : 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Date Submitted</span>
        <span class="detail-value">${dateStr}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Current Status</span>
        <span class="detail-value"><span class="badge badge-status badge-status-${lead.status.toLowerCase()}">${lead.status}</span></span>
      </div>
      
      ${dynamicDetails}

      <div class="detail-item full-width">
        <span class="detail-label">Admin Notes (Saves automatically)</span>
        <textarea id="modalNotes" class="input-group notes-area" placeholder="Add custom notes here...">${lead.notes || ''}</textarea>
      </div>
    </div>
  `;

  // Attach auto-save to notes
  const notesTextarea = document.getElementById('modalNotes');
  let saveTimeout;
  notesTextarea.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        await fetch(`/api/admin/leads/${dbType}/${lead.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ notes: notesTextarea.value })
        });
        // Update local state
        const idx = allLeads.findIndex(l => l.id === lead.id && l.category === lead.category);
        if (idx !== -1) allLeads[idx].notes = notesTextarea.value;
      } catch (err) {
        console.error('Error saving notes:', err);
      }
    }, 1000);
  });

  leadModal.classList.remove('hidden');
}

// Update Lead Status
async function updateLeadStatus(newStatus) {
  if (!activeLead) return;
  const dbType = getDbType(activeLead.category);
  
  try {
    const response = await fetch(`/api/admin/leads/${dbType}/${activeLead.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) throw new Error('Failed to update status');
    
    // Update local state
    const idx = allLeads.findIndex(l => l.id === activeLead.id && l.category === activeLead.category);
    if (idx !== -1) {
      allLeads[idx].status = newStatus;
      activeLead = allLeads[idx];
    }

    // Refresh UI
    applyFilters();
    fetchStats();
    
    // Reopen modal to show updated status
    openLeadModal(activeLead);
  } catch (err) {
    alert(err.message);
  }
}

// Delete Lead
async function deleteActiveLead() {
  if (!activeLead) return;
  if (!confirm(`Are you sure you want to delete lead from "${activeLead.name}"?`)) return;

  const dbType = getDbType(activeLead.category);

  try {
    const response = await fetch(`/api/admin/leads/${dbType}/${activeLead.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Failed to delete lead');

    // Remove from local state
    allLeads = allLeads.filter(l => !(l.id === activeLead.id && l.category === activeLead.category));
    
    // Close modal & refresh UI
    leadModal.classList.add('hidden');
    applyFilters();
    fetchStats();
    activeLead = null;
  } catch (err) {
    alert(err.message);
  }
}
