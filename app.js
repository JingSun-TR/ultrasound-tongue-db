// === Ultrasound Tongue DB v3 — App Logic ===
// Fixes:
//   1. Title sync: renamed form-title (h3→form-heading, input→form-title-input)
//   2. Multi-language: i18n via t() from i18n.js
//   3. Unlimited storage: local video server mode (+ IndexedDB fallback)
//   4. Data persistence: IndexedDB metadata survives all code updates

// ====== CONFIG ======
const ADMIN_PASSWORD = 'sunlab2024';
const VIDEO_SERVER_URL = 'http://localhost:8765';
const VIDEO_SERVER_DIR = '/videos/';
let isAdmin = false;
let currentView = 'table';
let currentSort = { field: 'date', asc: false };
let allVideos = [];
let serverAvailable = false;   // true = local video server mode (unlimited)

// ====== IndexedDB (metadata only in server mode) ======
const DB_NAME = 'ultrasound-tongue-db-v3';
const DB_VERSION = 2;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('videos')) {
        const store = db.createObjectStore('videos', { keyPath: 'id', autoIncrement: true });
        store.createIndex('phoneme', 'phoneme', { unique: false });
        store.createIndex('language', 'language', { unique: false });
        store.createIndex('speaker', 'speaker', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    request.onsuccess = (e) => { db = e.target.result; resolve(db); };
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbTx(storeName, mode) {
  return db.transaction(storeName, mode || 'readonly').objectStore(storeName);
}

async function getAllVideos() {
  return new Promise((resolve, reject) => {
    const request = dbTx('videos').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getVideo(id) {
  const numId = typeof id === 'string' ? parseInt(id) : id;
  return new Promise((resolve, reject) => {
    // Try by primary key first
    const request1 = dbTx('videos').get(numId);
    request1.onsuccess = () => {
      if (request1.result) {
        resolve(request1.result);
      } else {
        // Fallback: search by id field (for repo-synced entries)
        const store = dbTx('videos');
        const request2 = store.openCursor();
        request2.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.id === numId) {
              const result = cursor.value;
              result._dbKey = cursor.primaryKey;
              resolve(result);
              return;
            }
            cursor.continue();
          } else {
            resolve(null);
          }
        };
        request2.onerror = (e) => reject(e.target.error);
      }
    };
    request1.onerror = (e) => reject(e.target.error);
  });
}

async function addVideo(video) {
  return new Promise((resolve, reject) => {
    const request = dbTx('videos', 'readwrite').add(video);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function updateVideo(id, updates) {
  const video = await getVideo(id);
  if (!video) throw new Error('Video not found');
  Object.assign(video, updates);
  const key = video._dbKey || id;
  return new Promise((resolve, reject) => {
    const request = dbTx('videos', 'readwrite').put(video, key);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteVideo(id) {
  const video = await getVideo(id);
  // If in server mode, try to delete the file from server
  if (serverAvailable && video && video.videoPath) {
    try {
      await fetch(VIDEO_SERVER_URL + '/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: video.videoPath })
      });
    } catch (e) { /* best effort */ }
  }
  const key = video ? (video._dbKey || id) : id;
  return new Promise((resolve, reject) => {
    const request = dbTx('videos', 'readwrite').delete(key);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

// ====== Video Server Check ======
async function checkVideoServer() {
  try {
    const resp = await fetch(VIDEO_SERVER_URL + '/api/status');
    if (resp.ok) {
      const data = await resp.json();
      serverAvailable = true;
      document.getElementById('storage-info').textContent =
        t('storageLabel') + (data.disk_free || t('storageUnlimited'));
      console.log('Video server detected — unlimited storage mode');
      return true;
    }
  } catch (e) { /* server not running, fall back to IndexedDB */ }
  serverAvailable = false;
  // Show IndexedDB quota
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    const used = (est.usage / (1024*1024)).toFixed(1);
    const quota = (est.quota / (1024*1024)).toFixed(0);
    document.getElementById('storage-info').textContent =
      'IndexedDB: ' + used + 'MB / ' + quota + 'MB';
  } else {
    document.getElementById('storage-info').textContent = 'IndexedDB storage';
  }
  return false;
}

// Request persistent storage for IndexedDB mode
async function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    const persisted = await navigator.storage.persisted();
    if (!persisted) {
      await navigator.storage.persist();
    }
  }
}

// ====== Render ======
async function loadAndRender() {
  allVideos = await getAllVideos();
  document.getElementById('header-count').textContent = allVideos.length +
    (currentLang === 'ja' ? '件' : currentLang === 'zh' ? '条' : ' videos');
  applyFilters();
}

// ====== Repo Sync: load data/videos.json from repo ======
const REPO_DATA_URL = 'data/videos.json';
let repoDataLoaded = false;

async function syncFromRepo() {
  if (repoDataLoaded) return;
  try {
    const resp = await fetch(REPO_DATA_URL + '?v=' + Date.now());
    if (!resp.ok) return;
    const repoVideos = await resp.json();
    if (!Array.isArray(repoVideos) || repoVideos.length === 0) return;

    const existing = await getAllVideos();
    const titleDateMap = new Map();
    for (const v of existing) {
      const key = (v.title || '') + '|' + (v.date || '');
      titleDateMap.set(key, v);
    }

    let added = 0, updated = 0;
    for (const item of repoVideos) {
      const key = (item.title || '') + '|' + (item.date || '');
      const existingEntry = titleDateMap.get(key);

      if (existingEntry) {
        // Update existing entry if repo has videoUrl and local doesn't
        if (item.videoUrl && !existingEntry.videoUrl) {
          await updateVideo(existingEntry.id, {
            videoUrl: item.videoUrl,
            videoPath: item.videoPath,
            fileSize: item.fileSize
          });
          updated++;
        }
      } else {
        // Add new entry
        item.createdAt = item.createdAt || new Date().toISOString();
        await addVideo(item);
        added++;
      }
    }
    if (added > 0 || updated > 0) {
      console.log('Repo sync: ' + added + ' added, ' + updated + ' updated');
    }
    repoDataLoaded = true;
  } catch (e) {
    console.warn('Repo sync skipped:', e.message);
  }
}

async function exportForRepo() {
  const videos = await getAllVideos();
  const exportData = videos.map(v => {
    const { videoData, id, ...rest } = v;
    return rest;
  });
  return JSON.stringify(exportData, null, 2);
}

function applyFilters() {
  const query = (document.getElementById('search-input').value || '').toLowerCase().trim();

  let filtered = allVideos;
  if (query) {
    filtered = allVideos.filter(v => {
      const searchStr = [v.title, v.phoneme, v.ipa, v.speaker, v.language, v.notes, v.date]
        .filter(Boolean).join(' ').toLowerCase();
      const terms = query.split(/\s+/).filter(Boolean);
      return terms.every(term => searchStr.includes(term));
    });
  }

  // Sort
  const field = currentSort.field;
  filtered.sort((a, b) => {
    const va = (a[field] || '').toString().toLowerCase();
    const vb = (b[field] || '').toString().toLowerCase();
    if (va < vb) return currentSort.asc ? -1 : 1;
    if (va > vb) return currentSort.asc ? 1 : -1;
    return 0;
  });

  renderTableView(filtered);
  renderCardView(filtered);
}

function langName(code) {
  const map = { ja: 'lang_ja', zh: 'lang_zh', en: 'lang_en', ko: 'lang_ko', other: 'lang_other' };
  return t(map[code] || 'lang_other');
}

function renderTableView(videos) {
  const tbody = document.getElementById('table-body');

  if (videos.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="11">' + t('noData') + '</td></tr>';
    return;
  }

  tbody.innerHTML = videos.map((v, i) => {
    const phonemes = (v.phoneme || '').split(/[,，\s]+/).filter(Boolean)
      .map(p => '<span class="phoneme-tag">' + escHtml(p) + '</span>').join('');

    const actionCol = isAdmin ?
      '<td class="col-actions">' +
        '<button class="edit-btn" onclick="event.stopPropagation();editEntry(' + v.id + ')" title="✏️">✏️</button>' +
        '<button class="del-btn" onclick="event.stopPropagation();deleteEntry(' + v.id + ')" title="🗑">🗑</button>' +
      '</td>' : '';

    return '<tr>' +
      '<td class="col-no">' + (i + 1) + '</td>' +
      '<td class="col-title">' + escHtml(v.title || '') + '</td>' +
      '<td class="col-phoneme">' + phonemes + '</td>' +
      '<td class="col-ipa">' + escHtml(v.ipa || '') + '</td>' +
      '<td class="col-lang">' + langName(v.language) + '</td>' +
      '<td class="col-speaker">' + escHtml(v.speaker || '') + '</td>' +
      '<td class="col-date">' + (v.date || '') + '</td>' +
      '<td class="col-duration">' + (v.duration || '-') + '</td>' +
      '<td class="col-play"><button class="play-btn" onclick="event.stopPropagation();playVideo(' + v.id + ')">▶</button></td>' +
      '<td class="col-size">' + (v.fileSize || '-') + '</td>' +
      actionCol +
    '</tr>';
  }).join('');

  // Show/hide admin columns
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
}

function renderCardView(videos) {
  const grid = document.getElementById('card-view');

  if (videos.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);">' +
      t('noData') + '</div>';
    return;
  }

  grid.innerHTML = videos.map(v => {
    const phonemes = (v.phoneme || '').split(/[,，\s]+/).filter(Boolean)
      .map(p => '<span class="phoneme-tag">' + escHtml(p) + '</span>').join('');

    // Show thumbnail: server mode, videoUrl, or nothing
    let thumbContent = '<span class="play-icon-overlay">▶</span>';
    if (serverAvailable && v.videoPath) {
      thumbContent = '<video src="' + VIDEO_SERVER_URL + VIDEO_SERVER_DIR + encodeURIComponent(v.videoPath) +
        '#t=0.1" preload="metadata" muted style="width:100%;height:100%;object-fit:cover;" onmouseover="this.play()" onmouseout="this.pause();this.currentTime=0"></video>' +
        '<span class="play-icon-overlay">▶</span>';
    } else if (v.videoUrl) {
      thumbContent = '<video src="' + escHtml(v.videoUrl) +
        '#t=0.1" preload="metadata" muted style="width:100%;height:100%;object-fit:cover;" onmouseover="this.play()" onmouseout="this.pause();this.currentTime=0"></video>' +
        '<span class="play-icon-overlay">▶</span>';
    }

    return '<div class="video-card" onclick="playVideo(' + v.id + ')">' +
      '<div class="video-thumb">' + thumbContent + '</div>' +
      '<div class="card-info">' +
        '<div class="card-title">' + escHtml(v.title || t('untitled')) + '</div>' +
        '<div class="card-tags">' + phonemes + '</div>' +
        '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">' +
          (v.speaker ? escHtml(v.speaker) + ' · ' : '') + (v.date || '') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ====== View Toggle ======
function toggleView() {
  currentView = currentView === 'table' ? 'card' : 'table';
  document.getElementById('table-view').style.display = currentView === 'table' ? '' : 'none';
  document.getElementById('card-view').style.display = currentView === 'card' ? '' : 'none';
  document.getElementById('view-toggle').innerHTML =
    currentView === 'table' ? '📋 ' + t('tableView') : '🃏 ' + t('cardView');
  applyFilters();
}

// ====== Sort ======
function sortBy(field) {
  if (currentSort.field === field) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.field = field;
    currentSort.asc = true;
  }
  applyFilters();
}

// ====== Admin ======
function toggleAdmin() {
  if (isAdmin) {
    isAdmin = false;
    document.getElementById('admin-btn').classList.remove('active');
    document.getElementById('admin-btn').innerHTML = '🔒 ' + t('adminBtn');
    document.getElementById('admin-panel').style.display = 'none';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    applyFilters();
  } else {
    document.getElementById('password-modal').style.display = 'flex';
    document.getElementById('admin-password').value = '';
    document.getElementById('password-error').style.display = 'none';
  }
}

function verifyAdmin() {
  const pw = document.getElementById('admin-password').value;
  if (pw === ADMIN_PASSWORD) {
    isAdmin = true;
    document.getElementById('admin-btn').classList.add('active');
    document.getElementById('admin-btn').innerHTML = '🔓 ' + t('adminActive');
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('password-modal').style.display = 'none';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    cancelEdit();
    applyFilters();
  } else {
    document.getElementById('password-error').style.display = 'block';
    document.getElementById('admin-password').value = '';
  }
}

function closePasswordModal() {
  document.getElementById('password-modal').style.display = 'none';
}

// ====== CRUD Operations ======
async function saveEntry() {
  const title = document.getElementById('form-title-input').value.trim();
  const phoneme = document.getElementById('form-phoneme').value.trim();

  if (!title || !phoneme) { alert(t('titleRequired')); return; }

  const editId = document.getElementById('form-edit-id').value;
  const entry = {
    title,
    phoneme,
    ipa: document.getElementById('form-ipa').value.trim(),
    language: document.getElementById('form-language').value,
    speaker: document.getElementById('form-speaker').value.trim(),
    date: document.getElementById('form-date').value,
    notes: document.getElementById('form-notes').value.trim(),
  };

  const fileInput = document.getElementById('form-file');
  const urlInput = document.getElementById('form-url').value.trim();

  // Upload via local server (unlimited mode)
  if (serverAvailable && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    try {
      const formData = new FormData();
      formData.append('file', file);
      const oldVideo = editId ? await getVideo(parseInt(editId)) : null;
      if (editId && oldVideo) formData.append('oldPath', oldVideo.videoPath || '');

      const resp = await fetch(VIDEO_SERVER_URL + '/api/upload', { method: 'POST', body: formData });
      if (!resp.ok) throw new Error('Upload failed: ' + resp.status);
      const result = await resp.json();
      entry.videoPath = result.path;
      entry.fileSize = formatSize(file.size);
    } catch (e) {
      alert('❌ Server upload failed: ' + e.message + '\nFalling back to IndexedDB...');
      // Fall through to IndexedDB storage
      return saveToIndexedDB(editId, entry, fileInput.files[0]);
    }
    await persistEntry(editId, entry);
    cancelEdit();
    loadAndRender();
    alert(t('saved'));
    return;
  }

  // Server mode with URL
  if (serverAvailable && urlInput) {
    entry.videoUrl = urlInput;
    // If it's a local path, normalize
    if (urlInput.startsWith('/') || urlInput.startsWith('./')) {
      entry.videoPath = urlInput.replace(/^\.\//, '');
      entry.videoUrl = VIDEO_SERVER_URL + VIDEO_SERVER_DIR + encodeURIComponent(entry.videoPath);
    }
  } else if (urlInput) {
    entry.videoUrl = urlInput;
  }

  // IndexedDB blob mode
  if (!serverAvailable && fileInput.files.length > 0) {
    return saveToIndexedDB(editId, entry, fileInput.files[0]);
  }

  await persistEntry(editId, entry);
  cancelEdit();
  loadAndRender();
  alert(t('saved'));
}

function saveToIndexedDB(editId, entry, file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    entry.videoData = e.target.result;
    entry.fileSize = formatSize(file.size);
    await persistEntry(editId, entry);
    cancelEdit();
    loadAndRender();
    alert(t('saved'));
  };
  reader.readAsDataURL(file);
}

async function persistEntry(editId, entry) {
  if (editId) {
    await updateVideo(parseInt(editId), entry);
  } else {
    entry.createdAt = new Date().toISOString();
    await addVideo(entry);
  }
}

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  if (bytes < 1024*1024*1024) return (bytes/(1024*1024)).toFixed(1) + ' MB';
  return (bytes/(1024*1024*1024)).toFixed(2) + ' GB';
}

async function editEntry(id) {
  const video = await getVideo(id);
  if (!video) return;

  document.getElementById('form-title-input').value = video.title || '';
  document.getElementById('form-phoneme').value = video.phoneme || '';
  document.getElementById('form-ipa').value = video.ipa || '';
  document.getElementById('form-language').value = video.language || 'ja';
  document.getElementById('form-speaker').value = video.speaker || '';
  document.getElementById('form-date').value = video.date || '';
  document.getElementById('form-notes').value = video.notes || '';
  document.getElementById('form-url').value = video.videoUrl || video.videoPath || '';
  document.getElementById('form-edit-id').value = id;
  document.getElementById('form-heading').innerHTML = '✏️ ' + t('editVideo');
  document.getElementById('file-name').textContent = t('fileDropHint');

  document.getElementById('admin-panel').scrollIntoView({ behavior: 'smooth' });
}

async function deleteEntry(id) {
  if (!confirm(t('deleteConfirm'))) return;
  await deleteVideo(id);
  loadAndRender();
}

function cancelEdit() {
  document.getElementById('form-title-input').value = '';
  document.getElementById('form-phoneme').value = '';
  document.getElementById('form-ipa').value = '';
  document.getElementById('form-language').value = 'ja';
  document.getElementById('form-speaker').value = '';
  document.getElementById('form-date').value = '';
  document.getElementById('form-notes').value = '';
  document.getElementById('form-url').value = '';
  document.getElementById('form-file').value = '';
  document.getElementById('file-name').textContent = t('fileDropHint');
  document.getElementById('form-edit-id').value = '';
  document.getElementById('form-heading').innerHTML = '➕ ' + t('addVideo');
}

// ====== File handling ======
function onFileSelected() {
  const fileInput = document.getElementById('form-file');
  const name = fileInput.files.length > 0 ? t('fileSelected') + fileInput.files[0].name : t('fileDropHint');
  document.getElementById('file-name').textContent = name;
  // Auto-fill title from filename
  if (fileInput.files.length > 0) {
    const fileName = fileInput.files[0].name.replace(/\.[^/.]+$/, '');
    const titleInput = document.getElementById('form-title-input');
    if (!titleInput.value) {
      titleInput.value = fileName;
    }
  }
}

// Drag & Drop
const dropZone = document.getElementById('file-drop-zone');
if (dropZone) {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      document.getElementById('form-file').files = e.dataTransfer.files;
      document.getElementById('file-name').textContent = t('fileSelected') + file.name;
      const titleInput = document.getElementById('form-title-input');
      if (!titleInput.value) {
        titleInput.value = file.name.replace(/\.[^/.]+$/, '');
      }
    }
  });
}

// ====== Play Video ======
async function playVideo(id) {
  const numId = parseInt(id);
  const video = allVideos.find(v => v.id === numId);
  if (!video) return;

  const modal = document.getElementById('player-modal');
  const player = document.getElementById('player-video');

  // Determine video source
  let src = '';
  if (video.videoUrl) {
    src = video.videoUrl;
  } else if (serverAvailable && video.videoPath) {
    src = VIDEO_SERVER_URL + VIDEO_SERVER_DIR + encodeURIComponent(video.videoPath);
  } else if (video.videoData) {
    src = video.videoData;
  }

  if (!src) {
    player.removeAttribute('src');
    player.style.display = 'none';
    document.getElementById('player-info').innerHTML =
      '<h3>' + escHtml(video.title || t('untitled')) + '</h3>' +
      '<p style="color:#ff6b6b;margin-top:20px;font-size:16px">No video source available</p>';
    modal.style.display = 'flex';
    return;
  }

  player.style.display = '';
  player.src = src;
  player.load();

  document.getElementById('player-info').innerHTML =
    '<h3>' + escHtml(video.title || t('untitled')) + '</h3>' +
    '<div class="player-meta">' +
      '<span class="phoneme-tag">🔤 ' + escHtml(video.phoneme) + '</span>' +
      (video.ipa ? '<span class="phoneme-tag">IPA: ' + escHtml(video.ipa) + '</span>' : '') +
      '<span class="phoneme-tag">🌐 ' + langName(video.language) + '</span>' +
      (video.speaker ? '<span class="phoneme-tag">👤 ' + escHtml(video.speaker) + '</span>' : '') +
      (video.date ? '<span class="phoneme-tag">📅 ' + video.date + '</span>' : '') +
    '</div>' +
    (video.notes ? '<div class="player-notes">📝 ' + escHtml(video.notes) + '</div>' : '');

  modal.style.display = 'flex';
  player.play().catch(() => {});
}

function closePlayer() {
  document.getElementById('player-modal').style.display = 'none';
  const player = document.getElementById('player-video');
  player.pause();
  player.src = '';
}

// ====== Export / Import ======
async function exportData() {
  const videos = await getAllVideos();
  // Strip video binary data for export
  const exportData = videos.map(v => {
    const { videoData, ...rest } = v;
    return rest;
  });

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ultrasound-db-export-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);

  // Also offer to download as data/videos.json (repo-ready)
  setTimeout(() => {
    if (confirm(t('exportRepoPrompt') || 'Also download as data/videos.json for repo sync?')) {
      const repoBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const repoUrl = URL.createObjectURL(repoBlob);
      const a2 = document.createElement('a');
      a2.href = repoUrl;
      a2.download = 'videos.json';
      a2.click();
      URL.revokeObjectURL(repoUrl);
    }
  }, 500);
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm(t('importConfirmExisting'))) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      let count = 0;
      for (const item of data) {
        item.createdAt = item.createdAt || new Date().toISOString();
        // Don't import videoData blobs — they're stripped on export
        // videoPath/videoUrl remain intact
        await addVideo(item);
        count++;
      }
      loadAndRender();
      alert('✅ ' + count + t('imported'));
    } catch (err) {
      alert(t('importFail') + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ====== Keyboard Shortcuts ======
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePlayer();
    closePasswordModal();
  }
});

// ====== Init ======
document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  await requestPersistence();
  await checkVideoServer();
  document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
  await loadAndRender();
  // Load repo data in background (never deletes existing data)
  syncFromRepo().then(() => loadAndRender());
});
