/**
 * ============================================================================
 * GAS Webhook 統合コード v3.0
 * ============================================================================
 * 
 * 【サーバー側コード全数分析結果に基づく完全準拠版】
 * 
 * ■ 分析対象ファイル
 * - auth.middleware.js: HMAC-SHA256署名検証
 * - news.controller.js: newsWebhook (line 110-130)
 * - activity.controller.js: activityWebhook (line 147-168)
 * - imageDownloader.js: processImages (Base64/URL両対応)
 * - formatters.js: normalizeSlug, normalizeTags
 * - simple-sanitizer.js: sanitizePayload
 * - server.js: エンドポイント定義 (line 152, 164)
 * 
 * ■ サーバー側仕様
 * 
 * 【エンドポイント】
 * - News:     POST /api/news/webhook
 * - Activity: POST /api/activities/webhook
 * 
 * 【認証】auth.middleware.js
 * - ヘッダー: X-Timestamp (Unix秒), X-Signature (sha256=<hex>)
 * - 署名計算: HMAC-SHA256(secret, `${timestamp}.${bodyRaw}`)
 * - 許容誤差: 300秒 (HMAC_TOLERANCE_SEC)
 * - 署名形式: "sha256=" + 64文字hex または 64文字hexのみ
 * 
 * 【ペイロードサイズ】server.js:151
 * - 上限: 5MB (Base64画像対応)
 * 
 * 【画像処理】imageDownloader.js
 * - 形式1: URL文字列 → downloadImage() でDLしWebP変換
 * - 形式2: {data, contentType, filename} → saveBase64Image() でWebP変換
 * - 出力: /uploads/webhook/xxx.webp (1280px, quality 80)
 * 
 * 【フィールド処理】
 * - title: 必須、String()でキャスト
 * - content: 必須、String()でキャスト
 * - images: 配列、processImages()で処理
 * - category: 未指定時 '未分類'
 * - unit: normalizeSlug() → trim().toLowerCase()
 * - tags: normalizeTags() → 配列でも文字列でもOK、小文字化
 * - activity_date: (Activity専用) new Date()でパース、nullならCURRENT_TIMESTAMP
 * 
 * 【サニタイズ】simple-sanitizer.js
 * - script/style/iframe等の危険タグ除去
 * - on*イベントハンドラ除去
 * - javascript:URI除去
 * - 対象: title, content, category, unit
 * 
 * 【複数選択対応】
 * - 隊（チェックボックス）: 複数選択→カンマ区切り文字列で送信
 * 
 * ============================================================================
 */

// ============================================================================
// 設定（サーバー側との完全一致を保証）
// ============================================================================

const CONFIG = {
    // サーバーURL（末尾スラッシュなし）
    BASE_URL: 'https://www.tajimibs.org',

    // エンドポイント（server.js:152, 164 と一致）
    ENDPOINTS: {
        NEWS: '/api/news/webhook',
        ACTIVITY: '/api/activities/webhook'
    },

    // 画像制限（サーバー側 10MB 制限を考慮）
    // Base64エンコードで約1.3倍になるため、元画像は8MB程度を上限とする
    MAX_IMAGE_SIZE_MB: 8,
    MAX_IMAGES_COUNT: 5
};

// フォーム項目名（Googleフォームの質問タイトルと完全一致必須）
const FIELDS = {
    // ブログ形式共通
    TITLE: 'タイトル',
    BODY: '本文',
    PHOTOS: '写真アップロード',
    CATEGORY: 'カテゴリ',
    UNIT: '隊',
    TAGS: 'タグ',

    // Activity専用
    ACTIVITY_DATE: '活動日',

    // Docs連携
    DOC_TITLE: '記事タイトル',
    DOC_LINK: 'Googleドキュメントの共有リンク'
};

// ============================================================================
// トリガーエントリポイント
// ============================================================================

/**
 * ニュース投稿フォーム用
 * トリガー設定: フォーム送信時 → onFormSubmitNews
 */
function onFormSubmitNews(e) {
    handleFormSubmit(e, 'NEWS');
}

/**
 * 活動報告フォーム用
 * トリガー設定: フォーム送信時 → onFormSubmitActivity
 */
