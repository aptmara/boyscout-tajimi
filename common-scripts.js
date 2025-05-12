// グローバルな設定やユーティリティ
const COMMON_SETTINGS = {
    headerId: 'main-header',
    fadeInSelector: '.fade-in-section',
    tiltCardSelector: '.tilt-card-effect', // CSSクラス名を変更した場合
    currentYearSelector: '#current-year',
    mobileMenuStoreName: 'mobileMenu',
    smoothScrollSelector: 'a[href^="#"]:not([href="#"])',
    scrollToTopSelector: 'a[href="#"]',
};

// --- サンプルデータ (本来はAPIやCMSから取得) ---
const sampleActivities = [
    { id: 1, title: "【活動報告】夏の友情キャンプ開催！", date: "2025-05-15", category: "キャンプ", categoryColor: "bg-blue-500", imageUrl: "https://placehold.co/600x400/4A934A/FFFFFF?text=夏のキャンプ風景1", mainImage: "https://placehold.co/1200x600/4A934A/FFFFFF?text=夏のキャンプ風景メイン1", mainImageCaption: "メインの活動写真キャプション1", author: "カブ隊リーダー", views: 123, summary: "最高の天気の中、カブ隊とボーイ隊合同で夏の友情キャンプを実施しました。", bodyContent: `<p>最高の天気に恵まれた先週末、カブ隊とボーイ隊は合同で夏の友情キャンプを〇〇キャンプ場で開催しました。</p><h2 class="text-2xl font-semibold text-green-600 mt-8 mb-4">テント設営と野外料理</h2><p>スカウトたちは協力してテントを設営し、野外料理にも挑戦。自分たちで作ったカレーは格別でした。</p><figure class="my-6"><img src="https://placehold.co/800x500/5A69C4/FFFFFF?text=テント設営の様子1" alt="テント設営"><figcaption class="text-sm text-gray-500 mt-1 text-center">テント設営風景</figcaption></figure><h2 class="text-2xl font-semibold text-green-600 mt-8 mb-4">キャンプファイヤー</h2><p>夜はキャンプファイヤーで盛り上がり、歌やスタンツで友情を深めました。</p>`, gallery: [{ thumb: "https://placehold.co/400x300/4CAF50/FFFFFF?text=キャンプ写真A1", full: "https://placehold.co/800x600/4CAF50/FFFFFF?text=キャンプ写真A1", title: "キャンプファイヤー" },{ thumb: "https://placehold.co/400x300/FF9800/FFFFFF?text=キャンプ写真A2", full: "https://placehold.co/800x600/FF9800/FFFFFF?text=キャンプ写真A2", title: "野外料理" }] },
    { id: 2, title: "【活動報告】秋の森探検とクラフト体験", date: "2025-10-05", category: "ビーバー隊", categoryColor: "bg-yellow-500", imageUrl: "https://placehold.co/600x400/FBBF24/FFFFFF?text=秋の森探検1", mainImage: "https://placehold.co/1200x600/FBBF24/4A5568?text=秋の森探検メイン", mainImageCaption: "落ち葉の絨毯の上で、秋の自然を満喫！", author: "ビーバー隊リーダー", views: 98, summary: "秋晴れの気持ち良い日曜日、ビーバー隊は近くの森へ探検に出かけました。", bodyContent: `<p>秋晴れの気持ち良い日曜日、ビーバー隊のスカウトたちは近くの〇〇の森へ探検に出かけました。色とりどりの落ち葉を踏みしめながら、ドングリや松ぼっくりなど、秋の宝物をたくさん見つけました。</p><h2 class="text-2xl font-semibold text-green-600 mt-8 mb-4">自然の素材でアート作品！</h2><p>森で集めた材料を使って、午後はクラフト活動に挑戦。スカウトたちは思い思いのアイデアで、素敵な作品を完成させていました。</p>`, gallery: [{ thumb: "https://placehold.co/400x300/FBBF24/FFFFFF?text=秋の森B1", full: "https://placehold.co/800x600/FBBF24/FFFFFF?text=秋の森B1", title: "ドングリ拾い" }] },
    { id: 3, title: "【活動報告】ボーイ隊、パイオニアリングに挑戦", date: "2025-11-12", category: "ボーイ隊", categoryColor: "bg-blue-600", imageUrl: "https://placehold.co/600x400/3B82F6/FFFFFF?text=パイオニアリング1", mainImage: "https://placehold.co/1200x600/3B82F6/FFFFFF?text=パイオニアリングメイン", mainImageCaption: "班で協力して信号塔を組立て中！", author: "ボーイ隊隊長", views: 150, summary: "ボーイ隊は週末、パイオニアリング（工作物組立）の技能訓練を行いました。", bodyContent: `<p>ボーイ隊は週末、パイオニアリング（工作物組立）の技能訓練を行いました。各班が知恵を絞り、ロープと丸太だけを使って実用的な信号塔やテーブル作りに挑戦しました。</p><h2 class="text-2xl font-semibold text-green-600 mt-8 mb-4">計画と実践</h2><p>事前の計画と、現場での臨機応変な対応が求められる活動です。スカウトたちは何度も試行錯誤を繰り返しながら、見事な工作物を完成させました。</p>`, gallery: [{ thumb: "https://placehold.co/400x300/3B82F6/FFFFFF?text=パイオニアリング1", full: "https://placehold.co/800x600/3B82F6/FFFFFF?text=パイオニアリング1", title: "ロープワークの確認" }, { thumb: "https://placehold.co/400x300/3B82F6/FFFFFF?text=パイオニアリング2", full: "https://placehold.co/800x600/3B82F6/FFFFFF?text=パイオニアリング2", title: "完成した信号塔" }] },
    { id: 4, title: "ベンチャー隊、地域防災マップを作成", date: "2025-09-20", category: "ベンチャー隊", categoryColor: "bg-purple-500", imageUrl: "https://placehold.co/600x400/A855F7/FFFFFF?text=防災マップ作成", mainImage: "https://placehold.co/1200x600/A855F7/FFFFFF?text=防災マップ作成メイン", mainImageCaption: "地域の危険箇所や避難場所を調査", author: "ベンチャー隊アドバイザー", views: 110, summary: "ベンチャー隊が自主プロジェクトとして、地域の防災マップ作成に取り組みました。", bodyContent: `<p>ベンチャー隊のスカウトたちが、自主プロジェクトとして地域の防災マップ作成に取り組みました。数ヶ月にわたり、地域の危険箇所や避難場所を実際に歩いて調査し、住民の方々へのヒアリングも行いました。</p><h2 class="text-2xl font-semibold text-green-600 mt-8 mb-4">完成したマップは地域へ寄贈</h2><p>完成した防災マップは、地域の公民館や自治会に寄贈され、住民の防災意識向上に役立てられる予定です。スカウトたちは、このプロジェクトを通じて地域社会への貢献を実感しました。</p>`, gallery: [] },
    { id: 5, title: "ローバー隊、国際協力イベントを企画", date: "2025-07-05", category: "ローバー隊", categoryColor: "bg-red-500", imageUrl: "https://placehold.co/600x400/EF4444/FFFFFF?text=国際協力イベント", mainImage: "https://placehold.co/1200x600/EF4444/FFFFFF?text=国際協力イベントメイン", mainImageCaption: "イベントの企画会議の様子", author: "ローバー隊クルー", views: 85, summary: "ローバー隊が、開発途上国支援のためのチャリティイベントを企画・運営しました。", bodyContent: `<p>ローバー隊のクルー（仲間たち）が、開発途上国の子どもたちを支援するためのチャリティバザーと写真展を企画・運営しました。イベントの収益は、認定NPO法人を通じて寄付されます。</p><h2 class="text-2xl font-semibold text-green-600 mt-8 mb-4">多くの来場者で賑わう</h2><p>当日は多くの地域住民が訪れ、バザー品を購入したり、現地の様子を伝える写真展に見入ったりしていました。スカウトたちは、イベントを通じて国際協力への関心を高めることができました。</p>`, gallery: [{ thumb: "https://placehold.co/400x300/EF4444/FFFFFF?text=バザーの様子", full: "https://placehold.co/800x600/EF4444/FFFFFF?text=バザーの様子", title: "チャリティバザー" }] },
    { id: 6, title: "ビーバー隊、春の草花観察会", date: "2026-04-10", category: "ビーバー隊", categoryColor: "bg-yellow-500", imageUrl: "https://placehold.co/600x400/FBBF24/FFFFFF?text=草花観察", mainImage: "https://placehold.co/1200x600/FBBF24/FFFFFF?text=草花観察メイン", mainImageCaption: "春の草花をスケッチ", author: "ビーバー隊リーダー", views: 75, summary: "ビーバー隊が春の公園で草花観察会を実施。見つけた草花をスケッチしました。", bodyContent: "<p>春の陽気に誘われて、ビーバー隊は近くの公園で草花観察会を行いました。タンポポやシロツメクサなど、たくさんの春の草花を見つけ、ルーペで観察したり、スケッチしたりして楽しみました。</p>", gallery: [] },
    { id: 7, title: "カブ隊、手旗信号に挑戦！", date: "2026-03-15", category: "カブ隊", categoryColor: "bg-teal-500", imageUrl: "https://placehold.co/600x400/5EEAD4/FFFFFF?text=手旗信号", mainImage: "https://placehold.co/1200x600/5EEAD4/FFFFFF?text=手旗信号メイン", mainImageCaption: "手旗信号でメッセージを伝える練習", author: "カブ隊リーダー", views: 92, summary: "カブ隊が手旗信号の基本を学び、簡単なメッセージの送受信に挑戦しました。", bodyContent: "<p>カブ隊は、手旗信号の基本動作とアルファベットの送り方を学びました。最初は難しかったものの、練習を重ねるうちに、短い単語なら送受信できるようになりました。次回のハイキングで実践する予定です。</p>", gallery: [] },
    { id: 8, title: "ボーイ隊、応急手当講習会", date: "2026-02-20", category: "技能章", categoryColor: "bg-purple-500", imageUrl: "https://placehold.co/600x400/C084FC/FFFFFF?text=応急手当", mainImage: "https://placehold.co/1200x600/C084FC/FFFFFF?text=応急手当メイン", mainImageCaption: "三角巾の使い方を学ぶスカウトたち", author: "ボーイ隊隊長", views: 130, summary: "ボーイ隊が消防署の方を講師に招き、応急手当講習会を実施しました。", bodyContent: "<p>ボーイ隊は、万が一の事態に備えるため、消防署の方を講師にお招きし、応急手当講習会を実施しました。心肺蘇生法や三角巾を使った固定法などを学び、実践的な訓練を行いました。</p>", gallery: [] },
    { id: 9, title: "団行事：新年もちつき大会", date: "2026-01-08", category: "団行事", categoryColor: "bg-red-500", imageUrl: "https://placehold.co/600x400/F87171/FFFFFF?text=もちつき", mainImage: "https://placehold.co/1200x600/F87171/FFFFFF?text=もちつきメイン", mainImageCaption: "みんなでついたお餅は格別！", author: "団委員長", views: 210, summary: "新年の恒例行事、もちつき大会を盛大に開催しました。", bodyContent: "<p>新年あけましておめでとうございます。恒例のもちつき大会を団キャンプ場で開催しました。スカウト、リーダー、保護者が一体となり、力強くお餅をつきあげました。つきたてのお餅はきな粉やあんこで美味しくいただきました。</p>", gallery: [] },
    { id: 10, title: "地域清掃活動への参加", date: "2025-12-05", category: "地域奉仕", categoryColor: "bg-yellow-500", imageUrl: "https://placehold.co/600x400/FCD34D/FFFFFF?text=地域清掃2", mainImage: "https://placehold.co/1200x600/FCD34D/FFFFFF?text=地域清掃2メイン", mainImageCaption: "街をきれいにするスカウトたち", author: "団本部", views: 105, summary: "年末の地域一斉清掃活動に、当団のスカウトも参加しました。", bodyContent: "<p>年末恒例の地域一斉清掃活動に、ボーイスカウト多治見第一団も参加しました。各隊のスカウトたちが、それぞれの担当区域でゴミ拾いや落ち葉掃きを行い、街の美化に貢献しました。</p>", gallery: [] },
];

