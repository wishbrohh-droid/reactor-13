/* ============================================================
   VΞLTRIX — script.js
   Full streaming platform logic

   KEY FIX: Videos are stored as blob Object URLs in memory
   (not base64 in localStorage — that causes quota errors and
   broken playback). Only metadata + thumbnail are persisted.
   Videos must be re-uploaded after a page refresh, but will
   play instantly and reliably every time.
   ============================================================ */

'use strict';

// ── Config ────────────────────────────────────────────────
const CONFIG = {
  OWNER_PASSWORD: 'veltrix2024',   // ← Change this password!
  STORAGE_KEY:    'veltrix_meta',  // Only metadata saved here
};

// ── State ─────────────────────────────────────────────────
let state = {
  videos:         [],   // full video objects (blobUrl lives in memory only)
  filteredVideos: [],
  pendingAction:  null,
  currentVideoId: null,
  selectedFile:   null, // File object chosen for upload
  selectedThumb:  null, // File object for thumbnail
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

// ── Toast ─────────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3200) {
  dom.toast.textContent = message;
  dom.toast.className   = `toast ${type} show`;
  setTimeout(() => { dom.toast.className = 'toast'; }, duration);
}

// ── Persistence (metadata only) ───────────────────────────
/** Load metadata from localStorage. blobUrl is NOT stored. */
function loadMeta() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    const meta = raw ? JSON.parse(raw) : [];
    // Mark each video as offline — no blob after page reload
    state.videos = meta.map(m => ({ ...m, blobUrl: null }));
  } catch {
    state.videos = [];
  }
}

/** Save only metadata (strips blobUrl) to localStorage */
function saveMeta() {
  try {
    const meta = state.videos.map(({ blobUrl, ...rest }) => rest);
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('localStorage save failed:', e);
    showToast('Could not save metadata.', 'error');
  }
}

// ── Utilities ─────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatBytes(bytes) {
  if (bytes < 1024)    return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function animateCounter(el, target) {
  let current = parseInt(el.textContent) || 0;
  const step  = Math.max(1, Math.ceil(Math.abs(target - current) / 20));
  const timer = setInterval(() => {
    current = target > current
      ? Math.min(current + step, target)
      : Math.max(current - step, target);
    el.textContent = current;
    if (current === target) clearInterval(timer);
  }, 40);
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ── Modal helpers ─────────────────────────────────────────
function openModal(el)  { el.classList.add('active'); }
function closeModal(el) { el.classList.remove('active'); }

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

// Inject shake keyframe once
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%,100%{ transform:translateX(0) }
  20%    { transform:translateX(-8px) }
  40%    { transform:translateX(8px) }
  60%    { transform:translateX(-5px) }
  80%    { transform:translateX(5px) }
}
.offline-badge {
  position:absolute; top:8px; left:8px;
  background:rgba(255,160,0,0.85);
  color:#000; font-size:10px; font-weight:700;
  border-radius:5px; padding:3px 8px;
  letter-spacing:.5px; pointer-events:none;
}`;
document.head.appendChild(shakeStyle);

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

    // Warn when video isn't loaded in memory (after page refresh)
    const offlineBadge = !v.blobUrl
      ? `<div class="offline-badge">↺ Re-upload to play</div>`
      : '';

    card.innerHTML = `
      <div class="card-thumb">
        ${thumbHTML}
        <div class="card-play"><div class="card-play-btn">▶</div></div>
        ${offlineBadge}
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
function openPlayer(id) {
  const video = state.videos.find(v => v.id === id);
  if (!video) return;

  // If no blob URL (after page refresh), tell user to re-upload
  if (!video.blobUrl) {
    showToast('Video not in memory — please re-upload this video to watch it.', 'error', 4500);
    return;
  }

  state.currentVideoId = id;
  dom.playerTitle.textContent = video.title;
  dom.playerDate.textContent  = `Uploaded ${formatDate(video.createdAt)}`;

  // ✅ Use blob URL — instant playback, no base64 involved
  dom.videoPlayer.src = video.blobUrl;
  dom.videoPlayer.load();

  openModal(dom.playerModal);
  setTimeout(() => dom.videoPlayer.play().catch(() => {}), 300);
}

