document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const successMsg = document.getElementById('form-success-message');
    const errorMsg = document.getElementById('form-error-message');
    const errorDetail = errorMsg ? errorMsg.querySelector('[data-error-detail]') : null;
    const nameError = document.getElementById('name-error');
    const emailError = document.getElementById('email-error');
    const messageError = document.getElementById('message-error');

    if (!form) return;

    // ボット対策: フォーム読み込み時刻を設定
    const formLoadedAtField = document.getElementById('_formLoadedAt');
    if (formLoadedAtField) {
        formLoadedAtField.value = Date.now().toString();
    }

    const resetErrors = () => {
        if (nameError) nameError.classList.add('hidden');
        if (emailError) emailError.classList.add('hidden');
        if (messageError) messageError.classList.add('hidden');
        if (errorMsg) errorMsg.classList.add('hidden');
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        resetErrors();

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        let hasError = false;

        // 簡易クライアントサイドバリデーション
        if (!data.name || !data.name.trim()) {
            if (nameError) nameError.classList.remove('hidden');
            hasError = true;
        }
        if (!data.email || !data.email.trim() || !data.email.includes('@')) {
            if (emailError) emailError.classList.remove('hidden');
            hasError = true;
        }
        if (!data.message || !data.message.trim()) {
            if (messageError) messageError.classList.remove('hidden');
            hasError = true;
        }

        if (hasError) return;

        // UI更新（送信中）
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = '送信中...';

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                // 成功時
                form.reset();
                form.style.display = 'none'; // フォーム全体を隠す
                successMsg.classList.remove('hidden');
                // 画面トップへ少しスクロール
                successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // バリデーションエラー等の表示
                if (result.details) {
                    // サーバーからの詳細エラー
                    if (result.details.name && nameError) nameError.classList.remove('hidden');
                    if (result.details.email && emailError) emailError.classList.remove('hidden');
                    if (result.details.message && messageError) messageError.classList.remove('hidden');
                }
                throw new Error(result.message || '送信中にエラーが発生しました');
            }
        } catch (error) {
            console.error('Contact form error:', error);
            if (errorDetail) errorDetail.textContent = error.message;
            errorMsg.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
});