const sampleNewsDataArray = [
    { id: 1, title: "夏のキャンプ大会 参加者募集開始！", date: "2025-05-10", category: "イベント", categoryColor: "bg-blue-500", summary: "今年の夏も恒例のキャンプ大会を開催します。", detailUrl: "news-detail-placeholder.html?id=1", bodyContent: "<p>夏のキャンプ大会の詳細ページです。楽しい企画をたくさん用意しています！参加申し込みは〇月〇日まで。奮ってご参加ください。</p><p>キャンプのテーマは「星と友達」。夜空の観察や、新しい仲間との交流を深めるプログラムが盛りだくさんです。参加費や持ち物については、別途配布する案内をご確認ください。</p>" },
    { id: 2, title: "【重要】団総会の開催について", date: "2025-04-28", category: "重要", categoryColor: "bg-red-500", summary: "次回の団総会を6月15日に開催いたします。", detailUrl: "news-detail-placeholder.html?id=2", bodyContent: `<p>保護者の皆様、関係各位</p><p>平素はボーイスカウト多治見第一団の活動にご理解とご協力を賜り、厚く御礼申し上げます。</p><p>さて、この度、下記の通り令和6年度（2025年度）の団総会を開催する運びとなりましたので、ご案内申し上げます。本総会は、当団の運営に関する重要な事項を審議・決定する場であり、また、一年間の活動を振り返り、今後の活動方針を共有する大切な機会でもございます。ご多忙のところ誠に恐縮ではございますが、万障お繰り合わせの上、ご出席くださいますようお願い申し上げます。</p><h2 class="text-2xl font-semibold text-green-600 mt-8 mb-4">令和6年度 団総会 開催要項</h2><ul><li><strong>日時:</strong> 2025年6月15日 (日) 10:00 ～ 12:00 (受付開始 9:30)</li><li><strong>場所:</strong> 多治見市〇〇公民館 大会議室 (予定)</li><li><strong>議題 (予定):</strong><ul><li>令和5年度 活動報告および会計報告</li><li>令和5年度 会計監査報告</li><li>令和6年度 活動計画案および予算案</li><li>役員改選について</li><li>その他</li></ul></li></ul><h3 class="text-xl font-semibold text-green-600 mt-6 mb-3">出欠について</h3><p>出欠につきましては、別途配布いたします出欠票にご記入の上、<strong>6月5日 (木) まで</strong>に各隊リーダーまたは団事務局までご提出ください。やむを得ずご欠席される場合は、委任状のご提出をお願いいたします。</p><figure class="my-6"><img src="https://placehold.co/800x400/D1FAE5/10B981?text=会議・集会のイメージ" alt="総会のイメージ"><figcaption class="text-sm text-gray-500 mt-1 text-center">皆様のご参加をお待ちしております</figcaption></figure><p>本総会が実りあるものとなりますよう、皆様のご協力を心よりお願い申し上げます。</p><p class="text-right mt-6">ボーイスカウト多治見第一団<br>団委員長 [団委員長名]</p>` },
    { id: 3, title: "春の地域清掃活動を実施しました", date: "2025-04-15", category: "活動報告", categoryColor: "bg-green-500", summary: "スカウトたちが地域の公園清掃活動に参加しました。", detailUrl: "news-detail-placeholder.html?id=3", bodyContent: "<p>先日、春の地域清掃活動に当団のスカウトたちが参加しました。公園や川沿いのゴミを拾い集め、地域美化に貢献しました。参加したスカウトからは「街がきれいになって気持ちがいい」との声が聞かれました。</p>" },
    { id: 4, title: "新入団員募集説明会のお知らせ", date: "2025-03-20", category: "募集", categoryColor: "bg-yellow-500", summary: "来年度の新入団員募集に関する説明会を開催します。", detailUrl: "news-detail-placeholder.html?id=4", bodyContent: "<p>ボーイスカウト活動に興味のあるお子様と保護者の皆様を対象に、新入団員募集説明会を開催いたします。活動内容のご紹介や質疑応答の時間を設けますので、お気軽にご参加ください。<br><strong>日時:</strong> 2025年4月5日(土) 14:00～15:00<br><strong>場所:</strong> 〇〇公民館</p>" },
    { id: 5, title: "ウェブサイトをリニューアルしました！", date: "2025-03-01", category: "その他", categoryColor: "bg-purple-500", summary: "公式ウェブサイトが新しくなりました。", detailUrl: "news-detail-placeholder.html?id=5", bodyContent: "<p>日頃よりボーイスカウト多治見第一団のウェブサイトをご覧いただき、誠にありがとうございます。この度、ウェブサイトを全面的にリニューアルいたしました。より見やすく、情報を探しやすく改善しております。今後ともご愛顧賜りますようお願い申し上げます。</p>" },
    { id: 6, title: "冬季スキー訓練 中止のお知らせ", date: "2025-01-10", category: "重要", categoryColor: "bg-red-500", summary: "積雪不足のため、予定しておりました冬季スキー訓練は中止とさせていただきます。ご了承ください。", detailUrl: "news-detail-placeholder.html?id=6", bodyContent: "<p>保護者の皆様、スカウト諸君</p><p>非常に残念なお知らせとなりますが、今週末に予定しておりました冬季スキー訓練は、現地での積雪が極めて少ないため、安全な活動の実施が困難と判断し、中止とさせていただくことになりました。</p><p>楽しみにしていたスカウトの皆さんには大変申し訳ございませんが、ご理解いただけますようお願いいたします。代替行事については、改めて検討しご連絡いたします。</p>" },
    { id: 7, title: "クリスマス集会のご報告", date: "2024-12-22", category: "活動報告", categoryColor: "bg-green-500", summary: "各隊合同でクリスマス集会を開催し、ゲームやプレゼント交換で楽しいひとときを過ごしました。", detailUrl: "news-detail-placeholder.html?id=7", bodyContent: "<p>先日、団ホールにてクリスマス集会を開催しました。ビーバー隊からローバー隊まで、全隊のスカウトとリーダー、そして多くの保護者の皆様にご参加いただき、盛況のうちに幕を閉じました。</p><p>各隊のスタンツ発表や、全員参加のゲーム、そしてお待ちかねのプレゼント交換など、笑顔あふれる時間となりました。スカウトたちが準備した手作りの飾り付けも会場を彩り、温かい雰囲気の中でクリスマスの喜びを分かち合いました。</p>" },
    { id: 8, title: "秋の味覚ハイク 参加者募集", date: "2024-10-05", category: "イベント", categoryColor: "bg-blue-500", summary: "紅葉の中を歩き、秋の味覚を楽しむハイキングイベントです。ご家族での参加も大歓迎！", detailUrl: "news-detail-placeholder.html?id=8", bodyContent: "<p>実りの秋、紅葉の美しい季節となりました。下記の日程で「秋の味覚ハイク」を開催いたします。多治見の自然を満喫しながら、道中では秋ならではの味覚探しも予定しています。ご家族やお友達をお誘い合わせの上、ぜひご参加ください。</p><p><strong>日時:</strong> 2024年11月3日(日) 9:00集合<br><strong>集合場所:</strong> 〇〇公園入口<br><strong>持ち物:</strong> お弁当、水筒、雨具、帽子、軍手、レジャーシート、筆記用具<br><strong>参加費:</strong> 300円（保険料・材料費として）<br><strong>申込締切:</strong> 10月25日(金)</p><p>詳細は各隊リーダーまでお問い合わせください。</p>" }
];


