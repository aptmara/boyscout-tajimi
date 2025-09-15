// common-scripts.js

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

/**
 * Alpine.jsのストアを初期化
 * - mobileMenu: モバイルメニューの開閉状態を管理
 */
// Alpineの読み込みタイミングに依存しないようにストア登録をラップ
function registerMobileMenuStore() {
  try {
    if (!window.Alpine || !Alpine.store) return;
    // 既に登録済みなら二重登録しない
    if (Alpine.store(COMMON_SETTINGS.mobileMenuStoreName)) return;

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
  } catch (e) {
    console.error('Failed to register Alpine store:', e);
  }
}

// 1) 既にAlpineが存在するなら即時登録
if (window.Alpine) {
  registerMobileMenuStore();
}

// 2) Alpine初期化イベントでも登録（後読みの保険）
document.addEventListener('alpine:init', registerMobileMenuStore);

/**
 * DOMコンテンツが読み込まれた後に初期化処理を実行
 */
document.addEventListener('DOMContentLoaded', () => {
  applySiteSettings(); // サイト設定をAPIから読み込み適用
  applyUnitLogos(); // 各隊ロゴを適用
  initSmoothScroll();
  initFooterYear();
  initIntersectionObserver();
  initHeaderScrollBehavior();
  initTiltEffect();
  initSimpleLightboxPlaceholder();
  initLazyLoadImages(); // 画像の遅延読み込みを初期化

  // --- 特定のページでのみ実行する初期化処理 ---
  if (document.getElementById('hero')) {
    // タイピング風アニメーションの呼び出し
    if (typeof initHeroTextAnimation === 'function') initHeroTextAnimation('#hero-title', 300, 120);
    if (typeof initHeroTextAnimation === 'function') initHeroTextAnimation('#hero-subtitle', 4000, 50);
    if (typeof initCounterAnimation === 'function') initCounterAnimation();
  }
  if (document.getElementById('activity-log-container')) {
    if (typeof initActivityLogPage === 'function') initActivityLogPage();
  }
  if (document.getElementById('activity-article-container')) {
    if (typeof initActivityDetailPage === 'function') initActivityDetailPage();
  }
  if (document.getElementById('contact-form')) {
    if (typeof initContactForm === 'function') initContactForm();
  }
});


// =========================================================================
// ここから下に関数を実装していきます
// =========================================================================

/**
 * (実装) ヒーローセクションのテキストアニメーション (タイピング風)
 * @param {string} targetSelector - アニメーション対象の要素のCSSセレクタ
 * @param {number} initialDelay - アニメーション開始までの遅延時間(ミリ秒)
 * @param {number} typingSpeed - 一文字あたりのタイピング速度(ミリ秒)
 */
function initHeroTextAnimation(targetSelector, initialDelay = 0, typingSpeed = 100) {
  const target = document.querySelector(targetSelector);
  if (!target) return;

  const originalText = target.innerHTML.replace(/<br\s*\/?>/g, '\n').trim();
  target.textContent = '';
  target.classList.add('typing-container');
  target.style.whiteSpace = 'pre-wrap';

  let i = 0;
  const type = () => {
    if (i < originalText.length) {
      if (originalText.charAt(i) === '\n') {
        target.innerHTML += '<br>';
      } else {
        target.textContent += originalText.charAt(i);
      }
      i++;
      setTimeout(type, typingSpeed);
    } else {
      target.classList.remove('typing-container');
    }
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(type, initialDelay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  observer.observe(target);
}

/**
 * (実装) 数字のカウンターアニメーション
 */
function initCounterAnimation() {
  const counters = document.querySelectorAll('.counter');
  if (counters.length === 0) return;

  const animateCounter = (counter) => {
    const target = +counter.getAttribute('data-target');
    const duration = 2000; // 2秒でアニメーション
    const stepTime = Math.abs(Math.floor(duration / target));

    let count = 0;
    const updateCount = () => {
      count++;
      counter.innerText = count;
      if (count < target) {
        setTimeout(updateCount, stepTime);
      } else {
        counter.innerText = target; // 最終値をセット
      }
    };
    updateCount();
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target); // 一度だけ実行
      }
    });
  }, { threshold: 0.7 });

  counters.forEach(counter => {
    counter.innerText = '0'; // 初期値を0に
    observer.observe(counter);
  });
}


/**
 * (実装) 活動記録一覧ページの初期化
 * dynamic-activities.jsの `loadActivityLog` 関数を呼び出すことを想定
 */