function onFormSubmitActivity(e) {
    handleFormSubmit(e, 'ACTIVITY');
}

/**
 * 汎用（activity_dateの有無で自動判別）
 */
function onFormSubmit(e) {
    handleFormSubmit(e, 'AUTO');
}

// ============================================================================
// メイン処理
// ============================================================================

/**
 * フォーム送信を処理
 * @param {GoogleAppsScript.Events.FormsOnFormSubmit} e
 * @param {'NEWS'|'ACTIVITY'|'AUTO'} type
 */
function handleFormSubmit(e, type) {
    const log = (level, msg) => Logger.log(`[${level}] ${msg}`);

    try {
        if (!e) {
            log('ERROR', 'イベントオブジェクトが空');
            return;
        }

        const timestamp = e.response?.getTimestamp?.() || new Date();

        // フォームデータを取得（namedValuesではなくgetItemResponses()を使用）
        const formData = getFormData(e.response);
        log('INFO', `受信: type=${type}, fields=[${Object.keys(formData).join(',')}]`);

        // ペイロード構築
        const isDocForm = !!formData[FIELDS.DOC_LINK];
        let payload;

        if (isDocForm) {
            payload = buildDocPayloadFromData(e, formData);
        } else {
            payload = buildSimplePayloadFromData(e, formData);
        }

        // Activity専用: activity_date
        if (type === 'ACTIVITY' || type === 'AUTO') {
            const dateStr = formData[FIELDS.ACTIVITY_DATE];
            if (dateStr) {
                // サーバー側: new Date(activity_date) でパース
                payload.activity_date = new Date(dateStr).toISOString();
            }
        }

        // エンドポイント決定
        let endpoint;
        if (type === 'NEWS') {
            endpoint = CONFIG.ENDPOINTS.NEWS;
        } else if (type === 'ACTIVITY') {
            endpoint = CONFIG.ENDPOINTS.ACTIVITY;
        } else {
            // AUTO: activity_date有無で判定
            endpoint = payload.activity_date
                ? CONFIG.ENDPOINTS.ACTIVITY
                : CONFIG.ENDPOINTS.NEWS;
        }

        // 必須フィールド検証（サーバー側と同じ条件）
        if (!payload.title || !payload.content) {
            log('ERROR', `title または content が空: title="${payload.title}", contentLen=${(payload.content || '').length}`);
            return;
        }

        // 送信
        const url = CONFIG.BASE_URL + endpoint;
        log('INFO', `送信先: ${url}`);
        sendWebhook(url, payload, timestamp);

    } catch (err) {
        log('FATAL', err.stack || err.message || String(err));
    }
}

/**
 * FormResponseからフィールド値を取得
 * @param {GoogleAppsScript.Forms.FormResponse} response
 * @returns {Object} - {質問タイトル: 値} のオブジェクト
 */
function getFormData(response) {
    const data = {};
    if (!response?.getItemResponses) return data;

    try {
        for (const ir of response.getItemResponses()) {
            const item = ir.getItem();
            if (!item) continue;

            const title = item.getTitle();
            const itemType = item.getType();
            let value = ir.getResponse();

            // チェックボックスは配列で返る
            if (itemType === FormApp.ItemType.CHECKBOX) {
                data[title] = Array.isArray(value) ? value : [value];
            }
            // ファイルアップロードはファイルID配列
            else if (itemType === FormApp.ItemType.FILE_UPLOAD) {
                data[title] = Array.isArray(value) ? value : [value];
            }
            // その他は文字列
            else {
                data[title] = String(value || '').trim();
            }
        }
    } catch (err) {
        Logger.log(`[ERROR] getFormData: ${err}`);
    }

    return data;
}

// ============================================================================
// ペイロード構築
// ============================================================================

/**
 * ブログ形式ペイロード（FormDataから）
 */