// Alpine.js ストアの初期化
document.addEventListener('alpine:init', () => {
    Alpine.store(COMMON_SETTINGS.mobileMenuStoreName, {
        isOpen: false,
        toggle() { this.isOpen = !this.isOpen; document.body.style.overflow = this.isOpen ? 'hidden' : ''; },
        close() { this.isOpen = false; document.body.style.overflow = ''; }
    });
});

// DOMContentLoaded後に行う共通初期化処理
document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initFooterYear();
    initIntersectionObserver();
    initHeaderScrollBehavior();
    initTiltEffect(); 

    initNewsListPage(); 
    initActivityLogPage();
    initContactForm(); 
    initHeroTextAnimation(); 
    initCounterAnimation(); 
    initSimpleLightboxPlaceholder();
    initActivityDetailPage(); 
    initNewsDetailPage();
});


// --- 共通関数 ---
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ja-JP', options);
}

function initSmoothScroll() {
    document.querySelectorAll(COMMON_SETTINGS.smoothScrollSelector).forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const mobileMenuStore = Alpine.store(COMMON_SETTINGS.mobileMenuStoreName);
            if (mobileMenuStore.isOpen) mobileMenuStore.close();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId); 
            if (targetElement) {
                e.preventDefault();
                const header = document.getElementById(COMMON_SETTINGS.headerId);
                const headerOffset = header ? header.offsetHeight : 0;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const additionalPageOffset = 10; // ヘッダー下部の追加マージン (px)
				const offsetPosition = elementPosition + window.scrollY - headerOffset - additionalPageOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            } else if (this.pathname === window.location.pathname) {
                 e.preventDefault();
                 window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    document.querySelectorAll(COMMON_SETTINGS.scrollToTopSelector).forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const mobileMenuStore = Alpine.store(COMMON_SETTINGS.mobileMenuStoreName);
            if (mobileMenuStore.isOpen) mobileMenuStore.close();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function initFooterYear() {
    const yearElement = document.querySelector(COMMON_SETTINGS.currentYearSelector);
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
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
        if (window.pageYOffset > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
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
    // この関数は、Lightboxライブラリを導入する際に、その初期化コードに置き換えます。
    // 例: basicLightbox の場合
    // document.querySelectorAll('a[data-lightbox]').forEach(link => {
    //     link.addEventListener('click', (e) => {
    //         e.preventDefault();
    //         const imageUrl = link.href;
    //         const caption = link.dataset.caption || link.dataset.title || '';
    //         const instance = basicLightbox.create(`
    //             <div class="relative">
    //                 <img src="${imageUrl}" alt="${caption}" class="max-w-full max-h-screen">
    //                 ${caption ? `<p class="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-75 text-white text-center">${caption}</p>` : ''}
    //             </div>
    //         `);
    //         instance.show();
    //     });
    // });
    console.log("SimpleLightboxPlaceholder initialized (actual Lightbox library needed for full functionality).");
}


// --- お知らせ一覧ページ (news-list.html) ---
function initNewsListPage() {
    const newsListContainer = document.getElementById('news-list-container');
    if (!newsListContainer) return; 

    const newsPaginationContainer = document.getElementById('news-pagination-container');
    const newsCategoryFilter = document.getElementById('news-category-filter');
    const newsDateFilter = document.getElementById('news-date-filter');
    const newsFilterButton = document.getElementById('news-filter-button');
    const noNewsResultsDiv = document.getElementById('no-news-results');
    const filterButtonText = document.getElementById('filter-button-text'); 
    const filterLoadingSpinner = document.getElementById('filter-loading-spinner'); 

    const NEWS_ITEMS_PER_PAGE = 5; 
    let currentNewsPage = 1;

    function renderNewsItem(news) {
        let categoryColorClass = "bg-gray-400"; 
        let categoryBorderClass = "border-gray-400";
        switch (news.category) {
            case "重要": categoryColorClass = "bg-red-500"; categoryBorderClass = "border-red-500"; break;
            case "イベント": categoryColorClass = "bg-blue-500"; categoryBorderClass = "border-blue-500"; break;
            case "活動報告": categoryColorClass = "bg-green-500"; categoryBorderClass = "border-green-500"; break;
            case "募集": categoryColorClass = "bg-yellow-500"; categoryBorderClass = "border-yellow-500"; break;
            case "その他": categoryColorClass = "bg-purple-500"; categoryBorderClass = "border-purple-500"; break;
        }
        return `
            <article class="news-item bg-white p-6 rounded-xl shadow-lg border-l-4 ${categoryBorderClass} flex flex-col sm:flex-row gap-6 card-hover-effect">
                <div class="sm:w-2/3">
                    <a href="${news.detailUrl}" class="news-item-link group block">
                        <div class="flex items-center justify-between mb-2">
                            <p class="text-xs text-gray-500">${formatDate(news.date)}</p>
                            <span class="${categoryColorClass} text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">${news.category}</span>
                        </div>
                        <h3 class="text-xl font-semibold text-gray-800 mb-2 group-hover:text-green-700 transition-colors duration-300">${news.title}</h3>
                        <p class="text-gray-600 leading-relaxed text-sm line-clamp-2">${news.summary}</p>
                    </a>
                </div>
                <div class="sm:w-1/3 flex sm:flex-col items-end sm:items-start justify-between mt-4 sm:mt-0">
                    <a href="${news.detailUrl}" class="text-sm text-green-600 hover:text-green-800 font-medium transition-colors duration-300 self-end sm:self-start sm:mt-auto">詳しく見る &rarr;</a>
                </div>
            </article>`;
    }

    function renderNewsPagination(totalItems, currentPage) {
        if (!newsPaginationContainer) return;
        const totalPages = Math.ceil(totalItems / NEWS_ITEMS_PER_PAGE);
        if (totalPages <= 1) {
            newsPaginationContainer.innerHTML = ''; return;
        }
        let paginationHTML = '<ul class="inline-flex items-center -space-x-px shadow-sm rounded-md">';
        paginationHTML += `<li><button data-page="${currentPage - 1}" aria-label="前のページへ" class="news-pagination-button pagination-button ${currentPage === 1 ? 'pagination-disabled' : ''}"><span class="sr-only">前へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<li><button data-page="${i}" aria-label="${i}ページ目へ" class="news-pagination-button pagination-button ${i === currentPage ? 'pagination-active' : ''}">${i}</button></li>`;
        }
        paginationHTML += `<li><button data-page="${currentPage + 1}" aria-label="次のページへ" class="news-pagination-button pagination-button ${currentPage === totalPages ? 'pagination-disabled' : ''}"><span class="sr-only">次へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
        paginationHTML += '</ul>';
        newsPaginationContainer.innerHTML = paginationHTML;

        newsPaginationContainer.querySelectorAll('.news-pagination-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const page = parseInt(e.currentTarget.dataset.page);
                if (page && page !== currentNewsPage && page > 0 && page <= totalPages) {
                    currentNewsPage = page;
                    applyNewsFiltersAndDisplay();
                    const header = document.getElementById(COMMON_SETTINGS.headerId);
                    const headerOffset = header ? header.offsetHeight : 0;
                    if (newsListContainer) window.scrollTo({ top: newsListContainer.offsetTop - headerOffset - 20 , behavior: 'smooth' });
                }
            });
        });
    }

    function displayNewsItems(newsToDisplay) {
        newsListContainer.innerHTML = ''; 
        if (newsToDisplay.length === 0) {
            if(noNewsResultsDiv) noNewsResultsDiv.classList.remove('hidden');
            if(newsPaginationContainer) newsPaginationContainer.innerHTML = '';
            return;
        }
        if(noNewsResultsDiv) noNewsResultsDiv.classList.add('hidden');

        const startIndex = (currentNewsPage - 1) * NEWS_ITEMS_PER_PAGE;
        const endIndex = startIndex + NEWS_ITEMS_PER_PAGE;
        const paginatedNews = newsToDisplay.slice(startIndex, endIndex);
        paginatedNews.forEach(news => newsListContainer.innerHTML += renderNewsItem(news));
        renderNewsPagination(newsToDisplay.length, currentNewsPage);
    }
    
    function applyNewsFiltersAndDisplay() {
        if (filterButtonText) filterButtonText.classList.add('hidden');
        if (filterLoadingSpinner) filterLoadingSpinner.classList.remove('hidden');
        if (newsFilterButton) newsFilterButton.disabled = true;

        setTimeout(() => {
            const selectedCategory = newsCategoryFilter.value;
            const selectedDate = newsDateFilter.value; 
            let filteredNews = sampleNewsDataArray.filter(news => {
                const categoryMatch = selectedCategory === 'all' || news.category === selectedCategory;
                let dateMatch = true;
                if (selectedDate) {
                    const newsYearMonth = news.date.substring(0, 7);
                    dateMatch = newsYearMonth === selectedDate;
                }
                return categoryMatch && dateMatch;
            });
            
            if (filteredNews.length > 0 && (currentNewsPage -1) * NEWS_ITEMS_PER_PAGE >= filteredNews.length) {
                currentNewsPage = 1;
            }
            displayNewsItems(filteredNews);

            if (filterButtonText) filterButtonText.classList.remove('hidden');
            if (filterLoadingSpinner) filterLoadingSpinner.classList.add('hidden');
            if (newsFilterButton) newsFilterButton.disabled = false;
        }, 300);
    }

    if (newsFilterButton) {
        newsFilterButton.addEventListener('click', () => {
            currentNewsPage = 1; 
            applyNewsFiltersAndDisplay();
        });
    }
    displayNewsItems(sampleNewsDataArray);
}

// --- 活動報告一覧ページ (activity-log.html) ---
function initActivityLogPage() {
    const container = document.getElementById('activity-log-container');
    if (!container) return;

    const paginationContainer = document.getElementById('activity-pagination-container');
    const categoryFilter = document.getElementById('activity-category-filter');
    const dateFilter = document.getElementById('activity-date-filter');
    const filterButton = document.getElementById('activity-filter-button');
    const noResultsDiv = document.getElementById('no-activity-results');
    const filterButtonText = document.getElementById('activity-filter-button-text');
    const filterLoadingSpinner = document.getElementById('activity-filter-loading-spinner');
    
    const ACTIVITY_ITEMS_PER_PAGE = 6;
    let currentPage = 1;

    function renderActivityCard(activity) {
        let categoryColorClass = "bg-gray-500";
        switch (activity.category) {
            case "キャンプ": categoryColorClass = "bg-blue-500"; break;
            case "地域奉仕": categoryColorClass = "bg-yellow-500"; break;
            case "技能章": categoryColorClass = "bg-purple-500"; break;
            case "団行事": categoryColorClass = "bg-red-500"; break;
            case "カブ隊": categoryColorClass = "bg-teal-500"; break;
            case "ビーバー隊": categoryColorClass = "bg-orange-500"; break;
            case "ボーイ隊": categoryColorClass = "bg-indigo-500"; break;
            case "ベンチャー隊": categoryColorClass = "bg-pink-500"; break;
            case "ローバー隊": categoryColorClass = "bg-rose-500"; break;
            default: categoryColorClass = "bg-gray-500";
        }
        return `
            <article class="tilt-card-effect bg-white rounded-xl shadow-xl overflow-hidden card-hover-effect group flex flex-col">
                <a href="activity-detail-placeholder.html?id=${activity.id}" class="block">
                    <div class="relative">
                        <img src="${activity.imageUrl || 'https://placehold.co/600x400/cccccc/969696?text=Image+Not+Found'}" alt="${activity.title}" class="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110">
                        <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
                        <span class="absolute top-4 left-4 ${categoryColorClass} text-white text-xs font-semibold px-2.5 py-1 rounded-full">${activity.category}</span>
                    </div>
                    <div class="p-6 flex-grow">
                        <p class="text-sm text-gray-500 mb-1">${formatDate(activity.date)}</p>
                        <h3 class="text-xl font-semibold text-green-800 mb-3 group-hover:text-blue-600 transition-colors">${activity.title}</h3>
                        <p class="text-gray-700 leading-relaxed line-clamp-3 mb-4">${activity.summary}</p>
                    </div>
                </a>
                <div class="p-6 pt-0 mt-auto">
                     <a href="activity-detail-placeholder.html?id=${activity.id}" class="inline-block text-green-600 hover:text-green-800 font-semibold transition-colors duration-300 group">続きを読む <span class="transition-transform duration-300 inline-block group-hover:translate-x-1">&rarr;</span></a>
                </div>
            </article>`;
    }

    function renderActivityPagination(totalItems, currentPage) {
        if (!paginationContainer) return;
        const totalPages = Math.ceil(totalItems / ACTIVITY_ITEMS_PER_PAGE);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = ''; return;
        }
        let paginationHTML = '<ul class="inline-flex items-center -space-x-px shadow-sm rounded-md">';
        paginationHTML += `<li><button data-page="${currentPage - 1}" aria-label="前のページへ" class="activity-pagination-button pagination-button ${currentPage === 1 ? 'pagination-disabled' : ''}"><span class="sr-only">前へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<li><button data-page="${i}" aria-label="${i}ページ目へ" class="activity-pagination-button pagination-button ${i === currentPage ? 'pagination-active' : ''}">${i}</button></li>`;
        }
        paginationHTML += `<li><button data-page="${currentPage + 1}" aria-label="次のページへ" class="activity-pagination-button pagination-button ${currentPage === totalPages ? 'pagination-disabled' : ''}"><span class="sr-only">次へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
        paginationHTML += '</ul>';
        paginationContainer.innerHTML = paginationHTML;

        paginationContainer.querySelectorAll('.activity-pagination-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const page = parseInt(e.currentTarget.dataset.page);
                if (page && page !== currentPage && page > 0 && page <= totalPages) {
                    currentPage = page;
                    applyActivityFiltersAndDisplay();
                    const header = document.getElementById(COMMON_SETTINGS.headerId);
                    const headerOffset = header ? header.offsetHeight : 0;
                    if (container) window.scrollTo({ top: container.offsetTop - headerOffset - 20, behavior: 'smooth' });
                }
            });
        });
    }

    function displayActivities(activitiesToDisplay) {
        container.innerHTML = '';
        if (activitiesToDisplay.length === 0) {
            if(noResultsDiv) noResultsDiv.classList.remove('hidden');
            if(paginationContainer) paginationContainer.innerHTML = '';
            return;
        }
        if(noResultsDiv) noResultsDiv.classList.add('hidden');

        const startIndex = (currentPage - 1) * ACTIVITY_ITEMS_PER_PAGE;
        const endIndex = startIndex + ACTIVITY_ITEMS_PER_PAGE;
        const paginatedActivities = activitiesToDisplay.slice(startIndex, endIndex);
        paginatedActivities.forEach(activity => container.innerHTML += renderActivityCard(activity));
        renderActivityPagination(activitiesToDisplay.length, currentPage);
        initTiltEffect('#activity-log-container .tilt-card-effect'); 
    }

    function applyActivityFiltersAndDisplay() {
        if (filterButtonText) filterButtonText.classList.add('hidden');
        if (filterLoadingSpinner) filterLoadingSpinner.classList.remove('hidden');
        if (filterButton) filterButton.disabled = true;

        setTimeout(() => {
            const selectedCategory = categoryFilter.value;
            const selectedDate = dateFilter.value;
            let filteredActivities = sampleActivities.filter(activity => { 
                const categoryMatch = selectedCategory === 'all' || activity.category === selectedCategory;
                let dateMatch = true;
                if (selectedDate) {
                    const activityYearMonth = activity.date.substring(0, 7);
                    dateMatch = activityYearMonth === selectedDate;
                }
                return categoryMatch && dateMatch;
            });

            if (filteredActivities.length > 0 && (currentPage - 1) * ACTIVITY_ITEMS_PER_PAGE >= filteredActivities.length) {
                currentPage = 1;
            }
            displayActivities(filteredActivities);

            if (filterButtonText) filterButtonText.classList.remove('hidden');
            if (filterLoadingSpinner) filterLoadingSpinner.classList.add('hidden');
            if (filterButton) filterButton.disabled = false;
        }, 300);
    }

    if (filterButton) {
        filterButton.addEventListener('click', () => {
            currentPage = 1;
            applyActivityFiltersAndDisplay();
        });
    }
    displayActivities(sampleActivities);
}


