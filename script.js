/* ================================================================
   NOVA — js/script.js
   Global interactive effects, animations, and utilities.
   Runs on all pages.
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
  }, 1600);
});

/* ──────────────────────────────────────────────────────────────
   INIT AFTER DOM READY
────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initParticles();
  initNav();
  initMobileNav();
  initScrollReveal();
  initCounters();
  initFilterButtons();
  initHeroCounters();
  if (typeof feather !== 'undefined') feather.replace();
});

/* ──────────────────────────────────────────────────────────────
   CUSTOM CURSOR
────────────────────────────────────────────────────────────── */
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  // Hide default cursor on body
  document.body.style.cursor = 'none';

  let ringX = 0, ringY = 0;
  let dotX  = 0, dotY  = 0;
  let mouseX = 0, mouseY = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Smooth ring follow
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

  // Expand ring on interactive elements
  const interactiveSelector = 'a, button, .video-card, .feature-card, .sidebar-video, [role="button"], input, select, textarea, .filter-btn, .nav-links a, .sidebar-nav-item';

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

  // Click burst effect
  document.addEventListener('mousedown', () => {
    ring.style.transform = 'translate(-50%, -50%) scale(0.7)';
  });
  document.addEventListener('mouseup', () => {
    ring.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  // Hide when leaving window
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
  });

  const PARTICLE_COUNT = 80;
  const particles = [];

  class Particle {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x  = Math.random() * W;
      this.y  = initial ? Math.random() * H : H + 10;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -(Math.random() * 0.4 + 0.1);
      this.r  = Math.random() * 1.5 + 0.3;
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
      ctx.fillStyle = `rgba(0, 229, 255, ${a})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  // Draw connecting lines between close particles
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
          ctx.strokeStyle = `rgba(0, 229, 255, ${0.04 * (1 - dist / MAX_DIST)})`;
          ctx.lineWidth = 0.5;
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
   NAVIGATION
────────────────────────────────────────────────────────────── */
function initNav() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  // Scroll → add glassy background
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });

  // Nav search → redirect to gallery with query
  const navSearchInput = document.getElementById('nav-search-input');
  if (navSearchInput) {
    navSearchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = navSearchInput.value.trim();
        if (q) {
          const grid = document.getElementById('video-grid');
          if (grid) {
            filterCards(grid, q);
            document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    });
  }

  // Keyboard shortcut: Ctrl/Cmd+K focuses search
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
   MOBILE NAV
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
   SCROLL REVEAL
   Intersection Observer triggers .reveal elements
────────────────────────────────────────────────────────────── */
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ──────────────────────────────────────────────────────────────
   ANIMATED COUNTERS (hero stats)
────────────────────────────────────────────────────────────── */
function initHeroCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = parseInt(el.dataset.count);
      if (!target) return;
      animateNum(el, target);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
}

function animateNum(el, target) {
  const suffix = el.textContent.replace(/[\d.]/g, '').trim();
  let start = 0;
  const duration = 1800;
  const startTime = performance.now();
  const step = (now) => {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(eased * target);
    el.textContent = value + (suffix || '');
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ──────────────────────────────────────────────────────────────
   STAT CARD COUNTERS (admin)
────────────────────────────────────────────────────────────── */
function initCounters() {
  // Only runs on admin page; harmless on others
  document.querySelectorAll('.stat-card-value[data-count]').forEach(el => {
    if (el._counted) return;
    el._counted = true;
    const target = parseInt(el.dataset.count);
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
   VIDEO GALLERY FILTER
────────────────────────────────────────────────────────────── */
function initFilterButtons() {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  filterBar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    const grid   = document.getElementById('video-grid');
    if (!grid) return;

    filterCards(grid, null, filter);
  });
}

/**
 * Filter video cards by text query or data-filter attribute
 * @param {HTMLElement} grid
 * @param {string|null} query  - text search
 * @param {string|null} filter - category filter ('all' means show all)
 */
function filterCards(grid, query = null, filter = null) {
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
      card.style.animationDelay = delay * 0.06 + 's';
      card.style.animation = 'none';
      void card.offsetHeight; // reflow
      card.style.animation = 'cardIn 0.4s var(--ease) both';
      delay++;
    } else {
      card.style.display = 'none';
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   PARALLAX (subtle, on hero section only)
────────────────────────────────────────────────────────────── */
window.addEventListener('scroll', () => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const scrolled = window.scrollY;
  const heroBg   = hero.querySelector('.hero-gradient');
  if (heroBg) {
    heroBg.style.transform = `translateY(${scrolled * 0.25}px)`;
  }
  const mockup = hero.querySelector('.hero-mockup');
  if (mockup) {
    mockup.style.transform = `translateY(calc(-50% + ${scrolled * 0.12}px)) perspective(1200px) rotateY(-12deg) rotateX(4deg)`;
  }
}, { passive: true });

/* ──────────────────────────────────────────────────────────────
   PAGE TRANSITIONS
   Fade-out on internal link navigation
────────────────────────────────────────────────────────────── */
document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || link.target === '_blank') return;

  e.preventDefault();
  document.body.style.transition = 'opacity 0.25s ease';
  document.body.style.opacity = '0';
  setTimeout(() => { window.location.href = href; }, 260);
});

window.addEventListener('pageshow', () => {
  document.body.style.opacity = '1';
});

/* ──────────────────────────────────────────────────────────────
   TOAST NOTIFICATIONS (global helper)
   Called from any page: showToast('message', 'success'|'error'|'info')
────────────────────────────────────────────────────────────── */
window.showToast = function(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, duration);
};

/* ──────────────────────────────────────────────────────────────
   GLOW EFFECT ON HOVER (cards)
   Subtle mouse-tracking glow on feature cards
────────────────────────────────────────────────────────────── */
document.addEventListener('mousemove', e => {
  document.querySelectorAll('.feature-card, .stat-card').forEach(card => {
    const rect = card.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', x + 'px');
    card.style.setProperty('--mouse-y', y + 'px');
  });
});

/* ──────────────────────────────────────────────────────────────
   SMOOTH SECTION SCROLL (hash links)
────────────────────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeMobileNav();
    }
  });
});

/* ──────────────────────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────────────────────── */

/** Debounce helper */
function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Format large numbers */
function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

/** Log template version to console */
console.log(
  '%c NOVA VIDEO TEMPLATE v1.0 ',
  'background:linear-gradient(90deg,#00e5ff,#7c3aed);color:#000;font-weight:700;font-size:13px;padding:6px 12px;border-radius:4px;',
  '\n\nFrontend template by NOVA Studio. Ready to connect to your backend.\n'
);
