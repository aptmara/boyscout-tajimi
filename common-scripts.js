// common-scripts.js (patched minimal diff)
// グローバルな設定やユーティリティ
const COMMON_SETTINGS = {
  headerId: 'main-header',
  fadeInSelector: '.fade-in-section',
  tiltCardSelector: '.tilt-card-effect',
  currentYearSelector: '#current-year',
  mobileMenuStoreName: 'mobileMenu',
  smoothScrollSelector: 'a[href^="#"]:not([href="#"])',
  scrollToTopSelector: 'a[href="#"]',
};

document.addEventListener('alpine:init', () => {
  Alpine.store(COMMON_SETTINGS.mobileMenuStoreName, {
    isOpen: false,
    toggle() {
      this.isOpen = !this.isOpen;
      document.body.style.overflow = this.isOpen ? 'hidden' : '';
      const menuButton = document.getElementById('mobile-menu-button-alpine');
      if (menuButton) menuButton.classList.toggle('open', this.isOpen);
    },
    close() {
      this.isOpen = false;
      document.body.style.overflow = '';
      const menuButton = document.getElementById('mobile-menu-button-alpine');
      if (menuButton) menuButton.classList.remove('open');
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initFooterYear();
  initIntersectionObserver();
  initHeaderScrollBehavior();
  initTiltEffect();
  initSimpleLightboxPlaceholder();
  initLazyLoadImages?.();

  if (document.getElementById('hero')) {
    initHeroTextAnimation?.();
    initCounterAnimation?.();
  }
  if (document.getElementById('activity-log-container')) {
    initActivityLogPage?.();
  }
  if (document.getElementById('activity-article-container')) {
    initActivityDetailPage?.();
  }
  if (document.getElementById('contact-form')) {
    initContactForm?.();
  }
});

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('ja-JP', options);
}

function initSmoothScroll() {
  document.querySelectorAll(COMMON_SETTINGS.smoothScrollSelector).forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const mobileMenuStore =
        (window.Alpine && Alpine.store && Alpine.store(COMMON_SETTINGS.mobileMenuStoreName)) || null;
      if (mobileMenuStore && mobileMenuStore.isOpen) mobileMenuStore.close();

      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const header = document.getElementById(COMMON_SETTINGS.headerId);
        const headerOffset = header ? header.offsetHeight : 0;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const additionalPageOffset = 10;
        const offsetPosition = elementPosition + window.scrollY - headerOffset - additionalPageOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      } else if (this.pathname === window.location.pathname && targetId === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  document.querySelectorAll(COMMON_SETTINGS.scrollToTopSelector).forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const mobileMenuStore =
        (window.Alpine && Alpine.store && Alpine.store(COMMON_SETTINGS.mobileMenuStoreName)) || null;
      if (mobileMenuStore && mobileMenuStore.isOpen) mobileMenuStore.close();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function initFooterYear() {
  const yearElement = document.querySelector(COMMON_SETTINGS.currentYearSelector);
  if (yearElement) yearElement.textContent = new Date().getFullYear();
}

function initIntersectionObserver() {
  const fadeInSections = document.querySelectorAll(COMMON_SETTINGS.fadeInSelector);
  if (fadeInSections.length === 0) return;
  const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
  const fadeInObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  fadeInSections.forEach(section => fadeInObserver.observe(section));
}

function initHeaderScrollBehavior() {
  const header = document.getElementById(COMMON_SETTINGS.headerId);
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 50) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  });
}

function initTiltEffect(selector = COMMON_SETTINGS.tiltCardSelector) {
  const tiltCards = document.querySelectorAll(selector);
  if (tiltCards.length === 0) return;
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', handleTiltMouseMove);
    card.addEventListener('mouseleave', handleTiltMouseLeave);
  });
}
function handleTiltMouseMove(e) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;
  const rotateX = (y / (rect.height / 2)) * -3;
  const rotateY = (x / (rect.width / 2)) * 3;
  card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
}
function handleTiltMouseLeave(e) {
  e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
}

function initSimpleLightboxPlaceholder() {
  document.querySelectorAll('a[data-lightbox]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      alert(`画像 ${link.href} を表示します。(Lightbox未実装)`);
    });
  });
}