// --- お問い合わせフォーム (contact.html) ---
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    const nameError = document.getElementById('name-error');
    const emailError = document.getElementById('email-error');
    const messageError = document.getElementById('message-error');
    const formSuccessMessage = document.getElementById('form-success-message');
    const formErrorMessage = document.getElementById('form-error-message');

    contactForm.addEventListener('submit', function(event) {
        event.preventDefault();
        let isValid = true;

        [nameError, emailError, messageError, formSuccessMessage, formErrorMessage].forEach(el => {
            if(el) el.classList.add('hidden');
        });

        if (nameInput.value.trim() === '') { if(nameError) nameError.classList.remove('hidden'); isValid = false; }
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(emailInput.value.trim())) { if(emailError) emailError.classList.remove('hidden'); isValid = false; }
        if (messageInput.value.trim() === '') { if(messageError) messageError.classList.remove('hidden'); isValid = false; }

        if (isValid) {
            console.log('Contact Form data:', { 
                name: nameInput.value,
                email: emailInput.value,
                phone: document.getElementById('phone') ? document.getElementById('phone').value : '',
                subject: document.getElementById('subject') ? document.getElementById('subject').value : '',
                message: messageInput.value
            });
            if (Math.random() > 0.2) { 
                if(formSuccessMessage) formSuccessMessage.classList.remove('hidden');
                contactForm.reset();
            } else {
                if(formErrorMessage) formErrorMessage.classList.remove('hidden');
            }
        } else {
            console.log('Contact form validation failed');
        }
    });
}

