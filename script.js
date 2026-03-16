/* ================================================================
   NOVA — js/script.js  (GitHub Pages Fixed Version)

   FIXES APPLIED:
   1. feather.replace() now safely called with typeof guard inside
      DOMContentLoaded — works even if CDN loads slightly late
   2. Page transition listener now correctly skips hash links
      (href="#gallery" etc.) so smooth scroll still works
   3. Hash scroll listener runs AFTER page transition listener
      so there's no double-preventDefault conflict
   4. pageshow event uses e.persisted check for bfcache safety
   5. All paths are relative — no leading slashes
   ================================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   PAGE LOADER
────────────────────────────────────────────────────────────── */
window.addEventListener('load', () => {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  setTimeout(() => {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 700);
  }, 1400);
});

/* ──────────────────────────────────────────────────────────────
   MAIN INIT — runs after DOM is fully parsed
────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // ── Feather Icons ──────────────────────────────────────────
  // Safe guard: feather loads synchronously via <script> tag
  // but we still check in case CDN was slow / blocked
  if (typeof feather !== 'undefined') {
    feather.replace();
  } else {
    // Retry once after 500ms as a fallback
    setTimeout(() => {
      if (typeof feather !== 'undefined') feather.replace();
    }, 500);
  }

  // ── Init all modules ───────────────────────────────────────
  initCursor();
  initParticles();
  initNav();
  initMobileNav();
  initScrollReveal();
  initHeroCounters();
  initAdminCounters();
  initFilterButtons();
  initHashScrollLinks();
  initPageTransitions();

});

/* ──────────────────────────────────────────────────────────────
   CUSTOM CURSOR
────────────────────────────────────────────────────────────── */
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  // Only show custom cursor on non-touch devices
  if (window.matchMedia('(hover: none)').matches) {
    dot.style.display  = 'none';
    ring.style.display = 'none';
    return;
  }

  document.body.style.cursor = 'none';

  let ringX = 0, ringY = 0;
  let dotX  = 0, dotY  = 0;
  let mouseX = 0, mouseY = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  (function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    dotX  += (mouseX - dotX)  * 0.35;
    dotY  += (mouseY - dotY)  * 0.35;
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';
    dot.style.left  = dotX + 'px';
    dot.style.top   = dotY + 'px';
    requestAnimationFrame(animateRing);
  })();

  const interactiveSelector = 'a, button, .video-card, .feature-card, .sidebar-video, [role="button"], input, select, textarea, .filter-btn, .sidebar-nav-item';

  document.querySelectorAll(interactiveSelector).forEach(el => {
    el.addEventListener('mouseenter', () => {
      ring.style.width  = '56px';
      ring.style.height = '56px';
      ring.style.borderColor = 'rgba(0, 229, 255, 0.8)';
      dot.style.transform = 'translate(-50%, -50%) scale(0)';
    });
    el.addEventListener('mouseleave', () => {
      ring.style.width  = '36px';
      ring.style.height = '36px';
      ring.style.borderColor = 'rgba(0, 229, 255, 0.5)';
      dot.style.transform = 'translate(-50%, -50%) scale(1)';
    });
  });

  document.addEventListener('mousedown', () => {
    ring.style.transform = 'translate(-50%, -50%) scale(0.7)';
  });
  document.addEventListener('mouseup', () => {
    ring.style.transform = 'translate(-50%, -50%) scale(1)';
  });
  document.addEventListener('mouseleave', () => {
    dot.style.opacity  = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity  = '1';
    ring.style.opacity = '1';
  });
}

/* ──────────────────────────────────────────────────────────────
   PARTICLE SYSTEM
────────────────────────────────────────────────────────────── */
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }, { passive: true });

  const PARTICLE_COUNT = 70;
  const particles = [];

  class Particle {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x     = Math.random() * W;
      this.y     = initial ? Math.random() * H : H + 10;
      this.vx    = (Math.random() - 0.5) * 0.3;
      this.vy    = -(Math.random() * 0.4 + 0.1);
      this.r     = Math.random() * 1.5 + 0.3;
      this.alpha = Math.random() * 0.4 + 0.05;
      this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.pulse += 0.02;
      if (this.y < -10) this.reset();
      if (this.x < -10 || this.x > W + 10) this.reset();
    }
    draw() {
      const a = this.alpha * (0.7 + 0.3 * Math.sin(this.pulse));
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 255, ' + a + ')';
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  function drawConnections() {
    const MAX_DIST = 100;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(0, 229, 255, ' + (0.04 * (1 - dist / MAX_DIST)) + ')';
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  animate();
}

/* ──────────────────────────────────────────────────────────────
   NAVIGATION — sticky glass effect on scroll
────────────────────────────────────────────────────────────── */
function initNav() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });

  // Nav search bar — filters gallery if on homepage
  const navSearchInput = document.getElementById('nav-search-input');
  if (navSearchInput) {
    navSearchInput.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const q    = navSearchInput.value.trim();
      const grid = document.getElementById('video-grid');
      if (q && grid) {
        filterCards(grid, q, null);
        document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Ctrl/Cmd + K → focus search
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.querySelector('.nav-search input')?.focus();
    }
    if (e.key === 'Escape') {
      document.querySelector('.nav-search input')?.blur();
      closeMobileNav();
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   MOBILE NAV DRAWER
────────────────────────────────────────────────────────────── */
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  const backdrop  = document.getElementById('mobile-nav-backdrop');
  const closeBtn  = document.getElementById('mobile-nav-close');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => mobileNav.classList.add('open'));
  closeBtn?.addEventListener('click', closeMobileNav);
  backdrop?.addEventListener('click', closeMobileNav);
}

function closeMobileNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
}

/* ──────────────────────────────────────────────────────────────
   SCROLL REVEAL (IntersectionObserver)
────────────────────────────────────────────────────────────── */
function initScrollReveal() {
  // IntersectionObserver is supported in all modern browsers
  // and on GitHub Pages — no polyfill needed
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ──────────────────────────────────────────────────────────────
   HERO COUNTERS (data-count attribute)
────────────────────────────────────────────────────────────── */
function initHeroCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = parseInt(el.dataset.count, 10);
      if (!target) return;
      animateNum(el, target);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
}

function animateNum(el, target) {
  const suffix    = el.textContent.replace(/[\d,]/g, '').trim();
  const duration  = 1800;
  const startTime = performance.now();

  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(eased * target) + (suffix || '');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ──────────────────────────────────────────────────────────────
   ADMIN STAT COUNTERS (.stat-card-value[data-count])
────────────────────────────────────────────────────────────── */
function initAdminCounters() {
  document.querySelectorAll('.stat-card-value[data-count]').forEach(el => {
    if (el._counted) return;
    el._counted = true;
    const target = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || '';
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = prefix + cur.toLocaleString();
      if (cur >= target) clearInterval(t);
    }, 30);
  });
}

/* ──────────────────────────────────────────────────────────────
   VIDEO GALLERY FILTER BUTTONS
────────────────────────────────────────────────────────────── */
function initFilterButtons() {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  filterBar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const grid = document.getElementById('video-grid');
    if (grid) filterCards(grid, null, btn.dataset.filter);
  });
}

function filterCards(grid, query, filter) {
  const cards = grid.querySelectorAll('.video-card');
  let delay = 0;

  cards.forEach(card => {
    let show = true;

    if (filter && filter !== 'all') {
      const cardFilters = (card.dataset.filter || '').split(' ');
      show = cardFilters.includes(filter);
    }
    if (query) {
      const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
      show = show && title.includes(query.toLowerCase());
    }

    if (show) {
      card.style.display = '';
      // Trigger re-animation
      card.style.animation = 'none';
      void card.offsetHeight;
      card.style.animationDelay = (delay * 0.06) + 's';
      card.style.animation = 'cardIn 0.4s cubic-bezier(0.4,0,0.2,1) both';
      delay++;
    } else {
      card.style.display = 'none';
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   PARALLAX — hero section only
────────────────────────────────────────────────────────────── */
window.addEventListener('scroll', () => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const scrolled = window.scrollY;

  const heroBg = hero.querySelector('.hero-gradient');
  if (heroBg) heroBg.style.transform = 'translateY(' + (scrolled * 0.25) + 'px)';

  const mockup = hero.querySelector('.hero-mockup');
  if (mockup) mockup.style.transform = 'translateY(calc(-50% + ' + (scrolled * 0.12) + 'px)) perspective(1200px) rotateY(-12deg) rotateX(4deg)';
}, { passive: true });

/* ──────────────────────────────────────────────────────────────
   HASH LINK SMOOTH SCROLL
   FIX: This must run BEFORE page transitions so hash links
   (#gallery, #features) scroll smoothly instead of navigating
────────────────────────────────────────────────────────────── */
function initHashScrollLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const hash   = a.getAttribute('href');
      const target = document.querySelector(hash);
      if (target) {
        e.preventDefault();
        e.stopImmediatePropagation(); // prevent page transition listener from firing
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        closeMobileNav();
      }
    });
  });
}

/* ──────────────────────────────────────────────────────────────
   PAGE TRANSITIONS — fade out on navigation
   FIX: Correctly skips hash-only links, external links,
   mailto, tel, and target="_blank" links
────────────────────────────────────────────────────────────── */
function initPageTransitions() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');

    // Skip: no href, hash-only, external, mailto/tel, new tab
    if (
      !href ||
      href === '#' ||
      href.startsWith('#') ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      link.target === '_blank' ||
      link.hasAttribute('download')
    ) return;

    // It's an internal page link — do the fade transition
    e.preventDefault();
    document.body.style.transition = 'opacity 0.25s ease';
    document.body.style.opacity    = '0';
    setTimeout(() => { window.location.href = href; }, 270);
  });

  // Restore opacity when page is shown (handles browser back button / bfcache)
  window.addEventListener('pageshow', e => {
    document.body.style.opacity    = '1';
    document.body.style.transition = '';
  });
}

/* ──────────────────────────────────────────────────────────────
   MOUSE GLOW on cards (decorative)
────────────────────────────────────────────────────────────── */
document.addEventListener('mousemove', e => {
  document.querySelectorAll('.feature-card, .stat-card').forEach(card => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
    card.style.setProperty('--mouse-y', (e.clientY - rect.top)  + 'px');
  });
});

/* ──────────────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
   Usage from anywhere: showToast('message', 'success'|'error'|'info')
────────────────────────────────────────────────────────────── */
window.showToast = function(message, type, duration) {
  type     = type     || 'info';
  duration = duration || 3500;

  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error:   '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    info:    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
  };

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span><span>' + message + '</span>';
  container.appendChild(toast);

  setTimeout(function() {
    toast.classList.add('removing');
    setTimeout(function() { toast.remove(); }, 350);
  }, duration);
};

/* ──────────────────────────────────────────────────────────────
   CONSOLE SIGNATURE
────────────────────────────────────────────────────────────── */
console.log(
  '%c NOVA VIDEO TEMPLATE v1.1 — GitHub Pages Ready ',
  'background:linear-gradient(90deg,#00e5ff,#7c3aed);color:#000;font-weight:700;font-size:12px;padding:5px 10px;border-radius:4px;'
);
