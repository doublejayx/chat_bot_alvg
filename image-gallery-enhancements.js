/* ============================================================
   image-gallery-enhancements.js
   Drop this at the bottom of <body>, after existing scripts.
   All features are self-contained and non-breaking.
   ============================================================ */

(function () {
  'use strict';

  /* ── 1. Nav: add .scrolled class on scroll ──────────────── */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 2. IntersectionObserver: fade-up + stagger ─────────── */
  // Handles .fade-up, .summary-card, .feature-card
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  // Stagger summary cards
  document.querySelectorAll('.summary-card').forEach((el, i) => {
    el.style.transitionDelay = `${i * 100}ms`;
    revealObserver.observe(el);
  });

  // Stagger feature cards
  document.querySelectorAll('.feature-card').forEach((el, i) => {
    el.style.transitionDelay = `${i * 120}ms`;
    revealObserver.observe(el);
  });

  // Generic fade-up
  document.querySelectorAll('.fade-up').forEach((el) => revealObserver.observe(el));

  /* ── 3. Counter animation on stat numbers ───────────────── */
  function animateCounter(el, target, duration = 1600, suffix = '') {
    const startTime = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = Math.round(easeOut(progress) * target);
      el.textContent = value.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const statObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const raw = el.dataset.count || el.textContent.replace(/[^0-9.]/g, '');
        const suffix = el.dataset.suffix || el.textContent.replace(/[0-9,.]/g, '');
        const target = parseFloat(raw);
        if (!isNaN(target)) animateCounter(el, target, 1600, suffix.trim());
        statObserver.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );

  // Observe both .stat-value and .summary-value
  document.querySelectorAll('.stat-value, .summary-value').forEach((el) => {
    // Store original number as data attribute so re-animations work
    const num = el.textContent.replace(/[^0-9.]/g, '');
    const suf = el.textContent.replace(/[0-9,. ]/g, '').trim();
    if (num) {
      el.dataset.count = num;
      el.dataset.suffix = suf;
    }
    statObserver.observe(el);
  });

  /* ── 4. Gallery: staggered itemIn + add view button ─────── */
  function enhanceGalleryCards() {
    document.querySelectorAll('.image-card').forEach((card, i) => {
      // Stagger animation delay
      card.style.animationDelay = `${i * 55}ms`;

      // Add view button if not already present
      if (!card.querySelector('.image-card-view')) {
        const viewBtn = document.createElement('div');
        viewBtn.className = 'image-card-view';
        viewBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View
        `;
        card.appendChild(viewBtn);
      }
    });
  }

  enhanceGalleryCards();

  // Re-run when new images are added (MutationObserver on gallery container)
  const gallery = document.querySelector('.gallery-container');
  if (gallery) {
    const galleryObserver = new MutationObserver(() => enhanceGalleryCards());
    galleryObserver.observe(gallery, { childList: true });
  }

  /* ── 5. Skeleton loading helper ─────────────────────────── */
  // Call showSkeletons(n) before loading images, hideSkeletons() after
  window.gallerySkeletons = {
    show(count = 8) {
      const g = document.querySelector('.gallery-container');
      if (!g) return;
      for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'skeleton-card';
        s.dataset.skeleton = '1';
        g.appendChild(s);
      }
    },
    hide() {
      document.querySelectorAll('[data-skeleton]').forEach((el) => el.remove());
    },
  };

  /* ── 6. Theme toggle rotation reset trick ───────────────── */
  // Prevents the rotate animation from stacking on rapid clicks
  const themeBtn = document.querySelector('.theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      themeBtn.style.transition = 'none';
      requestAnimationFrame(() => {
        themeBtn.style.transition = '';
      });
    });
  }

  /* ── 7. Smooth scroll for nav links ─────────────────────── */
  document.querySelectorAll('.nav-link[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ── 8. Active nav link highlight on scroll ─────────────── */
  const sections = document.querySelectorAll('.section[id]');
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

  if (sections.length && navLinks.length) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach((link) => {
              link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
            });
          }
        });
      },
      { threshold: 0.4 }
    );
    sections.forEach((s) => sectionObserver.observe(s));
  }

  /* ── 9. Button ripple effect ─────────────────────────────── */
  document.querySelectorAll('.btn').forEach((btn) => {
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height) * 1.5;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position:absolute;
        width:${size}px;height:${size}px;
        left:${x}px;top:${y}px;
        border-radius:50%;
        background:rgba(255,255,255,0.35);
        pointer-events:none;
        transform:scale(0);
        animation:rippleOut 0.55s ease forwards;
      `;
      this.style.position = this.style.position || 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });

  // Inject ripple keyframe once
  if (!document.getElementById('ripple-style')) {
    const style = document.createElement('style');
    style.id = 'ripple-style';
    style.textContent = `
      @keyframes rippleOut {
        to { transform: scale(1); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

})();