function initActivityLogPage() {
    console.log("活動記録一覧ページを初期化します。");
    // `dynamic-activities.js` に `loadActivityLog` 関数が定義されている場合
    if (typeof loadActivityLog === 'function') {
        loadActivityLog();
    } else {
        console.warn('`loadActivityLog`関数が`dynamic-activities.js`に見つかりません。');
    }
}

/**
 * (実装) 活動記録詳細ページの初期化
 * dynamic-activities.jsの `loadActivityDetail` 関数を呼び出すことを想定
 */
function initActivityDetailPage() {
    console.log("活動記録詳細ページを初期化します。");
    // `dynamic-activities.js` に `loadActivityDetail` 関数が定義されている場合
    if (typeof loadActivityDetail === 'function') {
        loadActivityDetail();
    } else {
        console.warn('`loadActivityDetail`関数が`dynamic-activities.js`に見つかりません。');
    }
}


/**
 * 各隊ロゴをタスク指定URLに差し替え
 * - index.html のユニット紹介カード最上部の円形画像
 * - 各 unit-*.html の冒頭「隊章」画像
 */
function applyUnitLogos() {
  try {
    const logos = {
      beaver: 'https://drive.usercontent.google.com/uc?export=view&id=1LKO_6YETXriZEw4xvUl7JwPEI0D98kuC',
      cub: 'https://drive.usercontent.google.com/uc?export=view&id=1RvqNJOEjG-OXUeydNNuqX2nf81Jz2db7',
      boy: 'https://drive.usercontent.google.com/uc?export=view&id=1ltXHHnuIVMS2y_0qTvxE0vCSSJEnWJof',
      venture: 'https://drive.usercontent.google.com/uc?export=view&id=10p_pcQyjG14WvptqyDepEhr-bMWHLFHg',
      rover: 'https://drive.usercontent.google.com/uc?export=view&id=1An9jXkpY25igqg7MpqFuAlFXMLrqEECa'
    };

    const path = (location.pathname || '').toLowerCase();

    // 1) トップのユニットカード（順番: ビーバー, カブ, ボーイ, ベンチャー, ローバー）
    const unitsSection = document.getElementById('units');
    if (unitsSection) {
      const imgs = unitsSection.querySelectorAll('.tilt-card-effect img');
      const order = [logos.beaver, logos.cub, logos.boy, logos.venture, logos.rover];
      for (let i = 0; i < Math.min(imgs.length, order.length); i++) {
        if (order[i]) imgs[i].src = order[i];
      }
    }

    // 2) 各隊ページの「隊章」画像
    const unitPathMap = {
      'unit-beaver.html': 'beaver',
      'unit-cub.html': 'cub',
      'unit-boy.html': 'boy',
      'unit-venture.html': 'venture',
      'unit-rover.html': 'rover',
    };
    for (const [file, key] of Object.entries(unitPathMap)) {
      if (path.endsWith('/' + file) || path.endsWith(file)) {
        const img = document.querySelector('img[alt*="隊章"]');
        if (img && logos[key]) img.src = logos[key];
        break;
      }
    }
  } catch (e) {
    console.error('Failed to apply unit logos:', e);
  }
}

