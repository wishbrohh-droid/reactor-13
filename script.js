/* ============================================================
   VΞLTRIX — script.js
   Full streaming platform logic
   ============================================================ */

'use strict';

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  OWNER_PASSWORD: 'veltrix2024',   // ← Change this password!
  STORAGE_KEY:    'veltrix_videos',
};

// ── State ─────────────────────────────────────────────────
let state = {
  videos:          [],          // all stored videos
  filteredVideos:  [],          // search-filtered subset
  pendingAction:   null,        // 'upload' | 'delete'
  currentVideoId:  null,        // id of video open in player
  selectedFile:    null,        // File object from input
  selectedThumb:   null,        // File object for thumbnail
  authenticated:   false,       // session auth flag
};

// ── DOM Refs ──────────────────────────────────────────────
const $ = id => document.getElementById(id);

const dom = {
  // Header / search
  uploadTriggerBtn: $('uploadTriggerBtn'),
  navUploadBtn:     $('navUploadBtn'),
  searchInput:      $('searchInput'),

  // Hero stats
  statCount:     $('statCount'),

  // Gallery
  videoGrid:     $('videoGrid'),
  videoCount:    $('videoCount'),
  emptyState:    $('emptyState'),

  // Player modal
  playerModal:   $('playerModal'),
  closePlayer:   $('closePlayer'),
  videoPlayer:   $('videoPlayer'),
  playerTitle:   $('playerTitle'),
  playerDate:    $('playerDate'),
  deleteCurrentVideo: $('deleteCurrentVideo'),

  // Password modal
  passwordModal: $('passwordModal'),
  closePassword: $('closePassword'),
  passwordInput: $('passwordInput'),
  confirmPassword: $('confirmPassword'),
  pwError:       $('pwError'),

  // Upload modal
  uploadModal:   $('uploadModal'),
  closeUpload:   $('closeUpload'),
  dropZone:      $('dropZone'),
  videoFileInput: $('videoFileInput'),
  thumbFileInput: $('thumbFileInput'),
  thumbName:     $('thumbName'),
  uploadPreview: $('uploadPreview'),
  previewVideo:  $('previewVideo'),
  previewFilename: $('previewFilename'),
  previewSize:   $('previewSize'),
  videoTitleInput: $('videoTitleInput'),
  submitUpload:  $('submitUpload'),
  progressWrap:  $('progressWrap'),
  progressFill:  $('progressFill'),
  progressLabel: $('progressLabel'),

  // Toast
  toast: $('toast'),
};

// ── Toast ─────────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3000) {
  const t = dom.toast;
  t.textContent = message;
  t.className   = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, duration);
}

// ── Local Storage ─────────────────────────────────────────
/** Load videos array from localStorage */
function loadVideos() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    state.videos = raw ? JSON.parse(raw) : [];
  } catch {
    state.videos = [];
  }
}

/** Persist videos array to localStorage */
function saveVideos() {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.videos));
  } catch (e) {
    // localStorage quota exceeded — store without base64 blobs as fallback
    console.warn('Storage quota exceeded.', e);
    showToast('Storage limit reached — older data may be affected.', 'error');
  }
}

