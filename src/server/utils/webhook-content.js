const imageDownloader = require('./imageDownloader');
const { convertWordToHtml } = require('./word-to-html');
const { WordImportError, convertExcelToHtml, convertPdfToHtml } = require('./document-import');

// ファイル添付（Base64）のキーと変換関数
const FILE_CONVERTERS = { docx: convertWordToHtml, xlsx: convertExcelToHtml, pdf: convertPdfToHtml };

/**
 * Webhookの本文・画像・添付ファイルから、保存用の記事内容を組み立てる
 * お知らせ（news）と活動報告（activity）のWebhookで共通
 *
 * @param {object} safeBody サニタイズ済みのリクエストボディ
 * @param {object} [deps] テスト用の差し替え { processImages, deleteImages, converters }
 * @returns {Promise<
 *   { ok: true, content: string, imgs: string[], hasFile: boolean, fileKey: string|undefined } |
 *   { ok: false, status: number, error: string }
 * >}
 */
async function buildWebhookArticle(safeBody, deps = {}) {
  const processImages = deps.processImages || imageDownloader.processImages;
  const deleteImages = deps.deleteImages || imageDownloader.deleteImages;
  const converters = deps.converters || FILE_CONVERTERS;

  const fileKeys = Object.keys(converters).filter((key) => Object.hasOwn(safeBody, key));
  if (fileKeys.length > 1) return { ok: false, status: 400, error: 'multiple_files' };
  const fileKey = fileKeys[0];
  const hasFile = Boolean(fileKey);

  let articleContent = safeBody.content;
  let rawImages = Array.isArray(safeBody.images) ? safeBody.images : [];
  if (hasFile) {
    try {
      const converted = await converters[fileKey](safeBody[fileKey]);
      articleContent = converted.content;
      rawImages = converted.images;
    } catch (error) {
      if (!(error instanceof WordImportError)) throw error;
      return { ok: false, status: error.status, error: error.message };
    }
  }

  const imgs = await processImages(rawImages);
  if (hasFile && imgs.length !== rawImages.length) {
    await deleteImages(imgs);
    return { ok: false, status: 422, error: fileKey + '_image_save_failed' };
  }

  // contentの画像プレースホルダーを実際の画像URLに置換
  // GAS側: <img data-image-index="N" ...> → <img src="/uploads/images/xxx.webp" ...>
  const content = String(articleContent).replace(
    /<img\s+data-image-index="(\d+)"([^>]*)>/gi,
    (match, indexStr, rest) => {
      const index = parseInt(indexStr, 10);
      if (index >= 0 && index < imgs.length) {
        return `<img src="${imgs[index]}"${rest}>`;
      }
      // インデックス範囲外の場合はプレースホルダーを削除
      return '';
    }
  );

  return { ok: true, content, imgs, hasFile, fileKey };
}

module.exports = { FILE_CONVERTERS, buildWebhookArticle };