// 追加: task.txt を読み取ってロゴ/隊章/団章を適用（既存処理の上から上書き）
async function applyLogosFromTaskTxt() {
  try {
    if (window.__brandingFromSettings) return; // すでに設定から適用済みなら何もしない
    const defaults = {
      beaver: 'https://drive.usercontent.google.com/uc?export=view&id=1LKO_6YETXriZEw4xvUl7JwPEI0D98kuC',
      cub: 'https://drive.usercontent.google.com/uc?export=view&id=1RvqNJOEjG-OXUeydNNuqX2nf81Jz2db7',
      boy: 'https://drive.usercontent.google.com/uc?export=view&id=1ltXHHnuIVMS2y_0qTvxE0vCSSJEnWJof',
      venture: 'https://drive.usercontent.google.com/uc?export=view&id=10p_pcQyjG14WvptqyDepEhr-bMWHLFHg',
      rover: 'https://drive.usercontent.google.com/uc?export=view&id=1An9jXkpY25igqg7MpqFuAlFXMLrqEECa',
      dan: 'https://drive.usercontent.google.com/uc?export=view&id=1MwvmVPcBdK1IOrMpvd4whbYnHIGZkDJQ'
    };

    const res = await fetch('/task.txt', { cache: 'no-store' });
    const text = res.ok ? await res.text() : '';
    const logos = { ...defaults };
    if (text) {
      text.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const parts = trimmed.split(/\s+/, 2);
        if (parts.length === 2) {
          const key = parts[0].toLowerCase();
          const url = parts[1];
          if (['beaver','cub','boy','venture','rover'].includes(key)) logos[key] = url;
          if (key === '団章' || key === 'dan' || key === 'group' || key === 'crest') logos.dan = url;
        }
      });
    }

    const path = (location.pathname || '').toLowerCase();

    // トップ「各隊の紹介」カード
    const unitsSection = document.getElementById('units');
    if (unitsSection) {
      const imgs = unitsSection.querySelectorAll('.tilt-card-effect img');
      const order = [logos.beaver, logos.cub, logos.boy, logos.venture, logos.rover];
      for (let i = 0; i < Math.min(imgs.length, order.length); i++) {
        if (order[i]) imgs[i].src = order[i];
      }
    }

    // 各ユニットページの隊章
    const unitPathMap = {
      'unit-beaver.html': 'beaver',
      'unit-cub.html': 'cub',
      'unit-boy.html': 'boy',
      'unit-venture.html': 'venture',
      'unit-rover.html': 'rover',
    };
    for (const [file, key] of Object.entries(unitPathMap)) {
      if (path.endsWith('/' + file) || path.endsWith(file)) {
        const crest = document.querySelector('main img[alt*="隊章"]') || document.querySelector('main img[alt*="章"]');
        if (crest && logos[key]) crest.src = logos[key];
        break;
      }
    }

    // 団章（ヘッダー/フッター）
    const danCrest = logos.dan;
    const headerImg = document.querySelector('header#main-header img[alt*="団章"]');
    if (headerImg && danCrest) headerImg.src = danCrest;
    const footerImg = document.querySelector('footer img[alt*="団章"]');
    if (footerImg && danCrest) footerImg.src = danCrest;
  } catch (e) {
    console.error('Failed to apply logos from task.txt:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  (async () => { try { await applyLogosFromTaskTxt(); } catch (e) { console.error(e); } })();
});
// 追加: ロゴ適用の改良版（ヘッダー/フッターの団章を保護しつつ、各隊ページの隊章だけ差し替え）
function applyUnitLogosV2() {
  try {
    const logos = {
      beaver: 'https://drive.usercontent.google.com/uc?export=view&id=1LKO_6YETXriZEw4xvUl7JwPEI0D98kuC',
      cub: 'https://drive.usercontent.google.com/uc?export=view&id=1RvqNJOEjG-OXUeydNNuqX2nf81Jz2db7',
      boy: 'https://drive.usercontent.google.com/uc?export=view&id=1ltXHHnuIVMS2y_0qTvxE0vCSSJEnWJof',
      venture: 'https://drive.usercontent.google.com/uc?export=view&id=10p_pcQyjG14WvptqyDepEhr-bMWHLFHg',
      rover: 'https://drive.usercontent.google.com/uc?export=view&id=1An9jXkpY25igqg7MpqFuAlFXMLrqEECa'
    };

    const path = (location.pathname || '').toLowerCase();
    const unitPathMap = {
      'unit-beaver.html': 'beaver',
      'unit-cub.html': 'cub',
      'unit-boy.html': 'boy',
      'unit-venture.html': 'venture',
      'unit-rover.html': 'rover',
    };

    for (const [file, key] of Object.entries(unitPathMap)) {
      if (path.endsWith('/' + file) || path.endsWith(file)) {
        // 各隊ページ: 「隊章」画像を差し替え（メイン領域のみ）
        const crest = document.querySelector('main img[alt*="隊章"]') || document.querySelector('main img[alt*="章"]');
        if (crest && logos[key]) crest.src = logos[key];

        // ヘッダー/フッターの団章は指定URLに差し替え（サイト共通）
        const danCrest = 'https://drive.usercontent.google.com/uc?export=view&id=1MwvmVPcBdK1IOrMpvd4whbYnHIGZkDJQ';
        const headerImg = document.querySelector('header#main-header img[alt*="団章"]');
        if (headerImg) headerImg.src = danCrest;
        const footerImg = document.querySelector('footer img[alt*="団章"]');
        if (footerImg) footerImg.src = danCrest;
        break;
      }
    }
  } catch (e) {
    console.error('Failed to apply unit logos (V2):', e);
  }
}

// この改良版をDOMContentLoaded後に呼び出して上書き適用
document.addEventListener('DOMContentLoaded', () => {
  try { applyUnitLogosV2(); } catch (e) { console.error(e); }
});