// ── Utility helpers ───────────────────────────────────────
/** Generate a unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Format bytes to human-readable string */
function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/** Format date to readable string */
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** Convert File to base64 data URL */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Animate a counter from 0 to target */
function animateCounter(el, target) {
  const step = Math.max(1, Math.ceil(target / 30));
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

// ── Modal helpers ─────────────────────────────────────────
function openModal(overlay)  { overlay.classList.add('active'); }
function closeModal(overlay) { overlay.classList.remove('active'); }

// ── Password Gate ─────────────────────────────────────────
/**
 * Show password prompt. On success, run the callback.
 * If already authenticated in this session, skip the prompt.
 */
function requirePassword(action, callback) {
  if (state.authenticated) {
    callback();
    return;
  }
  state.pendingAction = { action, callback };
  dom.pwError.textContent = '';
  dom.passwordInput.value = '';
  openModal(dom.passwordModal);
  setTimeout(() => dom.passwordInput.focus(), 300);
}

function handlePasswordConfirm() {
  const entered = dom.passwordInput.value;
  if (entered === CONFIG.OWNER_PASSWORD) {
    state.authenticated = true;
    closeModal(dom.passwordModal);
    dom.pwError.textContent = '';
    if (state.pendingAction?.callback) {
      state.pendingAction.callback();
      state.pendingAction = null;
    }
  } else {
    dom.pwError.textContent = '✕ Incorrect password. Try again.';
    dom.passwordInput.value = '';
    dom.passwordInput.focus();
    // Shake animation
    dom.passwordInput.style.animation = 'none';
    dom.passwordInput.offsetHeight;
    dom.passwordInput.style.animation = 'shake 0.4s ease';
    setTimeout(() => { dom.passwordInput.style.animation = ''; }, 400);
  }
}

// Shake keyframe injected via JS
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(8px); }
  60%      { transform: translateX(-6px); }
  80%      { transform: translateX(6px); }
}`;
document.head.appendChild(shakeStyle);

// ── Render Gallery ────────────────────────────────────────
function renderGallery(videos) {
  const grid = dom.videoGrid;
  grid.innerHTML = '';

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

    // Thumbnail HTML
    let thumbHTML;
    if (v.thumb) {
      thumbHTML = `<img src="${v.thumb}" alt="${escapeHTML(v.title)}" loading="lazy" />`;
    } else {
      // Auto-generated gradient placeholder with a video snapshot approach
      thumbHTML = `<div class="thumb-placeholder">▶</div>`;
    }

    card.innerHTML = `
      <div class="card-thumb">
        ${thumbHTML}
        <div class="card-play">
          <div class="card-play-btn">▶</div>
        </div>
        <span class="card-badge">${v.size || ''}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHTML(v.title)}</div>
        <div class="card-meta">
          <span>${formatDate(v.createdAt)}</span>
          <span class="card-dot">•</span>
          <span>${v.size || 'Video'}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openPlayer(v.id));
    grid.appendChild(card);
  });
}

/** Safe HTML escape */
function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ── Video Player ──────────────────────────────────────────
function openPlayer(id) {
  const video = state.videos.find(v => v.id === id);
  if (!video) return;

  state.currentVideoId = id;
  dom.playerTitle.textContent = video.title;
  dom.playerDate.textContent  = `Uploaded on ${formatDate(video.createdAt)}`;
  dom.videoPlayer.src         = video.src;
  dom.videoPlayer.load();

  openModal(dom.playerModal);
  setTimeout(() => dom.videoPlayer.play().catch(() => {}), 350);
}

function closePlayer() {
  dom.videoPlayer.pause();
  dom.videoPlayer.src = '';
  state.currentVideoId = null;
  closeModal(dom.playerModal);
}

// ── Delete Video ──────────────────────────────────────────
function deleteVideo(id) {
  requirePassword('delete', () => {
    const idx = state.videos.findIndex(v => v.id === id);
    if (idx === -1) return;

    state.videos.splice(idx, 1);
    saveVideos();
    refreshAll();
    closePlayer();
    showToast('Video deleted.', 'error');
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
  dom.videoFileInput.value  = '';
  dom.thumbFileInput.value  = '';
  dom.thumbName.textContent = 'No file chosen';
  dom.videoTitleInput.value = '';
  dom.uploadPreview.style.display = 'none';
  dom.previewVideo.src = '';
  dom.progressWrap.style.display  = 'none';
  dom.progressFill.style.width    = '0%';
  dom.dropZone.style.display      = 'block';
  dom.submitUpload.disabled       = false;
}

/** Handle video file selection */
async function handleVideoFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    showToast('Please select a valid video file.', 'error');
    return;
  }

  state.selectedFile = file;

  // Show preview
  const url = URL.createObjectURL(file);
  dom.previewVideo.src         = url;
  dom.previewFilename.textContent = file.name;
  dom.previewSize.textContent     = formatBytes(file.size);
  dom.uploadPreview.style.display = 'block';
  dom.dropZone.style.display      = 'none';

  // Pre-fill title from filename
  if (!dom.videoTitleInput.value) {
    dom.videoTitleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }
}

/** Simulate a progress animation then resolve */
function fakeProgress() {
  return new Promise(resolve => {
    dom.progressWrap.style.display = 'block';
    dom.progressFill.style.width   = '0%';
    dom.progressLabel.textContent  = 'Processing video…';
    let pct = 0;
    const steps = [
      { target: 30, label: 'Reading file…' },
      { target: 65, label: 'Encoding…' },
      { target: 90, label: 'Finalizing…' },
      { target: 100, label: 'Done!' },
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      pct += Math.random() * 4 + 1;
      if (stepIdx < steps.length && pct >= steps[stepIdx].target) {
        dom.progressLabel.textContent = steps[stepIdx].label;
        stepIdx++;
      }
      if (pct >= 100) {
        pct = 100;
        dom.progressFill.style.width = '100%';
        clearInterval(interval);
        setTimeout(resolve, 400);
      } else {
        dom.progressFill.style.width = pct + '%';
      }
    }, 80);
  });
}

