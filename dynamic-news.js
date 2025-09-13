/**
 * dynamic-news.js (patched)
 * - escapeHTML 実装
 * - フィルタセクションのセレクタをIDに（副作用防止）
 * - エラーハンドリング改善
 */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('news-list-container')) {
    loadDynamicNewsList();
  }
  if (document.getElementById('news-article-container')) {
    loadDynamicNewsDetail();
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

// --- お知らせ一覧ページ ---
async function loadDynamicNewsList() {
  const newsListContainer = document.getElementById('news-list-container');
  if (!newsListContainer) return;

  // フィルタUI: グローバルな .bg-gray-50 を隠すのは副作用が大きいので、IDを利用
  const filterSection = document.querySelector('#news-filter-section');
  if (filterSection) filterSection.style.display = 'none';

  const newsPaginationContainer = document.getElementById('news-pagination-container');
  const noNewsResultsDiv = document.getElementById('no-news-results');

  const NEWS_ITEMS_PER_PAGE = 5;
  let currentPage = 1;
  let allNews = [];

  function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ja-JP', options);
  }

  function renderNewsItem(news) {
    const summary = (news.content || '').substring(0, 100).replace(/<[^>]+>/g, '') + '...';
    const detailUrl = `news-detail-placeholder.html?id=${news.id}`;
    return `
      <article class="news-item bg-white p-6 rounded-xl shadow-lg border-l-4 border-gray-300 flex flex-col sm:flex-row gap-6 card-hover-effect">
        <div class="sm:w-2/3">
          <a href="${detailUrl}" class="news-item-link group block">
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs text-gray-500">${formatDate(news.created_at)}</p>
            </div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2 group-hover:text-green-700 transition-colors duration-300">${escapeHTML(news.title || '')}</h3>
            <p class="text-gray-600 leading-relaxed text-sm line-clamp-2">${escapeHTML(summary)}</p>
          </a>
        </div>
        <div class="sm:w-1/3 flex sm:flex-col items-end sm:items-start justify-between mt-4 sm:mt-0">
          <a href="${detailUrl}" class="text-sm text-green-600 hover:text-green-800 font-medium transition-colors duration-300 self-end sm:self-start sm:mt-auto">詳しく見る &rarr;</a>
        </div>
      </article>`;
  }

  function renderNewsPagination(totalItems, currentPage) {
    if (!newsPaginationContainer) return;
    const totalPages = Math.ceil(totalItems / NEWS_ITEMS_PER_PAGE);
    if (totalPages <= 1) {
      newsPaginationContainer.innerHTML = '';
      return;
    }
    let html = '<ul class="inline-flex items-center -space-x-px shadow-sm rounded-md">';
    html += `<li><button data-page="${currentPage - 1}" aria-label="前のページへ" class="news-pagination-button pagination-button ${currentPage === 1 ? 'pagination-disabled' : ''}"><span class="sr-only">前へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<li><button data-page="${i}" aria-label="${i}ページ目へ" class="news-pagination-button pagination-button ${i === currentPage ? 'pagination-active' : ''}">${i}</button></li>`;
    }
    html += `<li><button data-page="${currentPage + 1}" aria-label="次のページへ" class="news-pagination-button pagination-button ${currentPage === totalPages ? 'pagination-disabled' : ''}"><span class="sr-only">次へ</span><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button></li>`;
    html += '</ul>';
    newsPaginationContainer.innerHTML = html;
    newsPaginationContainer.querySelectorAll('.news-pagination-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.currentTarget.dataset.page);
        if (page && page !== currentPage && page > 0 && page <= totalPages) {
          currentPage = page;
          displayNewsItems(allNews);
          if (newsListContainer) newsListContainer.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  function displayNewsItems(arr) {
    newsListContainer.innerHTML = '';
    if (!arr || arr.length === 0) {
      if (noNewsResultsDiv) noNewsResultsDiv.classList.remove('hidden');
      if (newsPaginationContainer) newsPaginationContainer.innerHTML = '';
      return;
    }
    if (noNewsResultsDiv) noNewsResultsDiv.classList.add('hidden');
    const startIndex = (currentPage - 1) * NEWS_ITEMS_PER_PAGE;
    const endIndex = startIndex + NEWS_ITEMS_PER_PAGE;
    const items = arr.slice(startIndex, endIndex);
    items.forEach(n => newsListContainer.innerHTML += renderNewsItem(n));
    renderNewsPagination(arr.length, currentPage);
  }

  try {
    newsListContainer.innerHTML = '<p class="text-center">読み込み中...</p>';
    const response = await fetch('/api/news');
    if (!response.ok) throw new Error('Network response was not ok');
    allNews = await response.json();
    displayNewsItems(allNews);
  } catch (err) {
    console.error('Failed to fetch news:', err);
    newsListContainer.innerHTML = '<p class="text-center text-red-500">お知らせの読み込みに失敗しました。</p>';
  }
}

// --- お知らせ詳細ページ ---
async function loadDynamicNewsDetail() {
  const articleContainer = document.getElementById('news-article-container');
  if (!articleContainer) return;
  const urlParams = new URLSearchParams(window.location.search);
  const newsId = urlParams.get('id');
  if (!newsId) return;

  const pageTitleElement = document.getElementById('page-title-news');
  const articleNotFoundDiv = document.getElementById('news-article-not-found');

  function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ja-JP', options);
  }

  try {
    articleContainer.innerHTML = '<p class="text-center">読み込み中...</p>';
    const response = await fetch(`/api/news/${encodeURIComponent(newsId)}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const news = await response.json();
    if (!news || !news.id) throw new Error('Not found');
    if (pageTitleElement) pageTitleElement.textContent = news.title || '';
    articleContainer.innerHTML = `
      <article class="bg-white p-6 rounded-xl shadow-lg">
        <div class="mb-2 text-sm text-gray-500">${formatDate(news.created_at)}</div>
        <h1 class="text-2xl font-bold mb-4">${escapeHTML(news.title || '')}</h1>
        <div class="prose max-w-none">${news.content || ''}</div>
      </article>`;
  } catch (err) {
    console.error('Failed to fetch news detail:', err);
    if (articleNotFoundDiv) articleNotFoundDiv.classList.remove('hidden');
    articleContainer.innerHTML = '';
  }
}