/**
 * (実装) お問い合わせフォームの初期化
 */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full inline-block"></span> 送信中...';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      // ここで実際のAPIエンドポイントにデータを送信します
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message || 'お問い合わせありがとうございます。メッセージが正常に送信されました。');
        form.reset();
      } else {
        throw new Error(result.message || 'サーバーでエラーが発生しました。');
      }
    } catch (error) {
      console.error('フォーム送信エラー:', error);
      alert('メッセージの送信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
    }
  });
}


/**
 * サイト共通設定をAPIから取得し、ページの該当箇所に反映させる
 */
async function applySiteSettings() {
  try {
    const response = await fetch('/api/public-settings');
    if (!response.ok) {
      console.error('Failed to fetch site settings: Network response was not ok');
      return;
    }
    const settings = await response.json();

    // 1. フッターや連絡先ページの共通情報を更新
    document.querySelectorAll('.contact-address').forEach(el => {
      el.textContent = settings.contact_address || '（住所情報未設定）';
    });
    document.querySelectorAll('.contact-phone').forEach(el => {
      const phone = settings.contact_phone || '（電話番号未設定）';
      el.textContent = phone;
      if (el.tagName === 'A') {
        el.href = 'tel:' + phone.replace(/-/g, '');
      }
    });
    document.querySelectorAll('.contact-email').forEach(el => {
      const email = settings.contact_email || '（メールアドレス未設定）';
      el.textContent = email;
      if (el.tagName === 'A') {
        el.href = 'mailto:' + email;
      }
    });

    // 2. 各隊の紹介ページに記載されているリーダー名を更新
    const leaderMapping = {
        'leader-beaver-name': 'leader_beaver',
        'leader-cub-name': 'leader_cub',
        'leader-boy-name': 'leader_boy',
        'leader-venture-name': 'leader_venture',
        'leader-rover-name': 'leader_rover'
    };
    for (const className in leaderMapping) {
        const el = document.querySelector(`.${className}`);
        if (el) {
            el.textContent = settings[leaderMapping[className]] || '（リーダー名未設定）';
        }
    }

    // 3. プライバシーポリシー関連
    const privacyMapping = {
        '#enactment-date': 'privacy_effective_date',
        '#last-updated-date': 'privacy_last_updated_date'
    };
    for (const selector in privacyMapping) {
        const el = document.querySelector(selector);
        if (el && settings[privacyMapping[selector]]) {
            el.textContent = settings[privacyMapping[selector]];
        }
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

    // 4. お問い合わせページ専用
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

    // 5. トップページの画像差し替え
    const hero = document.querySelector('.hero-bg');
    if (hero && settings.index_hero_image_url) {
      hero.style.backgroundImage = `url('${settings.index_hero_image_url}')`;
    }
    for (let i of [1, 2, 3]) {
      const el = document.getElementById(`index-activity-img-${i}`);
      const key = `index_highlight_img_${i}_url`;
      if (el && settings[key]) el.src = settings[key];
    }
    for (let i of [1, 2]) {
      const el = document.getElementById(`index-testimonial-img-${i}`);
      const key = `index_testimonial_img_${i}_url`;
      if (el && settings[key]) el.src = settings[key];
    }

    // 6. 団章（ヘッダー/フッター）
    if (settings.group_crest_url) {
      const headerImg = document.querySelector('header#main-header img[alt*="団章"]');
      if (headerImg) headerImg.src = settings.group_crest_url;
      const footerImg = document.querySelector('footer img[alt*="団章"]');
      if (footerImg) footerImg.src = settings.group_crest_url;
    }

    // 7. 各隊ロゴ（トップのカード、各隊ページの隊章）
    const logosByUnit = {
      beaver: settings.unit_beaver_logo_url,
      cub: settings.unit_cub_logo_url,
      boy: settings.unit_boy_logo_url,
      venture: settings.unit_venture_logo_url,
      rover: settings.unit_rover_logo_url,
    };
    const unitsSection2 = document.getElementById('units');
    if (unitsSection2) {
      const imgs = unitsSection2.querySelectorAll('.tilt-card-effect img');
      const order = [logosByUnit.beaver, logosByUnit.cub, logosByUnit.boy, logosByUnit.venture, logosByUnit.rover];
      for (let i = 0; i < Math.min(imgs.length, order.length); i++) {
        if (order[i]) imgs[i].src = order[i];
      }
    }
    const path = (location.pathname || '').toLowerCase();
    const unitFromPath = Object.entries({
      'unit-beaver.html': 'beaver',
      'unit-cub.html': 'cub',
      'unit-boy.html': 'boy',
      'unit-venture.html': 'venture',
      'unit-rover.html': 'rover',
    }).find(([file]) => path.endsWith('/' + file) || path.endsWith(file));
    if (unitFromPath) {
      const unitKey = unitFromPath[1];
      const crestImg = document.querySelector('main img[alt*="隊章"]') || document.querySelector('main img[alt*="章"]');
      if (crestImg && logosByUnit[unitKey]) crestImg.src = logosByUnit[unitKey];

      // 8. リーダー写真・メッセージ
      const photoKey = `unit_${unitKey}_leader_photo_url`;
      const msgKey = `unit_${unitKey}_leader_message`;
      const leaderSection = document.querySelector('section[id^="leader-message"]') || document.getElementById('leader-message');
      if (leaderSection) {
        const leaderImg = leaderSection.querySelector('img');
        if (leaderImg && settings[photoKey]) leaderImg.src = settings[photoKey];
        // 最初の「強調された段落」をメッセージとして差し替え
        const msgP = leaderSection.querySelector('p.italic, p.text-xl, p');
        if (msgP && settings[msgKey]) msgP.textContent = settings[msgKey];
      }

      // 9. ギャラリー画像
      const galleryId = `${unitKey}-gallery`;
      const gallery = document.getElementById(galleryId);
      if (gallery) {
        const imgs = gallery.querySelectorAll('img');
        for (let i = 1; i <= Math.min(4, imgs.length); i++) {
          const key = `unit_${unitKey}_gallery_img_${i}_url`;
          if (settings[key]) {
            const imgEl = imgs[i - 1];
            imgEl.src = settings[key];
            const parentLink = imgEl.closest('a');
            if (parentLink) parentLink.href = settings[key];
          }
        }
      }
    }

    // 設定由来のブランディング適用済みフラグ（task.txt の上書きを防ぐ）
    window.__brandingFromSettings = true;

  } catch (error) {
    console.error('Error applying site settings:', error);
  }
}

/**
 * 日付文字列を 'YYYY年M月D日' 形式にフォーマットする
 * @param {string} dateString - ISO 8601形式の日付文字列
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('ja-JP', options);
}

/**
 * ページ内スムーススクロールを初期化
 */
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

/**
 * フッターの年表示を現在の年に更新
 */
function initFooterYear() {
  const yearElement = document.querySelector(COMMON_SETTINGS.currentYearSelector);
  if (yearElement) yearElement.textContent = new Date().getFullYear();
}

/**
 * 要素が画面内に入ったらフェードインさせるIntersection Observerを初期化
 */
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

/**
 * スクロール時のヘッダーの挙動を初期化
 */
function initHeaderScrollBehavior() {
  const header = document.getElementById(COMMON_SETTINGS.headerId);
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
  }, { passive: true });
}