/** Handle the final upload submission */
async function handleUploadSubmit() {
  const title = dom.videoTitleInput.value.trim();

  if (!state.selectedFile) {
    showToast('Please select a video file.', 'error');
    return;
  }
  if (!title) {
    dom.videoTitleInput.focus();
    showToast('Please enter a title.', 'error');
    return;
  }

  dom.submitUpload.disabled = true;

  try {
    // Convert video to base64
    await fakeProgress();
    const [videoBase64, thumbBase64] = await Promise.all([
      fileToBase64(state.selectedFile),
      state.selectedThumb ? fileToBase64(state.selectedThumb) : Promise.resolve(null),
    ]);

    const newVideo = {
      id:        uid(),
      title:     title,
      src:       videoBase64,
      thumb:     thumbBase64,
      size:      formatBytes(state.selectedFile.size),
      createdAt: Date.now(),
    };

    state.videos.unshift(newVideo);   // newest first
    saveVideos();
    refreshAll();
    closeModal(dom.uploadModal);
    showToast(`"${title}" uploaded successfully!`, 'success');

  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload failed. File may be too large.', 'error');
    dom.submitUpload.disabled = false;
  }
}

// ── Search ────────────────────────────────────────────────
function handleSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    state.filteredVideos = [...state.videos];
  } else {
    state.filteredVideos = state.videos.filter(v =>
      v.title.toLowerCase().includes(q)
    );
  }
  renderGallery(state.filteredVideos);
}

// ── Refresh all dynamic UI ────────────────────────────────
function refreshAll() {
  state.filteredVideos = [...state.videos];
  renderGallery(state.filteredVideos);
  animateCounter(dom.statCount, state.videos.length);
  dom.videoCount.textContent = `${state.videos.length} video${state.videos.length !== 1 ? 's' : ''}`;
}

// ── Drag & Drop ───────────────────────────────────────────
function initDragDrop() {
  const zone = dom.dropZone;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file) handleVideoFile(file);
  });
  zone.addEventListener('click', () => dom.videoFileInput.click());
}

// ── Event Listeners ───────────────────────────────────────
function bindEvents() {
  // ── Upload trigger buttons ──
  dom.uploadTriggerBtn.addEventListener('click', () => {
    requirePassword('upload', openUploadPanel);
  });
  dom.navUploadBtn.addEventListener('click', e => {
    e.preventDefault();
    requirePassword('upload', openUploadPanel);
  });

  // ── Password modal ──
  dom.closePassword.addEventListener('click', () => closeModal(dom.passwordModal));
  dom.confirmPassword.addEventListener('click', handlePasswordConfirm);
  dom.passwordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handlePasswordConfirm();
  });

  // ── Upload modal ──
  dom.closeUpload.addEventListener('click', () => closeModal(dom.uploadModal));
  dom.videoFileInput.addEventListener('change', e => {
    handleVideoFile(e.target.files?.[0]);
  });
  dom.thumbFileInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) {
      state.selectedThumb = file;
      dom.thumbName.textContent = file.name;
    }
  });
  dom.submitUpload.addEventListener('click', handleUploadSubmit);

  // ── Player modal ──
  dom.closePlayer.addEventListener('click', closePlayer);
  dom.deleteCurrentVideo.addEventListener('click', () => {
    if (state.currentVideoId) deleteVideo(state.currentVideoId);
  });

  // ── Close modals on backdrop click ──
  [dom.passwordModal, dom.uploadModal, dom.playerModal].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        if (modal === dom.playerModal) {
          closePlayer();
        } else {
          closeModal(modal);
        }
      }
    });
  });

  // ── Search ──
  dom.searchInput.addEventListener('input', e => handleSearch(e.target.value));

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (dom.playerModal.classList.contains('active'))  closePlayer();
      if (dom.uploadModal.classList.contains('active'))  closeModal(dom.uploadModal);
      if (dom.passwordModal.classList.contains('active')) closeModal(dom.passwordModal);
    }
    // Cmd/Ctrl+K focuses search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      dom.searchInput.focus();
    }
  });

  // ── Drag & drop for upload zone ──
  initDragDrop();
}

// ── Init ──────────────────────────────────────────────────
function init() {
  loadVideos();
  bindEvents();
  refreshAll();
  console.log('%cVΞLTRIX initialized 🚀', 'color:#00f0ff;font-family:monospace;font-size:14px;');
}

document.addEventListener('DOMContentLoaded', init);
