// dynamic-activities.js (UTF-8)

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('activity-log-container')) {
    loadDynamicActivityList();
  }
  if (document.getElementById('activity-article-container')) {
    loadDynamicActivityDetail();
  }
});

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadDynamicActivityList() {
  const container = document.getElementById('activity-log-container');
  if (!container) return;

  try {
    container.innerHTML = '<p class="text-center">読み込み中...</p>';
    const response = await fetch('/api/activities');
    if (!response.ok) throw new Error('Network response was not ok');
    const activities = await response.json();

    if (!Array.isArray(activities) || activities.length === 0) {
      document.getElementById('no-activity-results')?.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }

    let html = '';
    activities.forEach(item => {
      const summary = (item.content || '').replace(/<[^>]+>/g, '').substring(0, 120) + ((item.content || '').length > 120 ? '…' : '');
      const detailUrl = `activity-detail-placeholder.html?id=${item.id}`;
      const d = item.activity_date ? new Date(item.activity_date) : (item.created_at ? new Date(item.created_at) : null);
      const activityDate = d && !isNaN(d) ? d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      const cat = item.category || '未分類';

      html += `
      <div class="bg-white rounded-xl shadow-xl overflow-hidden card-hover-effect group">
        <div class="relative">
          <img src="https://placehold.co/600x400/4A934A/FFFFFF?text=${escapeHTML(cat)}" alt="${escapeHTML(item.title || '')}" class="w-full h-60 object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
        </div>
        <div class="p-6">
          ${activityDate ? `<p class=\"text-sm text-gray-500 mb-2\">${activityDate}</p>` : ''}
          <h3 class="text-2xl font-semibold mb-3">
            <a href="${detailUrl}" class="hover:text-green-700 transition-colors">${escapeHTML(item.title || '')}</a>
          </h3>
          <p class="text-gray-700 mb-4 leading-relaxed line-clamp-3">${escapeHTML(summary)}</p>
          <a href="${detailUrl}" class="inline-block text-green-600 hover:text-green-800 font-semibold transition-colors duration-300 group">
            活動報告を見る <span class="transition-transform duration-300 inline-block group-hover:translate-x-1">&rarr;</span>
          </a>
        </div>
      </div>`;
    });
    container.innerHTML = html;

  } catch (err) {
    console.error('Failed to fetch activities:', err);
    container.innerHTML = '<p class="text-center text-red-500">活動の読み込みに失敗しました。</p>';
  }
}

async function loadDynamicActivityDetail() {
  // ここでは詳細ページの実装は行っていません（dynamic-news.js を参考に実装可能）
}