// --- トップページ (index.html) ---
function initHeroTextAnimation() {
    const heroTitle = document.getElementById('hero-title');
    if (!heroTitle) return;

    const heroSubtitle = document.getElementById('hero-subtitle');
    const heroButtons = document.querySelectorAll('#hero a.hero-title-char');

    const text = heroTitle.innerHTML.trim();
    heroTitle.innerHTML = ''; 
    const parts = text.split('<br>').map(part => part.trim());

    parts.forEach((part, partIndex) => {
        const words = part.split(/\s+/);
        words.forEach((word, wordIndex) => {
            const wordSpan = document.createElement('span');
            word.split('').forEach((char, charIndex) => {
                const charSpan = document.createElement('span');
                charSpan.textContent = char;
                charSpan.classList.add('hero-title-char');
                charSpan.style.transitionDelay = `${(partIndex * words.length + wordIndex) * 0.08 + charIndex * 0.025}s`;
                wordSpan.appendChild(charSpan);
            });
            heroTitle.appendChild(wordSpan);
            if (wordIndex < words.length - 1) heroTitle.append(' ');
        });
        if (partIndex < parts.length - 1) heroTitle.appendChild(document.createElement('br'));
    });

    setTimeout(() => {
        heroTitle.querySelectorAll('.hero-title-char').forEach(span => {
            span.style.opacity = '1';
            span.style.transform = 'translateY(0) scale(1)';
        });
        if(heroSubtitle && heroSubtitle.classList.contains('hero-title-char')) {
             heroSubtitle.style.opacity = '1';
             heroSubtitle.style.transform = 'translateY(0) scale(1)';
        }
        heroButtons.forEach(button => {
            if (button.classList.contains('hero-title-char')) {
                button.style.opacity = '1';
                button.style.transform = 'translateY(0) scale(1)';
            }
        });
    }, 100);
}