/**
 * カードのチルトエフェクトを初期化
 * @param {string} selector - 対象要素のCSSセレクタ
 */
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
  const rotateX = (y / (rect.height / 2)) * -3; // 傾き具合を調整
  const rotateY = (x / (rect.width / 2)) * 3;  // 傾き具合を調整
  card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
}
function handleTiltMouseLeave(e) {
  e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
}

/**
 * Lightboxのプレースホルダー（未実装時の代替）
 */
function initSimpleLightboxPlaceholder() {
  document.querySelectorAll('a[data-lightbox]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      alert(`画像 ${link.href} を表示します。(Lightbox未実装)`);
    });
  });
}

/**
 * 画像の遅延読み込み（Lazy Loading）を初期化
 * class="lazy" と data-src="image_url" を持つimg要素を対象とする
 */
function initLazyLoadImages() {
  const lazyImages = [].slice.call(document.querySelectorAll("img.lazy"));

  if ("IntersectionObserver" in window) {
    let lazyImageObserver = new IntersectionObserver(function(entries, observer) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          let lazyImage = entry.target;
          lazyImage.src = lazyImage.dataset.src;
          // lazyImage.srcset = lazyImage.dataset.srcset; // 必要に応じてsrcsetも
          lazyImage.classList.remove("lazy");
          lazyImageObserver.unobserve(lazyImage);
        }
      });
    });

    lazyImages.forEach(function(lazyImage) {
      lazyImageObserver.observe(lazyImage);
    });
  } else {
    // IntersectionObserverをサポートしない古いブラウザ向けのフォールバック
    // （ここでは単純にすべての画像を読み込む）
    lazyImages.forEach(function(lazyImage) {
        lazyImage.src = lazyImage.dataset.src;
        lazyImage.classList.remove("lazy");
    });
  }
}
