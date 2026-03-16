/* ============================================================
   VΞLTRIX — script.js
   Storage: IndexedDB — videos persist permanently across
   page closes, refreshes, and browser restarts.
   No file size limit. No re-upload needed. Ever.
   ============================================================ */

'use strict';

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  OWNER_PASSWORD: 'veltrix2024',  // ← Change this password!
  DB_NAME:        'VeltrixDB',
  DB_VERSION:     1,
  STORE_VIDEOS:   'videos',
};

// ── State ─────────────────────────────────────────────────
let state = {
  db:             null,   // IndexedDB instance
  videos:         [],     // lightweight metadata array (no blobs)
  filteredVideos: [],
  pendingAction:  null,
  currentVideoId: null,
  currentBlobUrl: null,   // active object URL — revoked on player close
  selectedFile:   null,
  selectedThumb:  null,
  authenticated:  false,
};

// ── DOM Refs ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  uploadTriggerBtn:   $('uploadTriggerBtn'),
  navUploadBtn:       $('navUploadBtn'),
  searchInput:        $('searchInput'),
  statCount:          $('statCount'),
  videoGrid:          $('videoGrid'),
  videoCount:         $('videoCount'),
  emptyState:         $('emptyState'),
  playerModal:        $('playerModal'),
  closePlayer:        $('closePlayer'),
  videoPlayer:        $('videoPlayer'),
  playerTitle:        $('playerTitle'),
  playerDate:         $('playerDate'),
  deleteCurrentVideo: $('deleteCurrentVideo'),
  passwordModal:      $('passwordModal'),
  closePassword:      $('closePassword'),
  passwordInput:      $('passwordInput'),
  confirmPassword:    $('confirmPassword'),
  pwError:            $('pwError'),
  uploadModal:        $('uploadModal'),
  closeUpload:        $('closeUpload'),
  dropZone:           $('dropZone'),
  videoFileInput:     $('videoFileInput'),
  thumbFileInput:     $('thumbFileInput'),
  thumbName:          $('thumbName'),
  uploadPreview:      $('uploadPreview'),
  previewVideo:       $('previewVideo'),
  previewFilename:    $('previewFilename'),
  previewSize:        $('previewSize'),
  videoTitleInput:    $('videoTitleInput'),
  submitUpload:       $('submitUpload'),
  progressWrap:       $('progressWrap'),
  progressFill:       $('progressFill'),
  progressLabel:      $('progressLabel'),
  toast:              $('toast'),
};