function closePlayer() {
  dom.videoPlayer.pause();
  dom.videoPlayer.removeAttribute('src');
  dom.videoPlayer.load();
  state.currentVideoId = null;
  closeModal(dom.playerModal);
}

// ── Delete Video ──────────────────────────────────────────
function deleteVideo(id) {
  requirePassword('delete', () => {
    const idx = state.videos.findIndex(v => v.id === id);
    if (idx === -1) return;

    // Free memory
    if (state.videos[idx].blobUrl) URL.revokeObjectURL(state.videos[idx].blobUrl);

    state.videos.splice(idx, 1);
    saveMeta();
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

/** Handle video file selection — create blob URL immediately */
function handleVideoFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    showToast('Please select a valid video file.', 'error');
    return;
  }

  state.selectedFile = file;

  // ✅ Object URL — the correct way to play local files
  const objectUrl = URL.createObjectURL(file);
  dom.previewVideo.src            = objectUrl;
  dom.previewFilename.textContent = file.name;
  dom.previewSize.textContent     = formatBytes(file.size);
  dom.uploadPreview.style.display = 'block';
  dom.dropZone.style.display      = 'none';

  if (!dom.videoTitleInput.value) {
    dom.videoTitleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }
}

/** Animated progress bar */
function fakeProgress() {
  return new Promise(resolve => {
    dom.progressWrap.style.display = 'block';
    dom.progressFill.style.width   = '0%';
    dom.progressLabel.textContent  = 'Processing…';
    const steps = [
      { at: 25,  label: 'Reading file…' },
      { at: 55,  label: 'Preparing video…' },
      { at: 85,  label: 'Almost ready…' },
      { at: 100, label: 'Done!' },
    ];
    let pct = 0, stepIdx = 0;
    const iv = setInterval(() => {
      pct += Math.random() * 5 + 2;
      if (stepIdx < steps.length && pct >= steps[stepIdx].at) {
        dom.progressLabel.textContent = steps[stepIdx].label;
        stepIdx++;
      }
      if (pct >= 100) {
        pct = 100;
        dom.progressFill.style.width = '100%';
        clearInterval(iv);
        setTimeout(resolve, 350);
      } else {
        dom.progressFill.style.width = pct + '%';
      }
    }, 60);
  });
}

/** Submit upload */
async function handleUploadSubmit() {
  const title = dom.videoTitleInput.value.trim();
  if (!state.selectedFile) { showToast('Please select a video file first.', 'error'); return; }
  if (!title)               { dom.videoTitleInput.focus(); showToast('Please enter a title.', 'error'); return; }

  dom.submitUpload.disabled = true;

  try {
    await fakeProgress();

    // ✅ Create blob URL for in-session playback
    const blobUrl = URL.createObjectURL(state.selectedFile);

    // Only thumbnail gets base64 (small image, safe for localStorage)
    const thumbBase64 = state.selectedThumb
      ? await fileToBase64(state.selectedThumb)
      : null;

    const newVideo = {
      id:        uid(),
      title:     title,
      blobUrl:   blobUrl,      // in-memory only, not saved to localStorage
      thumb:     thumbBase64,  // saved to localStorage
      size:      formatBytes(state.selectedFile.size),
      createdAt: Date.now(),
    };

    state.videos.unshift(newVideo);
    saveMeta(); // strips blobUrl before saving
    refreshAll();
    closeModal(dom.uploadModal);
    showToast(`"${title}" added to library!`, 'success');

  } catch (err) {
    console.error('Upload error:', err);
    showToast('Something went wrong. Try again.', 'error');
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

// ── Refresh all UI ────────────────────────────────────────
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

// ── Event Listeners ───────────────────────────────────────
function bindEvents() {
  dom.uploadTriggerBtn.addEventListener('click', () => requirePassword('upload', openUploadPanel));
  dom.navUploadBtn.addEventListener('click', e => { e.preventDefault(); requirePassword('upload', openUploadPanel); });

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
function init() {
  loadMeta();
  bindEvents();
  refreshAll();
  console.log('%cVΞLTRIX ready 🚀', 'color:#00f0ff;font-family:monospace;font-size:14px;font-weight:bold;');
}

document.addEventListener('DOMContentLoaded', init);