function initCounterAnimation() {
    const counters = document.querySelectorAll('.counter');
    if (counters.length === 0) return;

    const speed = 200; 
    const animateCounter = (counter) => {
        const target = +counter.getAttribute('data-target');
        let count = 0;
        const increment = target / speed;
        const updateCount = () => {
            count += increment;
            if (count < target) {
                counter.innerText = Math.ceil(count);
                requestAnimationFrame(updateCount);
            } else {
                counter.innerText = target;
            }
        };
        updateCount();
        counter.classList.add('animated');
    };

    const counterObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(counter => counterObserver.observe(counter));
}

// --- 活動報告詳細ページ (activity-detail-placeholder.html) ---
function initActivityDetailPage() {
    const articleContainer = document.getElementById('activity-article-container');
    if (!articleContainer) return;

    const pageTitleElement = document.getElementById('page-title'); 
    const articleNotFoundDiv = document.getElementById('article-not-found');

    function findActivityById(id) {
        return sampleActivities.find(activity => activity.id === parseInt(id));
    }

    function populateActivityDetails(activity) {
        if (!activity) {
            if (articleContainer) articleContainer.innerHTML = ''; 
            if (articleContainer) articleContainer.classList.add('hidden');
            if (articleNotFoundDiv) articleNotFoundDiv.classList.remove('hidden');
            if (pageTitleElement) pageTitleElement.textContent = "記事が見つかりません - ボーイスカウト多治見第一団";
            const breadcrumbTitleElem = document.getElementById('activity-title-breadcrumb');
            if (breadcrumbTitleElem) breadcrumbTitleElem.textContent = "記事が見つかりません";
            return;
        }

        if (articleNotFoundDiv) articleNotFoundDiv.classList.add('hidden');
        if (articleContainer) articleContainer.classList.remove('hidden');

        if (pageTitleElement) pageTitleElement.textContent = `${activity.title} - 活動報告`;
        
        let htmlContent = `
            <header class="mb-8 border-b pb-6">
                <h1 class="text-3xl md:text-4xl lg:text-5xl font-bold text-green-700 mb-4">${activity.title}</h1>
                <div class="flex flex-wrap items-center text-sm text-gray-500 space-x-4">
                    <span><svg class="inline w-4 h-4 mr-1 -mt-px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>${formatDate(activity.date)}</span>
                    <span class="${activity.categoryColor || 'bg-gray-500'} text-white text-xs font-semibold px-2.5 py-1 rounded-full">${activity.category}</span>
                    <span title="作成者"><svg class="inline w-4 h-4 mr-1 -mt-px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>${activity.author || '団本部'}</span>
                    <span title="閲覧数"><svg class="inline w-4 h-4 mr-1 -mt-px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>${activity.views || 0} 回</span>
                </div>
            </header>
            <figure class="mb-8">
                <img src="${activity.mainImage}" alt="${activity.title}" class="w-full h-auto max-h-[600px] object-cover rounded-lg shadow-lg">
                <figcaption class="text-sm text-gray-500 mt-2 text-center">${activity.mainImageCaption || ''}</figcaption>
            </figure>
            <div class="prose-custom prose-lg max-w-none text-gray-700 leading-relaxed">${activity.bodyContent}</div>`;

        if (activity.gallery && activity.gallery.length > 0) {
            htmlContent += `<section class="mt-12 pt-8 border-t"><h3 class="text-2xl font-semibold text-green-700 mb-6">活動の思い出ギャラリー</h3><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">`;
            activity.gallery.forEach(img => {
                htmlContent += `<a href="${img.full}" data-lightbox="activity-gallery" data-title="${img.title}" data-caption="${img.title || ''}"><img src="${img.thumb}" alt="${img.title}" class="rounded-lg shadow-md w-full h-auto object-cover gallery-image-hover"></a>`;
            });
            htmlContent += `</div></section>`;
        }

        const currentIndex = sampleActivities.findIndex(a => a.id === activity.id);
        const prevActivity = currentIndex > 0 ? sampleActivities[currentIndex - 1] : null;
        const nextActivity = currentIndex < sampleActivities.length - 1 ? sampleActivities[currentIndex + 1] : null;

        htmlContent += `<nav class="mt-12 pt-8 border-t flex justify-between items-center flex-wrap gap-4"><div>`;
        if (prevActivity) {
            htmlContent += `<a href="activity-detail-placeholder.html?id=${prevActivity.id}" class="inline-flex items-center text-green-600 hover:text-green-800 transition-colors duration-300 text-sm sm:text-base">
                                <svg class="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                前の記事: <span class="truncate ml-1">${prevActivity.title.substring(0,12)}...</span>
                            </a>`;
        }
        htmlContent += `</div><div>`;
        if (nextActivity) {
             htmlContent += `<a href="activity-detail-placeholder.html?id=${nextActivity.id}" class="inline-flex items-center text-green-600 hover:text-green-800 transition-colors duration-300 text-sm sm:text-base">
                                次の記事: <span class="truncate ml-1">${nextActivity.title.substring(0,12)}...</span>
                                <svg class="w-5 h-5 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </a>`;
        }
        htmlContent += `</div></nav>`;
        htmlContent += `
            <footer class="mt-12 pt-8 border-t">
                <div class="flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-700 mb-2">この記事を共有する</h4>
                        <div class="flex space-x-3">
                            <a href="#" id="share-facebook" aria-label="Facebookで共有" class="text-blue-600 hover:text-blue-800 transition-colors duration-300"><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"></path></svg></a>
                            <a href="#" id="share-twitter" aria-label="Xで共有" class="text-gray-700 hover:text-black transition-colors duration-300"><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg></a>
                            <a href="#" id="share-line" aria-label="LINEで共有" class="text-green-500 hover:text-green-700 transition-colors duration-300"><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21.79,8.36a1.9,1.9,0,0,0-1.44-.74,2,2,0,0,0-1.13.41l-2.6,2.1A6.23,6.23,0,0,0,13,6.49a8.08,8.08,0,0,0-1.47-.1A7.82,7.82,0,0,0,3.6,13.9a7.58,7.58,0,0,0,1.4,4.33A7.76,7.76,0,0,0,9,20.68a7.82,7.82,0,0,0,7.92-7.56,8.13,8.13,0,0,0-.09-1.24,6.22,6.22,0,0,0,3.54-3.79A1.89,1.89,0,0,0,21.79,8.36ZM9.31,16.38a.79.79,0,0,1-.8.79.78.78,0,0,1-.79-.79V12.59a.79.79,0,0,1,.79-.79.78.78,0,0,1,.8.79Zm3.38,0a.79.79,0,0,1-.8.79.78.78,0,0,1-.79-.79V12.59a.79.79,0,0,1,.79-.79.78.78,0,0,1,.8.79Zm3.38,0a.79.79,0,0,1-.8.79.78.78,0,0,1-.79-.79V12.59a.79.79,0,0,1,.79-.79.78.78,0,0,1,.8.79Z"/></svg></a>
                        </div>
                    </div>
                    <a href="activity-log.html" class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors duration-300">
                        <svg class="w-5 h-5 mr-2 -ml-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        活動報告一覧へ戻る
                    </a>
                </div>
            </footer>`;
        if (articleContainer) articleContainer.innerHTML = htmlContent;

        const breadcrumbTitleElem = document.getElementById('activity-title-breadcrumb');
        if (breadcrumbTitleElem) breadcrumbTitleElem.textContent = activity.title.substring(0,20) + (activity.title.length > 20 ? "..." : "");

        const shareUrl = window.location.href; 
        const shareTitle = activity.title;
        const fbShare = document.getElementById('share-facebook');
        if (fbShare) fbShare.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        const twShare = document.getElementById('share-twitter');
        if (twShare) twShare.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
        const lineShare = document.getElementById('share-line');
        if (lineShare) lineShare.href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
        
        if (typeof initSimpleLightboxPlaceholder === 'function') {
            initSimpleLightboxPlaceholder();
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const activityId = urlParams.get('id');
    
    if (activityId) {
        const activity = findActivityById(activityId);
        populateActivityDetails(activity);
    } else {
        // IDがない場合は、エラー表示または最初の記事などを表示
        populateActivityDetails(null); // エラー表示のデモ
    }
}

// --- お知らせ詳細ページ (news-detail-placeholder.html) ---
function initNewsDetailPage() {
    const articleContainer = document.getElementById('news-article-container');
    if (!articleContainer) return;

    const pageTitleElement = document.getElementById('page-title-news');
    const articleNotFoundDiv = document.getElementById('news-article-not-found');
    
    function findNewsById(id) {
        return sampleNewsDataArray.find(news => news.id === parseInt(id));
    }

    function populateNewsDetails(news) {
        if (!news) {
            if(articleContainer) articleContainer.innerHTML = '';
            if(articleContainer) articleContainer.classList.add('hidden');
            if(articleNotFoundDiv) articleNotFoundDiv.classList.remove('hidden');
            if(pageTitleElement) pageTitleElement.textContent = "お知らせが見つかりません - ボーイスカウト多治見第一団";
            const breadcrumbTitleElem = document.getElementById('news-title-breadcrumb');
            if (breadcrumbTitleElem) breadcrumbTitleElem.textContent = "お知らせが見つかりません";
            return;
        }
        if(articleNotFoundDiv) articleNotFoundDiv.classList.add('hidden');
        if(articleContainer) articleContainer.classList.remove('hidden');

        if(pageTitleElement) pageTitleElement.textContent = `${news.title} - お知らせ`;
        
        let htmlContent = `
            <header class="mb-8 border-b pb-6">
                <h1 class="text-3xl md:text-4xl lg:text-5xl font-bold text-green-700 mb-4">${news.title}</h1>
                <div class="flex flex-wrap items-center text-sm text-gray-500 space-x-4">
                    <span><svg class="inline w-4 h-4 mr-1 -mt-px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>${formatDate(news.date)}</span>
                    <span class="${news.categoryColor || 'bg-gray-500'} text-white text-xs font-semibold px-2.5 py-1 rounded-full">${news.category}</span>
                </div>
            </header>
            <div class="prose-custom prose-lg max-w-none text-gray-700 leading-relaxed">${news.bodyContent}</div>
            <footer class="mt-12 pt-8 border-t">
                <div class="flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-700 mb-2">この記事を共有する</h4>
                        <div class="flex space-x-3">
                            <a href="#" id="share-facebook-news" aria-label="Facebookで共有" class="text-blue-600 hover:text-blue-800 transition-colors duration-300"><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"></path></svg></a>
                            <a href="#" id="share-twitter-news" aria-label="Xで共有" class="text-gray-700 hover:text-black transition-colors duration-300"><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg></a>
                            <a href="#" id="share-line-news" aria-label="LINEで共有" class="text-green-500 hover:text-green-700 transition-colors duration-300"><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21.79,8.36a1.9,1.9,0,0,0-1.44-.74,2,2,0,0,0-1.13.41l-2.6,2.1A6.23,6.23,0,0,0,13,6.49a8.08,8.08,0,0,0-1.47-.1A7.82,7.82,0,0,0,3.6,13.9a7.58,7.58,0,0,0,1.4,4.33A7.76,7.76,0,0,0,9,20.68a7.82,7.82,0,0,0,7.92-7.56,8.13,8.13,0,0,0-.09-1.24,6.22,6.22,0,0,0,3.54-3.79A1.89,1.89,0,0,0,21.79,8.36ZM9.31,16.38a.79.79,0,0,1-.8.79.78.78,0,0,1-.79-.79V12.59a.79.79,0,0,1,.79-.79.78.78,0,0,1,.8.79Zm3.38,0a.79.79,0,0,1-.8.79.78.78,0,0,1-.79-.79V12.59a.79.79,0,0,1,.79-.79.78.78,0,0,1,.8.79Zm3.38,0a.79.79,0,0,1-.8.79.78.78,0,0,1-.79-.79V12.59a.79.79,0,0,1,.79-.79.78.78,0,0,1,.8.79Z"/></svg></a>
                        </div>
                    </div>
                    <a href="news-list.html" class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors duration-300">
                        <svg class="w-5 h-5 mr-2 -ml-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        お知らせ一覧へ戻る
                    </a>
                </div>
            </footer>`;
        if(articleContainer) articleContainer.innerHTML = htmlContent;

        const breadcrumbTitleElem = document.getElementById('news-title-breadcrumb');
        if (breadcrumbTitleElem) breadcrumbTitleElem.textContent = news.title.substring(0,20) + (news.title.length > 20 ? "..." : "");

        const shareUrl = window.location.href; 
        const shareTitle = news.title;
        const fbShare = document.getElementById('share-facebook-news');
        if (fbShare) fbShare.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        const twShare = document.getElementById('share-twitter-news');
        if (twShare) twShare.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
        const lineShare = document.getElementById('share-line-news');
        if (lineShare) lineShare.href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const newsId = urlParams.get('id');
    
    if (newsId) {
        const newsItem = findNewsById(newsId);
        populateNewsDetails(newsItem);
    } else {
        // IDがない場合は、エラー表示または最初の記事などを表示
        populateNewsDetails(null); // エラー表示のデモ
    }
}

 