function buildSimplePayloadFromData(e, formData) {
    const title = formData[FIELDS.TITLE] || formData[FIELDS.DOC_TITLE] || '';
    const body = formData[FIELDS.BODY] || '';
    const category = formData[FIELDS.CATEGORY] || null;
    const unitRaw = formData[FIELDS.UNIT] || [];  // チェックボックスは配列
    const tags = formData[FIELDS.TAGS] || '';

    // 本文をHTMLに変換
    const content = convertMarkdownToHtml(body);

    // 画像を抽出（Base64オブジェクト配列）
    const images = extractImagesFromData(formData[FIELDS.PHOTOS]);

    // 隊: 複数選択の場合は正規化してカンマ区切り文字列に
    const unit = normalizeUnits(Array.isArray(unitRaw) ? unitRaw : [unitRaw]);

    return {
        title: title,
        content: content,
        images: images,
        category: category,
        unit: unit,
        tags: tags ? tags.split(/[,、\s]+/).filter(Boolean) : []
    };
}

/**
 * Googleドキュメント連携ペイロード（FormDataから）
 */
function buildDocPayloadFromData(e, formData) {
    const title = formData[FIELDS.DOC_TITLE] || formData[FIELDS.TITLE] || '';
    const docUrl = formData[FIELDS.DOC_LINK] || '';
    const category = formData[FIELDS.CATEGORY] || null;
    const unitRaw = formData[FIELDS.UNIT] || [];
    const tags = formData[FIELDS.TAGS] || '';

    // ドキュメントID抽出
    const docId = extractDocId(docUrl);
    if (!docId) {
        throw new Error(`無効なドキュメントURL: ${docUrl}`);
    }

    // ドキュメントをHTML変換
    const content = convertDocToHtml(docId);

    // 隊: 複数選択の場合は正規化してカンマ区切り文字列に
    const unit = normalizeUnits(Array.isArray(unitRaw) ? unitRaw : [unitRaw]);

    return {
        title: title,
        content: content,
        images: [],
        category: category,
        unit: unit,
        tags: tags ? tags.split(/[,、\s]+/).filter(Boolean) : []
    };
}

/**
 * ファイルIDの配列から画像を抽出
 * @param {string[]} fileIds - DriveファイルIDの配列
 * @returns {Array<{data: string, contentType: string, filename: string}>}
 */
function extractImagesFromData(fileIds) {
    const images = [];
    if (!fileIds || !Array.isArray(fileIds)) return images;

    const maxSize = CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024;

    for (const fileId of fileIds) {
        if (images.length >= CONFIG.MAX_IMAGES_COUNT) {
            Logger.log(`[WARN] 画像上限到達: ${CONFIG.MAX_IMAGES_COUNT}`);
            break;
        }

        try {
            const file = DriveApp.getFileById(fileId);
            const blob = file.getBlob();
            const size = blob.getBytes().length;

            if (size > maxSize) {
                Logger.log(`[WARN] 画像サイズ超過: ${(size / 1024 / 1024).toFixed(1)}MB > ${CONFIG.MAX_IMAGE_SIZE_MB}MB`);
                continue;
            }

            images.push({
                data: Utilities.base64Encode(blob.getBytes()),
                contentType: blob.getContentType() || 'image/jpeg',
                filename: blob.getName() || `image_${Date.now()}.jpg`
            });

            Logger.log(`[INFO] 画像追加: ${file.getName()} (${(size / 1024).toFixed(0)}KB)`);

        } catch (err) {
            Logger.log(`[ERROR] 画像取得失敗: ${fileId} - ${err}`);
        }
    }

    return images;
}

// ============================================================================
// Markdown → HTML変換
// ============================================================================

/**
 * 簡易Markdown → HTML
 * 
 * 対応:
 * - **太字** → <strong>
 * - _斜体_ → <em>
 * - [text](url) → <a href="url">
 * - 空行 → 段落区切り
 * - 改行 → <br>
 */
function convertMarkdownToHtml(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';

    const paragraphs = raw.split(/\r?\n\r?\n+/);
    return paragraphs
        .filter(p => p.trim())
        .map(p => {
            const lines = p.split(/\r?\n/).map(processInline);
            return `<p>${lines.join('<br>')}</p>`;
        })
        .join('\n');
}

/**
 * インライン要素処理
 */
