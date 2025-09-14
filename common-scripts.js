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
  applySiteSettings(); // サイト設定を適用
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

// サイト全体の設定を読み込んで適用する
/**
 * サイト共通設定をAPIから取得し、ページの該当箇所に反映させる関数
 */
async function applySiteSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
            console.error('Failed to fetch site settings: Network response was not ok');
            return;
        }
        const settings = await response.json();

        // 1. フッターや連絡先ページの共通情報を更新
        // 住所
        document.querySelectorAll('.contact-address').forEach(el => {
            el.textContent = settings.contact_address || '（住所情報未設定）';
        });

        // 電話番号
        document.querySelectorAll('.contact-phone').forEach(el => {
            const phone = settings.contact_phone || '（電話番号未設定）';
            el.textContent = phone;
            // 電話番号のリンク(href)も設定
            if (el.tagName === 'A') {
                el.href = 'tel:' + phone.replace(/-/g, '');
            }
        });

        // メールアドレス
        document.querySelectorAll('.contact-email').forEach(el => {
            const email = settings.contact_email || '（メールアドレス未設定）';
            el.textContent = email;
            // メールアドレスのリンク(href)も設定
            if (el.tagName === 'A') {
                el.href = 'mailto:' + email;
            }
        });

        // 2. 各隊の紹介ページに記載されているリーダー名を更新
        const leaderBeaverEl = document.querySelector('.leader-beaver-name');
        if (leaderBeaverEl) {
            leaderBeaverEl.textContent = settings.leader_beaver || '（リーダー名未設定）';
        }

        const leaderCubEl = document.querySelector('.leader-cub-name');
        if (leaderCubEl) {
            leaderCubEl.textContent = settings.leader_cub || '（リーダー名未設定）';
        }

        const leaderBoyEl = document.querySelector('.leader-boy-name');
        if (leaderBoyEl) {
            leaderBoyEl.textContent = settings.leader_boy || '（隊長名未設定）';
        }

        const leaderVentureEl = document.querySelector('.leader-venture-name');
        if (leaderVentureEl) {
            leaderVentureEl.textContent = settings.leader_venture || '（隊長名未設定）';
        }

        const leaderRoverEl = document.querySelector('.leader-rover-name');
        if (leaderRoverEl) {
            leaderRoverEl.textContent = settings.leader_rover || '（アドバイザー名未設定）';
        }

        // 3. プライバシーポリシー関連（存在するページのみ）
        const effEl = document.getElementById('enactment-date');
        if (effEl && settings.privacy_effective_date) {
            effEl.textContent = settings.privacy_effective_date;
        }
        const updEl = document.getElementById('last-updated-date');
        if (updEl && settings.privacy_last_updated_date) {
            updEl.textContent = settings.privacy_last_updated_date;
        }
        document.querySelectorAll('.privacy-contact-person').forEach(el => {
            if (settings.privacy_contact_person) el.textContent = settings.privacy_contact_person;
        });
        document.querySelectorAll('.privacy-contact-phone').forEach(el => {
            if (settings.privacy_contact_phone) {
                el.textContent = settings.privacy_contact_phone;
                if (el.tagName === 'A') el.href = 'tel:' + settings.privacy_contact_phone.replace(/-/g, '');
            }
        });
        document.querySelectorAll('.privacy-contact-email').forEach(el => {
            if (settings.privacy_contact_email) {
                el.textContent = settings.privacy_contact_email;
                if (el.tagName === 'A') el.href = 'mailto:' + settings.privacy_contact_email;
            }
        });

        // 4. お問い合わせページ専用（担当者名、サブ電話、地図埋め込み）
        document.querySelectorAll('.contact-person-name').forEach(el => {
            if (settings.contact_person_name) el.textContent = settings.contact_person_name;
        });
        document.querySelectorAll('.contact-phone-secondary').forEach(el => {
            if (settings.contact_secondary_phone) {
                el.textContent = settings.contact_secondary_phone;
                if (el.tagName === 'A') el.href = 'tel:' + settings.contact_secondary_phone.replace(/-/g, '');
            }
        });
        const mapEl = document.getElementById('contact-map-embed');
        if (mapEl && settings.contact_map_embed_html) {
            mapEl.innerHTML = settings.contact_map_embed_html;
        }

        // 5. トップページの画像差し替え（存在時のみ適用）
        const hero = document.querySelector('.hero-bg');
        if (hero && settings.index_hero_image_url) {
            hero.style.backgroundImage = `url('${settings.index_hero_image_url}')`;
        }
        for (let i of [1,2,3]) {
            const el = document.getElementById(`index-activity-img-${i}`);
            const key = `index_highlight_img_${i}_url`;
            if (el && settings[key]) el.src = settings[key];
        }
        for (let i of [1,2]) {
            const el = document.getElementById(`index-testimonial-img-${i}`);
            const key = `index_testimonial_img_${i}_url`;
            if (el && settings[key]) el.src = settings[key];
        }

    } catch (error) {
        console.error('Error applying site settings:', error);
    }
}

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
