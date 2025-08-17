document.addEventListener('DOMContentLoaded', () => {
    // 現在のページに応じて適切な関数を呼び出す
    if (document.getElementById('news-list-container')) {
        loadDynamicNewsList();
    }
    if (document.getElementById('news-article-container')) {
        loadDynamicNewsDetail();
    }
});

// --- お知らせ一覧ページ (news-list.html) のための関数 ---
async function loadDynamicNewsList() {
    const newsListContainer = document.getElementById('news-list-container');
    if (!newsListContainer) return;

    // フィルタリングUIを非表示にする
    const filterSection = document.querySelector('.bg-gray-50');
    if (filterSection) {
        filterSection.style.display = 'none';
    }

    const newsPaginationContainer = document.getElementById('news-pagination-container');
    const noNewsResultsDiv = document.getElementById('no-news-results');

    const NEWS_ITEMS_PER_PAGE = 5;
    let currentPage = 1;
    let allNews = [];

    // 日付フォーマット関数
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('ja-JP', options);
    }

    function renderNewsItem(news) {
        const summary = news.content.substring(0, 100).replace(/<[^>]+>/g, '') + '...';
        const detailUrl = `news-detail-placeholder.html?id=${news.id}`;

        return `
            <article class="news-item bg-white p-6 rounded-xl shadow-lg border-l-4 border-gray-300 flex flex-col sm:flex-row gap-6 card-hover-effect">
                <div class="sm:w-2/3">
                    <a href="${detailUrl}" class="news-item-link group block">
                        <div class="flex items-center justify-between mb-2">
                            <p class="text-xs text-gray-500">${formatDate(news.created_at)}</p>
                        </div>
                        <h3 class="text-xl font-semibold text-gray-800 mb-2 group-hover:text-green-700 transition-colors duration-300">${escapeHTML(news.title)}</h3>
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
                if (page && page !== currentPage && page > 0 && page <= totalPages) {
                    currentPage = page;
                    displayNewsItems(allNews);
                    if (newsListContainer) newsListContainer.scrollIntoView({ behavior: 'smooth' });
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

        const startIndex = (currentPage - 1) * NEWS_ITEMS_PER_PAGE;
        const endIndex = startIndex + NEWS_ITEMS_PER_PAGE;
        const paginatedNews = newsToDisplay.slice(startIndex, endIndex);
        paginatedNews.forEach(news => newsListContainer.innerHTML += renderNewsItem(news));
        renderNewsPagination(newsToDisplay.length, currentPage);
    }

    try {
        newsListContainer.innerHTML = '<p class="text-center">読み込み中...</p>';
        const response = await fetch('/api/news');
        if (!response.ok) throw new Error('Network response was not ok');
        allNews = await response.json();
        displayNewsItems(allNews);
    } catch (error) {
        console.error("Failed to fetch news:", error);
        newsListContainer.innerHTML = '<p class="text-center text-red-500">お知らせの読み込みに失敗しました。</p>';
    }
}


// --- お知らせ詳細ページ (news-detail-placeholder.html) のための関数 ---
async function loadDynamicNewsDetail() {
    const articleContainer = document.getElementById('news-article-container');
    if (!articleContainer) return;

    const urlParams = new URLSearchParams(window.location.search);
    const newsId = urlParams.get('id');
    if (!newsId) return;

    const pageTitleElement = document.getElementById('page-title-news');
    const articleNotFoundDiv = document.getElementById('news-article-not-found');

    // 日付フォーマット関数
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('ja-JP', options);
    }

    try {
        const response = await fetch(`/api/news/${newsId}`);
        if (!response.ok) {
            throw new Error('News not found');
        }
        const news = await response.json();

        if (pageTitleElement) pageTitleElement.textContent = `${escapeHTML(news.title)} - お知らせ`;
        if (articleNotFoundDiv) articleNotFoundDiv.classList.add('hidden');
        articleContainer.classList.remove('hidden');

        const breadcrumbTitleElem = document.getElementById('news-title-breadcrumb');
        if (breadcrumbTitleElem) breadcrumbTitleElem.textContent = escapeHTML(news.title.substring(0,20)) + (news.title.length > 20 ? "..." : "");

        let metaInfoHTML = `<div class="article-meta-info mb-4"><span><svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>${formatDate(news.created_at)}</span></div>`;

        let htmlContent = `
            <header class="mb-8 border-b pb-6">
                <h1 class="text-3xl md:text-4xl lg:text-5xl font-bold text-green-700 mb-3">${escapeHTML(news.title)}</h1>
                ${metaInfoHTML}
            </header>
            <div class="prose-custom prose-lg max-w-none text-gray-700 leading-relaxed">${news.content}</div>
             <div class="mt-12 pt-8 border-t">
                <a href="news-list.html" class="text-green-600 hover:text-green-800 font-semibold transition-colors duration-300">
                    &larr; お知らせ一覧に戻る
                </a>
            </div>
        `;
        articleContainer.innerHTML = htmlContent;

    } catch (error) {
        console.error('Failed to fetch news detail:', error);
        if (articleNotFoundDiv) articleNotFoundDiv.classList.remove('hidden');
        articleContainer.classList.add('hidden');
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
}