function processInline(line) {
    let text = String(line);

    // リンク → プレースホルダ
    const links = [];
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
        const ph = `\x00L${links.length}\x00`;
        links.push(`<a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(label)}</a>`);
        return ph;
    });

    // HTMLエスケープ
    text = escHtml(text);

    // 太字・斜体
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

    // リンク復元
    links.forEach((html, i) => {
        text = text.split(`\x00L${i}\x00`).join(html);
    });

    return text;
}

// ============================================================================
// Googleドキュメント → HTML変換
// ============================================================================

/**
 * GoogleドキュメントをHTMLに変換
 * - 見出し (h2-h4)
 * - 段落
 * - リスト (ul/ol)
 * - インライン画像 (Base64埋め込み)
 * - テキスト装飾 (太字/斜体/リンク)
 */
function convertDocToHtml(docId) {
    const doc = DocumentApp.openById(docId);
    const body = doc.getBody();
    const html = [];
    const listStack = [];

    for (let i = 0; i < body.getNumChildren(); i++) {
        const child = body.getChild(i);
        const type = child.getType();

        if (type === DocumentApp.ElementType.PARAGRAPH) {
            closeAllLists(html, listStack);

            const p = child.asParagraph();
            const heading = p.getHeading();

            if (heading && heading !== DocumentApp.ParagraphHeading.NORMAL) {
                const tag = getHeadingTag(heading);
                const align = getAlignmentStyle(p.getAlignment());
                const text = escHtml(p.getText()).trim();

                // 見出しの中身もレンダリングして装飾を維持する
                const content = renderElement(p);
                if (content.trim()) {
                    const style = align ? ` style="${align}"` : '';
                    html.push(`<${tag}${style}>${content}</${tag}>`);
                }
            } else {
                const pHtml = renderParagraph(p);
                if (pHtml.trim()) html.push(pHtml);
            }

        } else if (type === DocumentApp.ElementType.LIST_ITEM) {
            const li = child.asListItem();
            const tag = isUnordered(li.getGlyphType()) ? 'ul' : 'ol';
            const level = li.getNestingLevel();

            while (listStack.length < level + 1) {
                html.push(`<${tag}>`);
                listStack.push(tag);
            }
            while (listStack.length > level + 1) {
                html.push(`</${listStack.pop()}>`);
            }

            html.push(`<li>${renderElement(li)}</li>`);

        } else if (type === DocumentApp.ElementType.TABLE) {
            closeAllLists(html, listStack);
            html.push(renderTable(child.asTable()));

        } else if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
            closeAllLists(html, listStack);
            html.push('<hr>');

        } else {
            closeAllLists(html, listStack);
            // その他の要素はスキップまたは簡易テキスト化
            // const text = child.getText?.()?.trim();
            // if (text) html.push(`<p>${escHtml(text)}</p>`);
        }
    }

    closeAllLists(html, listStack);
    return html.join('\n');
}

function closeAllLists(html, stack) {
    while (stack.length) html.push(`</${stack.pop()}>`);
}

function getHeadingTag(h) {
    const map = {
        [DocumentApp.ParagraphHeading.HEADING1]: 'h2',
        [DocumentApp.ParagraphHeading.HEADING2]: 'h3',
        [DocumentApp.ParagraphHeading.HEADING3]: 'h4',
        [DocumentApp.ParagraphHeading.TITLE]: 'h2',
        [DocumentApp.ParagraphHeading.SUBTITLE]: 'h3'
    };
    return map[h] || 'p';
}

function isUnordered(glyph) {
    return [
        DocumentApp.GlyphType.BULLET,
        DocumentApp.GlyphType.HOLLOW_BULLET,
        DocumentApp.GlyphType.SQUARE_BULLET
    ].includes(glyph);
}

function getAlignmentStyle(align) {
    const map = {
        [DocumentApp.HorizontalAlignment.LEFT]: 'text-align: left;',
        [DocumentApp.HorizontalAlignment.CENTER]: 'text-align: center;',
        [DocumentApp.HorizontalAlignment.RIGHT]: 'text-align: right;',
        [DocumentApp.HorizontalAlignment.JUSTIFY]: 'text-align: justify;'
    };
    return map[align] || '';
}

