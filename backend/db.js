const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const FILES = {
  contacts: path.join(DATA_DIR, 'contacts.json'),
  audits: path.join(DATA_DIR, 'audits.json'),
  dish_billings: path.join(DATA_DIR, 'dish_billings.json'),
  ott_billings: path.join(DATA_DIR, 'ott_billings.json'),
  admin: path.join(DATA_DIR, 'admin.json')
};

// Initialize JSON files if they don't exist
for (const [key, filePath] of Object.entries(FILES)) {
  if (!fs.existsSync(filePath)) {
    if (key === 'admin') {
      // Default admin user: admin / admin123
      fs.writeFileSync(filePath, JSON.stringify([{ id: '1', username: 'admin', password: 'admin123' }], null, 2), 'utf8');
    } else {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
    }
  }
}

function readJSON(fileKey) {
  try {
    const data = fs.readFileSync(FILES[fileKey], 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${fileKey} file:`, err);
    return [];
  }
}

function writeJSON(fileKey, data) {
  try {
    fs.writeFileSync(FILES[fileKey], JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${fileKey} file:`, err);
    return false;
  }
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

module.exports = {
  // Add a new lead
  addLead(type, data) {
    const fileKey = type.replace(/-/g, '_') + 's';
    if (!FILES[fileKey]) return null;

    const list = readJSON(fileKey);
    const newLead = {
      id: generateId(),
      ...data,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      notes: ''
    };

    list.push(newLead);
    writeJSON(fileKey, list);
    return newLead;
  },

  // Get all leads
  getLeads(type) {
    const fileKey = type.replace(/-/g, '_') + 's';
    if (!FILES[fileKey]) return [];
    return readJSON(fileKey);
  },

  // Update a lead (status, notes)
  updateLead(type, id, updates) {
    const fileKey = type.replace(/-/g, '_') + 's';
    if (!FILES[fileKey]) return null;

    const list = readJSON(fileKey);
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return null;

    list[idx] = {
      ...list[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    writeJSON(fileKey, list);
    return list[idx];
  },

  // Delete a lead
  deleteLead(type, id) {
    const fileKey = type.replace(/-/g, '_') + 's';
    if (!FILES[fileKey]) return false;

    const list = readJSON(fileKey);
    const filtered = list.filter(item => item.id !== id);
    if (list.length === filtered.length) return false;

    writeJSON(fileKey, filtered);
    return true;
  },

  // Get stats for all types
  getStats() {
    const contacts = readJSON('contacts');
    const audits = readJSON('audits');
    const dish = readJSON('dish_billings');
    const ott = readJSON('ott_billings');

    const allLeads = [
      ...contacts.map(l => ({ ...l, type: 'contact' })),
      ...audits.map(l => ({ ...l, type: 'request-audit' })),
      ...dish.map(l => ({ ...l, type: 'dish-billing' })),
      ...ott.map(l => ({ ...l, type: 'ott-billing' }))
    ];

    const pending = allLeads.filter(l => l.status === 'Pending').length;
    const contacted = allLeads.filter(l => l.status === 'Contacted').length;
    const completed = allLeads.filter(l => l.status === 'Completed').length;

    return {
      counts: {
        contacts: contacts.length,
        audits: audits.length,
        dish_billings: dish.length,
        ott_billings: ott.length,
        total: allLeads.length
      },
      status: {
        pending,
        contacted,
        completed
      }
    };
  },

  // Authenticate admin
  authenticateAdmin(username, password) {
    const admins = readJSON('admin');
    return admins.find(a => a.username === username && a.password === password);
  }
};