// ── Inject dynamic styles ─────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
@keyframes shake {
  0%,100%{ transform:translateX(0) }
  20%    { transform:translateX(-8px) }
  40%    { transform:translateX(8px) }
  60%    { transform:translateX(-5px) }
  80%    { transform:translateX(5px) }
}
</style>`);

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, type = 'success', ms = 3200) {
  dom.toast.textContent = msg;
  dom.toast.className   = `toast ${type} show`;
  setTimeout(() => { dom.toast.className = 'toast'; }, ms);
}

// ── Utilities ─────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function formatBytes(b) {
  if (b < 1024)       return b + ' B';
  if (b < 1048576)    return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function animateCounter(el, target) {
  let cur = parseInt(el.textContent) || 0;
  const step = Math.max(1, Math.ceil(Math.abs(target - cur) / 20));
  const t = setInterval(() => {
    cur = target > cur ? Math.min(cur + step, target) : Math.max(cur - step, target);
    el.textContent = cur;
    if (cur === target) clearInterval(t);
  }, 40);
}
function escapeHTML(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

// ── Modal helpers ─────────────────────────────────────────
const openModal  = el => el.classList.add('active');
const closeModal = el => el.classList.remove('active');

// ── IndexedDB Layer ───────────────────────────────────────

/** Open (or create) the VeltrixDB database */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CONFIG.STORE_VIDEOS)) {
        const store = db.createObjectStore(CONFIG.STORE_VIDEOS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

/** Write a full video record (including Blob) to IndexedDB */
function dbSaveVideo(record) {
  return new Promise((resolve, reject) => {
    const tx    = state.db.transaction(CONFIG.STORE_VIDEOS, 'readwrite');
    const store = tx.objectStore(CONFIG.STORE_VIDEOS);
    const req   = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror   = e  => reject(e.target.error);
  });
}

/** Load all records sorted newest-first (blobs included — needed for openPlayer) */
function dbLoadAllVideos() {
  return new Promise((resolve, reject) => {
    const tx    = state.db.transaction(CONFIG.STORE_VIDEOS, 'readonly');
    const store = tx.objectStore(CONFIG.STORE_VIDEOS);
    const req   = store.getAll();
    req.onsuccess = e => {
      const sorted = (e.target.result || []).sort((a, b) => b.createdAt - a.createdAt);
      resolve(sorted);
    };
    req.onerror = e => reject(e.target.error);
  });
}

/** Fetch a single record by id (used when opening the player) */
function dbGetVideo(id) {
  return new Promise((resolve, reject) => {
    const tx    = state.db.transaction(CONFIG.STORE_VIDEOS, 'readonly');
    const store = tx.objectStore(CONFIG.STORE_VIDEOS);
    const req   = store.get(id);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

/** Remove a record from IndexedDB */
function dbDeleteVideo(id) {
  return new Promise((resolve, reject) => {
    const tx    = state.db.transaction(CONFIG.STORE_VIDEOS, 'readwrite');
    const store = tx.objectStore(CONFIG.STORE_VIDEOS);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e  => reject(e.target.error);
  });
}

// ── Password Gate ─────────────────────────────────────────
function requirePassword(action, callback) {
  if (state.authenticated) { callback(); return; }
  state.pendingAction = { action, callback };
  dom.pwError.textContent = '';
  dom.passwordInput.value = '';
  openModal(dom.passwordModal);
  setTimeout(() => dom.passwordInput.focus(), 300);
}

function handlePasswordConfirm() {
  if (dom.passwordInput.value === CONFIG.OWNER_PASSWORD) {
    state.authenticated = true;
    closeModal(dom.passwordModal);
    dom.pwError.textContent = '';
    state.pendingAction?.callback();
    state.pendingAction = null;
  } else {
    dom.pwError.textContent = '✕ Incorrect password. Try again.';
    dom.passwordInput.value = '';
    dom.passwordInput.focus();
    dom.passwordInput.style.animation = 'none';
    void dom.passwordInput.offsetHeight;
    dom.passwordInput.style.animation = 'shake 0.4s ease';
    setTimeout(() => { dom.passwordInput.style.animation = ''; }, 400);
  }
}

// ── Render Gallery ────────────────────────────────────────
function renderGallery(videos) {
  dom.videoGrid.innerHTML = '';

  if (!videos.length) {
    dom.emptyState.classList.add('visible');
    dom.videoCount.textContent = '0 videos';
    return;
  }

  dom.emptyState.classList.remove('visible');
  dom.videoCount.textContent = `${videos.length} video${videos.length !== 1 ? 's' : ''}`;

  videos.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.style.animationDelay = `${i * 0.05}s`;

    const thumbHTML = v.thumb
      ? `<img src="${v.thumb}" alt="${escapeHTML(v.title)}" loading="lazy" />`
      : `<div class="thumb-placeholder">▶</div>`;

    card.innerHTML = `
      <div class="card-thumb">
        ${thumbHTML}
        <div class="card-play"><div class="card-play-btn">▶</div></div>
        <span class="card-badge">${v.size || ''}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHTML(v.title)}</div>
        <div class="card-meta">
          <span>${formatDate(v.createdAt)}</span>
          <span class="card-dot">•</span>
          <span>${v.size || 'Video'}</span>
        </div>
      </div>`;

    card.addEventListener('click', () => openPlayer(v.id));
    dom.videoGrid.appendChild(card);
  });
}

// ── Video Player ──────────────────────────────────────────
async function openPlayer(id) {
  try {
    // Pull the full record (with Blob) from IndexedDB
    const record = await dbGetVideo(id);
    if (!record || !record.videoBlob) {
      showToast('Video not found in storage.', 'error');
      return;
    }

    // Revoke the previous blob URL to free memory
    if (state.currentBlobUrl) URL.revokeObjectURL(state.currentBlobUrl);

    // Create a fresh playable URL from the stored Blob
    state.currentBlobUrl = URL.createObjectURL(record.videoBlob);
    state.currentVideoId = id;

    dom.playerTitle.textContent = record.title;
    dom.playerDate.textContent  = `Uploaded on ${formatDate(record.createdAt)}`;
    dom.videoPlayer.src         = state.currentBlobUrl;
    dom.videoPlayer.load();

    openModal(dom.playerModal);
    setTimeout(() => dom.videoPlayer.play().catch(() => {}), 300);

  } catch (err) {
    console.error('openPlayer error:', err);
    showToast('Failed to load video.', 'error');
  }
}

function closePlayer() {
  dom.videoPlayer.pause();
  dom.videoPlayer.removeAttribute('src');
  dom.videoPlayer.load();

  if (state.currentBlobUrl) {
    URL.revokeObjectURL(state.currentBlobUrl);
    state.currentBlobUrl = null;
  }

  state.currentVideoId = null;
  closeModal(dom.playerModal);
}

// ── Delete Video ──────────────────────────────────────────
function deleteVideo(id) {
  requirePassword('delete', async () => {
    try {
      await dbDeleteVideo(id);
      state.videos = state.videos.filter(v => v.id !== id);
      refreshAll();
      closePlayer();
      showToast('Video deleted.', 'error');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Could not delete video.', 'error');
    }
  });
}

// ── Upload Logic ──────────────────────────────────────────
function openUploadPanel() {
  resetUploadForm();
  openModal(dom.uploadModal);
}

function resetUploadForm() {
  state.selectedFile  = null;
  state.selectedThumb = null;
  dom.videoFileInput.value        = '';
  dom.thumbFileInput.value        = '';
  dom.thumbName.textContent       = 'No file chosen';
  dom.videoTitleInput.value       = '';
  dom.uploadPreview.style.display = 'none';
  dom.previewVideo.src            = '';
  dom.progressWrap.style.display  = 'none';
  dom.progressFill.style.width    = '0%';
  dom.dropZone.style.display      = 'block';
  dom.submitUpload.disabled       = false;
}

function handleVideoFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    showToast('Please select a valid video file.', 'error');
    return;
  }
  state.selectedFile = file;

  // Use object URL just for the preview player
  const previewUrl = URL.createObjectURL(file);
  dom.previewVideo.src            = previewUrl;
  dom.previewFilename.textContent = file.name;
  dom.previewSize.textContent     = formatBytes(file.size);
  dom.uploadPreview.style.display = 'block';
  dom.dropZone.style.display      = 'none';

  if (!dom.videoTitleInput.value) {
    dom.videoTitleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }
}

function animateProgress(steps) {
  return new Promise(resolve => {
    dom.progressWrap.style.display = 'block';
    dom.progressFill.style.width   = '0%';
    dom.progressLabel.textContent  = steps[0].label;

    let pct = 0, idx = 0;
    const iv = setInterval(() => {
      pct += Math.random() * 6 + 2;
      while (idx < steps.length && pct >= steps[idx].at) {
        dom.progressLabel.textContent = steps[idx].label;
        idx++;
      }
      if (pct >= 100) {
        pct = 100;
        dom.progressFill.style.width = '100%';
        clearInterval(iv);
        setTimeout(resolve, 300);
      } else {
        dom.progressFill.style.width = pct + '%';
      }
    }, 55);
  });
}

async function handleUploadSubmit() {
  const title = dom.videoTitleInput.value.trim();
  if (!state.selectedFile) { showToast('Please select a video file first.', 'error'); return; }
  if (!title)              { dom.videoTitleInput.focus(); showToast('Please enter a title.', 'error'); return; }

  dom.submitUpload.disabled = true;

  try {
    const progressJob = animateProgress([
      { at: 20,  label: 'Reading file…' },
      { at: 50,  label: 'Saving to storage…' },
      { at: 80,  label: 'Finalizing…' },
      { at: 100, label: 'Done!' },
    ]);

    // Thumbnail → base64 (small image, safe)
    const thumbBase64 = state.selectedThumb
      ? await fileToBase64(state.selectedThumb)
      : null;

    // Build the record — videoBlob is stored natively by IndexedDB (no base64!)
    const record = {
      id:        uid(),
      title:     title,
      videoBlob: state.selectedFile,  // Raw Blob → IndexedDB stores it as binary
      thumb:     thumbBase64,
      size:      formatBytes(state.selectedFile.size),
      createdAt: Date.now(),
    };

    // Save to IndexedDB and wait for the progress animation simultaneously
    await Promise.all([dbSaveVideo(record), progressJob]);

    // Push a lightweight copy (no blob) into the in-memory list for the gallery
    const { videoBlob, ...meta } = record;
    state.videos.unshift(meta);

    refreshAll();
    closeModal(dom.uploadModal);
    showToast(`"${title}" saved permanently! 🎬`, 'success');

  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload failed. Try a different file.', 'error');
    dom.submitUpload.disabled = false;
  }
}

// ── Search ────────────────────────────────────────────────
function handleSearch(query) {
  const q = query.trim().toLowerCase();
  state.filteredVideos = q
    ? state.videos.filter(v => v.title.toLowerCase().includes(q))
    : [...state.videos];
  renderGallery(state.filteredVideos);
}

// ── Refresh UI ────────────────────────────────────────────
function refreshAll() {
  const q = dom.searchInput.value.trim().toLowerCase();
  state.filteredVideos = q
    ? state.videos.filter(v => v.title.toLowerCase().includes(q))
    : [...state.videos];
  renderGallery(state.filteredVideos);
  animateCounter(dom.statCount, state.videos.length);
}

// ── Drag & Drop ───────────────────────────────────────────
function initDragDrop() {
  const zone = dom.dropZone;
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file) handleVideoFile(file);
  });
  zone.addEventListener('click', e => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
      dom.videoFileInput.click();
    }
  });
}

// ── Events ────────────────────────────────────────────────
function bindEvents() {
  dom.uploadTriggerBtn.addEventListener('click', () => requirePassword('upload', openUploadPanel));
  dom.navUploadBtn.addEventListener('click', e => {
    e.preventDefault();
    requirePassword('upload', openUploadPanel);
  });

  dom.closePassword.addEventListener('click', () => closeModal(dom.passwordModal));
  dom.confirmPassword.addEventListener('click', handlePasswordConfirm);
  dom.passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') handlePasswordConfirm(); });

  dom.closeUpload.addEventListener('click', () => closeModal(dom.uploadModal));
  dom.videoFileInput.addEventListener('change', e => handleVideoFile(e.target.files?.[0]));
  dom.thumbFileInput.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) { state.selectedThumb = f; dom.thumbName.textContent = f.name; }
  });
  dom.submitUpload.addEventListener('click', handleUploadSubmit);

  dom.closePlayer.addEventListener('click', closePlayer);
  dom.deleteCurrentVideo.addEventListener('click', () => {
    if (state.currentVideoId) deleteVideo(state.currentVideoId);
  });

  [dom.passwordModal, dom.uploadModal, dom.playerModal].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal === dom.playerModal ? closePlayer() : closeModal(modal);
      }
    });
  });

  dom.searchInput.addEventListener('input', e => handleSearch(e.target.value));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (dom.playerModal.classList.contains('active'))   closePlayer();
      if (dom.uploadModal.classList.contains('active'))   closeModal(dom.uploadModal);
      if (dom.passwordModal.classList.contains('active')) closeModal(dom.passwordModal);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      dom.searchInput.focus();
    }
  });

  initDragDrop();
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  try {
    // 1. Open IndexedDB
    state.db = await openDB();

    // 2. Load all stored video records
    const records = await dbLoadAllVideos();

    // 3. Keep only metadata in memory — blobs are fetched on demand when playing
    state.videos = records.map(({ videoBlob, ...meta }) => meta);

    // 4. Bind UI events and render
    bindEvents();
    refreshAll();

    console.log(
      '%cVΞLTRIX ready 🚀  |  IndexedDB active  |  ' + state.videos.length + ' video(s) loaded',
      'color:#00f0ff;font-family:monospace;font-size:13px;font-weight:bold;'
    );

  } catch (err) {
    console.error('Init failed:', err);
    showToast('Storage error. Please refresh.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