function renderTable(table) {
    let html = '<table style="border-collapse: collapse; width: 100%;" border="1">';
    for (let r = 0; r < table.getNumRows(); r++) {
        const row = table.getRow(r);
        html += '<tr>';
        for (let c = 0; c < row.getNumCells(); c++) {
            const cell = row.getCell(c);
            const content = renderElement(cell); // 再帰的にセル内要素をレンダリング

            let style = 'padding: 5pt; border: 1px solid #000;';

            // 背景色
            const bgColor = cell.getBackgroundColor();
            if (bgColor) style += ` background-color: ${bgColor};`;

            // 垂直方向の配置
            const vAlign = cell.getVerticalAlignment();
            if (vAlign === DocumentApp.VerticalAlignment.TOP) style += ' vertical-align: top;';
            else if (vAlign === DocumentApp.VerticalAlignment.CENTER) style += ' vertical-align: middle;';
            else if (vAlign === DocumentApp.VerticalAlignment.BOTTOM) style += ' vertical-align: bottom;';

            // 幅 (列ごとの幅を取得)
            try {
                const width = table.getColumnWidth(c);
                if (width) style += ` width: ${width}pt;`;
            } catch (e) {
                // getColumnWidthはエラーになることがあるので無視
            }

            html += `<td style="${style}">${content}</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    return html;
}

function renderParagraph(p) {
    const parts = [];
    for (let i = 0; i < p.getNumChildren(); i++) {
        parts.push(renderChild(p.getChild(i)));
    }
    const inner = parts.join('') || escHtml(p.getText());

    // アライメント
    const align = getAlignmentStyle(p.getAlignment());

    // インデント
    const indentStart = p.getIndentStart();
    const indent = indentStart ? `padding-left: ${indentStart}pt;` : '';

    // 行間・段落間隔
    const lineSpacing = p.getLineSpacing();
    const spaceBefore = p.getSpacingBefore();
    const spaceAfter = p.getSpacingAfter();

    const spacing = [];
    if (lineSpacing) spacing.push(`line-height: ${lineSpacing}`);
    if (spaceBefore) spacing.push(`margin-top: ${spaceBefore}pt`);
    if (spaceAfter) spacing.push(`margin-bottom: ${spaceAfter}pt`);

    const style = [align, indent, ...spacing].filter(Boolean).join(' ');
    const styleAttr = style ? ` style="${style}"` : '';

    return inner.trim() ? `<p${styleAttr}>${inner}</p>` : '';
}

function renderElement(el) {
    const parts = [];
    // 要素によってはgetNumChildrenを持たない場合があるのでチェック
    if (el.getNumChildren) {
        for (let i = 0; i < el.getNumChildren(); i++) {
            parts.push(renderChild(el.getChild(i)));
        }
    } else if (el.getText) {
        return escHtml(el.getText());
    }
    return parts.join('');
}

function renderChild(child) {
    const type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
        return renderParagraph(child.asParagraph());
    }

    if (type === DocumentApp.ElementType.TEXT) {
        return renderText(child.asText());
    }

    if (type === DocumentApp.ElementType.INLINE_IMAGE) {
        try {
            const img = child.asInlineImage();
            const blob = img.getBlob();
            const b64 = Utilities.base64Encode(blob.getBytes());
            const ct = blob.getContentType() || 'image/jpeg';
            const w = img.getWidth();
            const h = img.getHeight();
            return `<img src="data:${ct};base64,${b64}" width="${w}" height="${h}" alt="" style="max-width:100%; height:auto">`;
        } catch (e) {
            return '';
        }
    }

    return escHtml(child.getText?.() || '');
}

function renderText(textEl) {
    const text = textEl.getText();
    if (!text) return '';

    const indices = textEl.getTextAttributeIndices();
    let html = '';
    let last = 0;

    for (let i = 0; i < indices.length; i++) {
        const start = indices[i];
        const end = i + 1 < indices.length ? indices[i + 1] : text.length;

        if (start > last) html += escHtml(text.substring(last, start));

        const attrs = textEl.getAttributes(start);
        let chunk = escHtml(text.substring(start, end));

        // リンク
        if (attrs[DocumentApp.Attribute.LINK_URL]) {
            chunk = `<a href="${escHtml(attrs[DocumentApp.Attribute.LINK_URL])}">${chunk}</a>`;
        }

        // 基本スタイル
        if (attrs[DocumentApp.Attribute.BOLD]) chunk = `<strong>${chunk}</strong>`;
        if (attrs[DocumentApp.Attribute.ITALIC]) chunk = `<em>${chunk}</em>`;
        if (attrs[DocumentApp.Attribute.UNDERLINE]) chunk = `<u>${chunk}</u>`;
        if (attrs[DocumentApp.Attribute.STRIKETHROUGH]) chunk = `<s>${chunk}</s>`;

        // 上付き・下付き
        const offset = attrs[DocumentApp.Attribute.TEXT_OFFSET]; // SUPERSCRIPT/SUBSCRIPT
        if (offset === DocumentApp.TextOffset.SUPERSCRIPT) chunk = `<sup>${chunk}</sup>`;
        if (offset === DocumentApp.TextOffset.SUBSCRIPT) chunk = `<sub>${chunk}</sub>`;

        // 色・背景色
        const fgColor = attrs[DocumentApp.Attribute.FOREGROUND_COLOR];
        const bgColor = attrs[DocumentApp.Attribute.BACKGROUND_COLOR];

        // フォント
        const fontSize = attrs[DocumentApp.Attribute.FONT_SIZE];
        const fontFamily = attrs[DocumentApp.Attribute.FONT_FAMILY];

        let style = [];
        if (fgColor && fgColor !== '#000000') style.push(`color: ${fgColor}`);
        if (bgColor && bgColor !== '#ffffff') style.push(`background-color: ${bgColor}`);
        if (fontSize) style.push(`font-size: ${fontSize}pt`);
        if (fontFamily) style.push(`font-family: '${fontFamily}', sans-serif`);

        if (style.length > 0) {
            chunk = `<span style="${style.join('; ')}">${chunk}</span>`;
        }

        html += chunk;
        last = end;
    }

    if (last < text.length) html += escHtml(text.substring(last));
    return html;
}

// ============================================================================
// Webhook送信
// ============================================================================

/**
 * HMAC-SHA256署名付きWebhook送信
 * 
 * サーバー側検証 (auth.middleware.js:11-36):
 * - message = `${timestamp}.${bodyRaw}`
 * - signature = "sha256=" + hex(HMAC-SHA256(secret, message))
 * - 許容誤差: 300秒
 */
function sendWebhook(url, payload, timestamp) {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('WEBHOOK_SECRET');

    if (!secret) {
        Logger.log('[ERROR] WEBHOOK_SECRET 未設定');
        Logger.log('[INFO] 設定: プロジェクト設定 → スクリプトプロパティ → WEBHOOK_SECRET');
        return;
    }

    // タイムスタンプ（Unix秒）
    const ts = Math.floor(timestamp.getTime() / 1000);

    // ペイロードJSON
    // 署名不一致問題回避のため、非ASCII文字をUnicodeエスケープしてASCIIのみにする
    // 詳細は escapeNonAscii() のコメントを参照
    const body = escapeNonAscii(JSON.stringify(payload));

    // 署名計算（サーバー側と同一形式）
    const message = `${ts}.${body}`;
    const sigBytes = Utilities.computeHmacSha256Signature(message, secret);
    const sigHex = sigBytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');

    Logger.log(`[DEBUG] ts=${ts}, bodyLen=${body.length}, sigHead=${sigHex.slice(0, 16)}`);

    // リクエスト
    const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'X-Timestamp': String(ts),
            'X-Signature': `sha256=${sigHex}`
        },
        payload: body,
        muteHttpExceptions: true
    };

    try {
        const res = UrlFetchApp.fetch(url, options);
        const code = res.getResponseCode();
        const text = res.getContentText();

        if (code >= 200 && code < 300) {
            Logger.log(`[SUCCESS] ${code}: ${text}`);
        } else {
            Logger.log(`[ERROR] ${code}: ${text}`);
        }
    } catch (err) {
        Logger.log(`[ERROR] 送信失敗: ${err}`);
    }
}

// ============================================================================
// ユーティリティ
// ============================================================================

function hasValue(nv, key) {
    return !!(nv[key]?.[0]?.trim());
}

function getValue(nv, key) {
    return nv[key]?.[0]?.trim() || null;
}

/**
 * 複数選択（チェックボックス）の値を配列で取得
 * @param {Object} nv - namedValues
 * @param {string} key - 質問タイトル
 * @returns {string[]} - 選択された値の配列
 */
function getValues(nv, key) {
    const arr = nv[key];
    if (!arr || !Array.isArray(arr)) return [];
    return arr.map(v => String(v || '').trim()).filter(Boolean);
}

/**
 * 隊の複数選択を正規化
 * - 日本語名→英語スラッグに変換
 * - 複数の場合はカンマ区切りで結合
 * @param {string[]} units - 隊名配列
 * @returns {string|null} - カンマ区切り文字列 or null
 */
function normalizeUnits(units) {
    if (!units || units.length === 0) return null;

    const mapping = {
        '団全体': 'all',
        'ビーバー隊': 'beaver',
        'ビーバー': 'beaver',
        'カブ隊': 'cub',
        'カブ': 'cub',
        'ボーイ隊': 'boy',
        'ボーイ': 'boy',
        'ベンチャー隊': 'venture',
        'ベンチャー': 'venture',
        'ローバー隊': 'rover',
        'ローバー': 'rover'
    };

    const normalized = units
        .map(u => mapping[u] || u.toLowerCase())
        .filter(Boolean);

    return normalized.length > 0 ? normalized.join(',') : null;
}

function extractDocId(url) {
    const m = String(url || '').match(/\/d\/([-\w]{25,})/);
    return m?.[1] || null;
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================================
// デバッグ・テスト
// ============================================================================

/** 設定確認 */
function debugConfig() {
    const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    Logger.log(`BASE_URL: ${CONFIG.BASE_URL}`);
    Logger.log(`NEWS: ${CONFIG.ENDPOINTS.NEWS}`);
    Logger.log(`ACTIVITY: ${CONFIG.ENDPOINTS.ACTIVITY}`);
    Logger.log(`SECRET: ${secret ? `設定済み(${secret.length}文字)` : '未設定'}`);
}

/** ニュースWebhookテスト */
function debugSendNews() {
    const payload = {
        title: 'テストニュース',
        content: '<p>テスト本文</p>',
        images: [],
        category: 'お知らせ',
        unit: 'boy',
        tags: ['テスト']
    };
    sendWebhook(CONFIG.BASE_URL + CONFIG.ENDPOINTS.NEWS, payload, new Date());
}

/** 活動報告Webhookテスト */
function debugSendActivity() {
    const payload = {
        title: 'テスト活動報告',
        content: '<p>テスト本文</p>',
        images: [],
        category: 'キャンプ',
        unit: 'cub',
        tags: ['テスト'],
        activity_date: new Date().toISOString()
    };
    sendWebhook(CONFIG.BASE_URL + CONFIG.ENDPOINTS.ACTIVITY, payload, new Date());
}

// ============================================================================
// その他のユーティリティ
// ============================================================================

/**
 * 重要: 署名計算におけるエンコーディング問題について
 * 
 * Google Apps Script (Javaベース) と Node.js (V8/C++) 間で、
 * 日本語（マルチバイト文字）を含むJSON文字列のバイナリ表現が微妙に異なるケースがあり、
 * HMAC-SHA256署名が一致しない問題が発生します。
 * 
 * これを回避するため、送信するJSONペイロード内の全ての非ASCII文字を
 * Unicodeエスケープ形式 (\u30c6\u30b9\u30c8...) に変換し、
 * 通信経路上では「ASCII文字のみ」の状態にします。
 * 
 * サーバー側(Node.js)は JSON.parse() する際に自動的にこれをデコードするため、
 *特別な対応は不要で、署名検証もASCIIベースで行われるため確実に一致します。
 */
function escapeNonAscii(str) {
    return str.replace(/[^\x00-\x7F]/g, c => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
}

/** Markdown変換テスト */
function debugMarkdown() {
    const md = '**太字** と _斜体_ と [リンク](https://example.com)\n\n新しい段落';
    Logger.log(convertMarkdownToHtml(md));
}
```
