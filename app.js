// === Ultrasound Tongue DB v2 — App Logic ===

// ====== CONFIG ======
const ADMIN_PASSWORD = 'sunlab2024'; // Change this to your own password
let isAdmin = false;
let currentView = 'table'; // 'table' or 'card'
let currentSort = { field: 'date', asc: false };
let allVideos = [];

// ====== IndexedDB ======
const DB_NAME = 'ultrasound-tongue-db-v2';
const DB_VERSION = 1;
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

function dbTx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

async function getAllVideos() {
  return new Promise((resolve, reject) => {
    const request = dbTx('videos').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getVideo(id) {
  return new Promise((resolve, reject) => {
    const request = dbTx('videos').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
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
  return new Promise((resolve, reject) => {
    const request = dbTx('videos', 'readwrite').put(video);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteVideo(id) {
  return new Promise((resolve, reject) => {
    const request = dbTx('videos', 'readwrite').delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

// ====== Render ======
async function loadAndRender() {
  allVideos = await getAllVideos();
  document.getElementById('header-count').textContent = `${allVideos.length}件`;
  applyFilters();
}

function applyFilters() {
  const query = (document.getElementById('search-input').value || '').toLowerCase().trim();
  
  let filtered = allVideos;
  if (query) {
    filtered = allVideos.filter(v => {
      const searchStr = [v.title, v.phoneme, v.ipa, v.speaker, v.language, v.notes, v.date]
        .filter(Boolean).join(' ').toLowerCase();
      // Split query by spaces for multi-term search
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

function renderTableView(videos) {
  const tbody = document.getElementById('table-body');
  
  if (videos.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">データがありません。「管理」から動画を追加してください。</td></tr>`;
    return;
  }
  
  const langNames = { ja: '日本語', zh: '中国語', en: '英語', ko: '韓国語', other: 'その他' };
  
  tbody.innerHTML = videos.map((v, i) => {
    const phonemes = (v.phoneme || '').split(/[,，\s]+/).filter(Boolean)
      .map(p => `<span class="phoneme-tag">${p}</span>`).join('');
    
    const actionCol = isAdmin ? `
      <td class="col-actions">
        <button class="edit-btn" onclick="event.stopPropagation();editEntry(${v.id})" title="編集">✏️</button>
        <button class="del-btn" onclick="event.stopPropagation();deleteEntry(${v.id})" title="削除">🗑</button>
      </td>` : '';
    
    return `<tr>
      <td class="col-no">${i + 1}</td>
      <td class="col-title">${escHtml(v.title || '')}</td>
      <td class="col-phoneme">${phonemes}</td>
      <td class="col-ipa">${escHtml(v.ipa || '')}</td>
      <td class="col-lang">${langNames[v.language] || v.language || ''}</td>
      <td class="col-speaker">${escHtml(v.speaker || '')}</td>
      <td class="col-date">${v.date || ''}</td>
      <td class="col-duration">${v.duration || '-'}</td>
      <td class="col-play"><button class="play-btn" onclick="event.stopPropagation();playVideo(${v.id})">▶</button></td>
      ${actionCol}
    </tr>`;
  }).join('');
  
  // Show/hide admin columns
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  
  // Update colspan on empty
  const emptyRow = tbody.querySelector('.empty-row td');
  if (emptyRow) emptyRow.colSpan = isAdmin ? 10 : 9;
}

function renderCardView(videos) {
  const grid = document.getElementById('card-view');
  
  if (videos.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);">データがありません。</div>';
    return;
  }
  
  grid.innerHTML = videos.map(v => {
    const phonemes = (v.phoneme || '').split(/[,，\s]+/).filter(Boolean)
      .map(p => `<span class="phoneme-tag">${p}</span>`).join('');
    
    return `<div class="video-card" onclick="playVideo(${v.id})">
      <div class="video-thumb">
        <span class="play-icon-overlay">▶</span>
      </div>
      <div class="card-info">
        <div class="card-title">${escHtml(v.title || '無題')}</div>
        <div class="card-tags">${phonemes}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
          ${v.speaker ? escHtml(v.speaker) + ' · ' : ''}${v.date || ''}
        </div>
      </div>
    </div>`;
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
  document.getElementById('view-toggle').textContent = currentView === 'table' ? '📋 表格' : '🃏 卡片';
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
    document.getElementById('admin-btn').textContent = '🔒 管理';
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
    document.getElementById('admin-btn').textContent = '🔓 管理中';
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('password-modal').style.display = 'none';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    cancelEdit(); // Reset form
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
  const title = document.getElementById('form-title').value.trim();
  const phoneme = document.getElementById('form-phoneme').value.trim();
  
  if (!title || !phoneme) { alert('タイトルと音素は必須です。'); return; }
  
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
  
  // Handle file upload
  const fileInput = document.getElementById('form-file');
  const urlInput = document.getElementById('form-url').value.trim();
  
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      entry.videoData = e.target.result;
      if (editId) {
        await updateVideo(parseInt(editId), entry);
      } else {
        entry.createdAt = new Date().toISOString();
        await addVideo(entry);
      }
      cancelEdit();
      loadAndRender();
      alert('✅ 保存しました！');
    };
    reader.readAsDataURL(file);
    return;
  }
  
  if (urlInput) {
    entry.videoUrl = urlInput;
  }
  
  if (editId) {
    await updateVideo(parseInt(editId), entry);
  } else {
    entry.createdAt = new Date().toISOString();
    await addVideo(entry);
  }
  
  cancelEdit();
  loadAndRender();
  alert('✅ 保存しました！');
}

async function editEntry(id) {
  const video = await getVideo(id);
  if (!video) return;
  
  document.getElementById('form-title').value = video.title || '';
  document.getElementById('form-phoneme').value = video.phoneme || '';
  document.getElementById('form-ipa').value = video.ipa || '';
  document.getElementById('form-language').value = video.language || 'ja';
  document.getElementById('form-speaker').value = video.speaker || '';
  document.getElementById('form-date').value = video.date || '';
  document.getElementById('form-notes').value = video.notes || '';
  document.getElementById('form-url').value = video.videoUrl || '';
  document.getElementById('form-edit-id').value = id;
  document.getElementById('form-title').textContent = '✏️ 動画を編集';
  
  document.getElementById('admin-panel').scrollIntoView({ behavior: 'smooth' });
}

async function deleteEntry(id) {
  if (!confirm('この動画を削除してもよろしいですか？この操作は取り消せません。')) return;
  await deleteVideo(id);
  loadAndRender();
}

function cancelEdit() {
  document.getElementById('form-title').value = '';
  document.getElementById('form-phoneme').value = '';
  document.getElementById('form-ipa').value = '';
  document.getElementById('form-language').value = 'ja';
  document.getElementById('form-speaker').value = '';
  document.getElementById('form-date').value = '';
  document.getElementById('form-notes').value = '';
  document.getElementById('form-url').value = '';
  document.getElementById('form-file').value = '';
  document.getElementById('file-name').textContent = 'クリックして動画を選択（またはドラッグ＆ドロップ）';
  document.getElementById('form-edit-id').value = '';
  document.getElementById('form-title').textContent = '➕ 動画を追加';
}

// ====== File handling ======
document.getElementById('form-file').addEventListener('change', function() {
  const name = this.files.length > 0 ? this.files[0].name : 'クリックして動画を選択';
  document.getElementById('file-name').textContent = '📹 ' + name;
});

// Drag & Drop
const dropZone = document.querySelector('.file-drop-zone');
if (dropZone) {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      document.getElementById('form-file').files = e.dataTransfer.files;
      document.getElementById('file-name').textContent = '📹 ' + file.name;
      if (!document.getElementById('form-title').value) {
        document.getElementById('form-title').value = file.name.replace(/\.[^/.]+$/, '');
      }
    }
  });
}

// ====== Play Video ======
async function playVideo(id) {
  const video = await getVideo(id);
  if (!video) return;
  
  const modal = document.getElementById('player-modal');
  const player = document.getElementById('player-video');
  
  player.src = video.videoData || video.videoUrl || '';
  
  const langNames = { ja: '日本語', zh: '中国語', en: '英語', ko: '韓国語', other: 'その他' };
  
  document.getElementById('player-info').innerHTML = `
    <h3>${escHtml(video.title || '無題')}</h3>
    <div class="player-meta">
      <span class="phoneme-tag">🔤 ${escHtml(video.phoneme)}</span>
      ${video.ipa ? `<span class="phoneme-tag">IPA: ${escHtml(video.ipa)}</span>` : ''}
      <span class="phoneme-tag">🌐 ${langNames[video.language] || video.language}</span>
      ${video.speaker ? `<span class="phoneme-tag">👤 ${escHtml(video.speaker)}</span>` : ''}
      ${video.date ? `<span class="phoneme-tag">📅 ${video.date}</span>` : ''}
    </div>
    ${video.notes ? `<div class="player-notes">📝 ${escHtml(video.notes)}</div>` : ''}
  `;
  
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
  // Strip video data blobs for export (too large)
  const exportData = videos.map(v => {
    const { videoData, ...rest } = v;
    return rest;
  });
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ultrasound-db-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!confirm('インポートすると既存のデータに追加されます。続行しますか？')) {
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
        await addVideo(item);
        count++;
      }
      loadAndRender();
      alert(`✅ ${count}件のデータをインポートしました。`);
    } catch (err) {
      alert('❌ JSONの解析に失敗しました: ' + err.message);
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
  // Ctrl+F / Cmd+F focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    // Don't prevent default - let browser search work too
  }
});

// ====== Init ======
document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
  loadAndRender();
});
