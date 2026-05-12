// === Ultrasound Tongue DB — App Logic ===

// IndexedDB setup
const DB_NAME = 'ultrasound-tongue-db';
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

async function getAllVideos() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readonly');
    const store = tx.objectStore('videos');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function addVideoToDB(video) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    const request = store.add(video);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteVideoFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

// ====== Render ======
async function renderVideos() {
  const videos = await getAllVideos();
  const grid = document.getElementById('video-grid');
  
  // Apply filters
  const filterPhoneme = document.getElementById('filter-phoneme').value;
  const filterLanguage = document.getElementById('filter-language').value;
  const filterSpeaker = document.getElementById('filter-speaker').value;
  const filterDate = document.getElementById('filter-date').value;
  
  let filtered = videos;
  if (filterPhoneme) filtered = filtered.filter(v => v.phoneme.includes(filterPhoneme));
  if (filterLanguage) filtered = filtered.filter(v => v.language === filterLanguage);
  if (filterSpeaker) filtered = filtered.filter(v => v.speaker === filterSpeaker);
  if (filterDate) filtered = filtered.filter(v => v.date === filterDate);
  
  // Update stats
  document.getElementById('total-videos').textContent = videos.length;
  const allPhonemes = new Set(videos.flatMap(v => v.phoneme.split(/[,，\s]+/).filter(Boolean)));
  document.getElementById('total-phonemes').textContent = allPhonemes.size;
  const allSpeakers = new Set(videos.map(v => v.speaker).filter(Boolean));
  document.getElementById('total-speakers').textContent = allSpeakers.size;
  
  // Update filter dropdowns
  updateFilterOptions(videos, allPhonemes, allSpeakers);
  
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📹</div>
      <h3>${videos.length === 0 ? '暂无视频' : '没有匹配的视频'}</h3>
      <p>${videos.length === 0 ? '点击下方「添加视频」上传超声波影像' : '尝试调整筛选条件'}</p>
    </div>`;
    return;
  }
  
  grid.innerHTML = filtered.map(v => `
    <div class="video-card" onclick="playVideo(${v.id})">
      <div class="video-thumb">
        ${v.thumbnailUrl ? `<img src="${v.thumbnailUrl}" style="width:100%;height:100%;object-fit:cover;">` : ''}
        <span class="play-icon">▶</span>
      </div>
      <div class="video-info">
        <div class="video-title">${v.title || '无标题'}</div>
        <div class="video-meta">
          <span class="video-tag">🔤 ${v.phoneme}</span>
          <span class="video-tag">🌐 ${v.language}</span>
          ${v.speaker ? `<span class="video-tag">👤 ${v.speaker}</span>` : ''}
          ${v.date ? `<span class="video-tag">📅 ${v.date}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function updateFilterOptions(videos, phonemes, speakers) {
  // Phoneme filter
  const phonemeSelect = document.getElementById('filter-phoneme');
  const currentPhoneme = phonemeSelect.value;
  phonemeSelect.innerHTML = '<option value="">全部音素</option>' + 
    [...phonemes].sort().map(p => `<option value="${p}">${p}</option>`).join('');
  phonemeSelect.value = currentPhoneme;
  
  // Speaker filter
  const speakerSelect = document.getElementById('filter-speaker');
  const currentSpeaker = speakerSelect.value;
  speakerSelect.innerHTML = '<option value="">全部发音人</option>' + 
    [...speakers].sort().map(s => `<option value="${s}">${s}</option>`).join('');
  speakerSelect.value = currentSpeaker;
}

// ====== Play Video ======
async function playVideo(id) {
  const videos = await getAllVideos();
  const video = videos.find(v => v.id === id);
  if (!video) return;
  
  const modal = document.getElementById('player-modal');
  const playerVideo = document.getElementById('player-video');
  
  if (video.videoUrl) {
    playerVideo.src = video.videoUrl;
    // Don't set .src for blob URLs
  } else if (video.videoData) {
    playerVideo.src = video.videoData;
  }
  
  document.getElementById('player-info').innerHTML = `
    <h3>${video.title || '无标题'}</h3>
    <div class="player-meta">
      <span class="video-tag">🔤 ${video.phoneme}</span>
      <span class="video-tag">🌐 ${video.language}</span>
      ${video.speaker ? `<span class="video-tag">👤 ${video.speaker}</span>` : ''}
      ${video.date ? `<span class="video-tag">📅 ${video.date}</span>` : ''}
    </div>
    ${video.notes ? `<p style="margin-top:12px;font-size:0.85rem;color:var(--text-secondary);">${video.notes}</p>` : ''}
    <button class="btn btn-danger btn-sm" style="margin-top:12px;" onclick="event.stopPropagation();deleteVideo(${video.id})">🗑 删除</button>
  `;
  
  modal.style.display = 'flex';
  playerVideo.play().catch(() => {});
}

function closePlayer() {
  document.getElementById('player-modal').style.display = 'none';
  document.getElementById('player-video').pause();
}

async function deleteVideo(id) {
  if (!confirm('确定要删除这个视频吗？')) return;
  await deleteVideoFromDB(id);
  closePlayer();
  renderVideos();
}

// ====== Add Video ======
async function addVideo() {
  const title = document.getElementById('upload-title').value.trim();
  const phoneme = document.getElementById('upload-phoneme').value.trim();
  
  if (!title || !phoneme) {
    alert('请填写视频标题和音素');
    return;
  }
  
  const video = {
    title,
    phoneme,
    language: document.getElementById('upload-language').value,
    speaker: document.getElementById('upload-speaker').value.trim(),
    date: document.getElementById('upload-date').value || new Date().toISOString().split('T')[0],
    notes: document.getElementById('upload-notes').value.trim(),
    createdAt: new Date().toISOString()
  };
  
  // Handle file upload
  const fileInput = document.getElementById('upload-file');
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      video.videoData = e.target.result;
      await addVideoToDB(video);
      clearForm();
      renderVideos();
      alert('✅ 视频已添加！');
    };
    reader.readAsDataURL(file);
    return;
  }
  
  // Handle URL
  const url = document.getElementById('upload-url').value.trim();
  if (url) {
    video.videoUrl = url;
  } else {
    alert('请选择视频文件或输入视频链接');
    return;
  }
  
  await addVideoToDB(video);
  clearForm();
  renderVideos();
  alert('✅ 视频已添加到数据库！');
}

function clearForm() {
  document.getElementById('upload-title').value = '';
  document.getElementById('upload-phoneme').value = '';
  document.getElementById('upload-speaker').value = '';
  document.getElementById('upload-notes').value = '';
  document.getElementById('upload-url').value = '';
  document.getElementById('upload-file').value = '';
}

// ====== Filter Events ======
document.getElementById('filter-phoneme').addEventListener('change', renderVideos);
document.getElementById('filter-language').addEventListener('change', renderVideos);
document.getElementById('filter-speaker').addEventListener('change', renderVideos);
document.getElementById('filter-date').addEventListener('change', renderVideos);

// ====== Drag & Drop ======
const uploadCard = document.querySelector('.upload-card');
uploadCard.addEventListener('dragover', (e) => { e.preventDefault(); uploadCard.style.borderColor = 'var(--accent)'; });
uploadCard.addEventListener('dragleave', () => { uploadCard.style.borderColor = ''; });
uploadCard.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadCard.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('video/')) {
    document.getElementById('upload-file').files = e.dataTransfer.files;
    document.getElementById('upload-title').value = file.name.replace(/\.[^/.]+$/, '');
  }
});

// ====== Init ======
document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  
  // Set default date to today
  document.getElementById('upload-date').value = new Date().toISOString().split('T')[0];
  
  renderVideos();
});
