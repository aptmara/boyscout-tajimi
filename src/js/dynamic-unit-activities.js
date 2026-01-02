/**
 * dynamic-unit-activities.js
 * 各隊ページで、その隊に関連する最新の活動記録を取得して表示する
 */

document.addEventListener('DOMContentLoaded', () => {
    // どの隊のページか判定
    const container = document.getElementById('unit-activities');
    if (!container) return;

    const unitType = container.getAttribute('data-unit'); // 'beaver', 'cub', 'boy', 'venture', 'rover'
    if (!unitType) return;

    loadUnitActivities(unitType);
});

async function loadUnitActivities(unitType) {
    const container = document.getElementById('unit-activities');
    const cardContainer = document.getElementById('unit-activity-cards');
    if (!cardContainer || !container) return;

    try {
        // APIからデータ取得 (limit=4)
        // unitパラメータでフィルタリングできるAPIエンドポイントを想定
        // なければ全件取得してからフロントでフィルタリング（件数が少なければこれでも可）
        // ここでは /api/activities?unit=XXX をコールする想定
        // 実際のAPI仕様に合わせて調整： 現状の activity.routes.js を見るとフィルタリング実装が必要かもしれない
        // 一旦全件取得してJSでフィルタリングする安全策をとる（API改修コスト削減）

        const response = await fetch('/api/activities?limit=20'); // 少し多めに取ってフィルタ
        if (!response.ok) throw new Error('Network response was not ok');

        const activities = await response.json();

        // 隊名マッピング
        const unitNameMap = {
            'beaver': 'ビーバー',
            'cub': 'カブ',
            'boy': 'ボーイ',
            'venture': 'ベンチャー',
            'rover': 'ローバー'
        };
        const targetUnitName = unitNameMap[unitType];

        // フィルタリング: category または title に隊名が含まれるか、
        // あるいは category が 'all' (全体) のもの
        const filtered = activities.filter(act => {
            const cat = (act.category || '').toLowerCase();
            const title = (act.title || '').toLowerCase();
            // 単純検索
            return cat.includes(unitType) ||
                title.includes(targetUnitName) ||
                title.includes(unitType) ||
                cat === '全体' || cat === 'all';
        }).slice(0, 4); // 最新4件

        if (filtered.length === 0) {
            container.style.display = 'none'; // 記事がない場合はセクションごと隠す
            return;
        }

        // レンダリング
        cardContainer.innerHTML = filtered.map(activity => createActivityCard(activity)).join('');

    } catch (error) {
        console.error('Failed to load unit activities:', error);
        // エラー時はセクションを隠す
        if (container) container.style.display = 'none';
    }
}

/**
 * CommonのhighlightCardと似たHTML構造を生成
 */
function createActivityCard(activity) {
    // 日付フォーマット
    const date = new Date(activity.activity_date || activity.created_at);
    const dateStr = date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });

    // 画像（なければプレースホルダー）
    let imageUrl = 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image';
    if (activity.image_urls && activity.image_urls.length > 0) {
        imageUrl = activity.image_urls[0];
    }

    return `
    <article class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-full border border-gray-100 group">
        <a href="/activity/${activity.id}" class="block relative overflow-hidden aspect-video">
            <img src="${imageUrl}" 
                 alt="${activity.title}" 
                 class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                 loading="lazy">
            <div class="absolute top-0 right-0 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                ${activity.category || '活動'}
            </div>
        </a>
        <div class="p-6 flex flex-col flex-grow">
            <div class="flex items-center text-sm text-gray-500 mb-3">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                ${dateStr}
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-3 line-clamp-2 group-hover:text-green-600 transition-colors">
                <a href="/activity/${activity.id}">
                    ${activity.title}
                </a>
            </h3>
            <p class="text-gray-600 text-sm line-clamp-3 mb-4 flex-grow">
                ${stripHtml(activity.content)}
            </p>
            <a href="/activity/${activity.id}" class="inline-flex items-center text-green-600 font-semibold hover:text-green-800 mt-auto">
                詳しく見る 
                <svg class="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </a>
        </div>
    </article>
    `;
}

function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}
