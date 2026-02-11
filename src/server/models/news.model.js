const db = require('../database');
const { normalizeSlug, normalizeTags } = require('../utils/formatters.js');

class News {
  /**
   * フィルタリング、ソート、ページネーションを適用してニュースを取得します。
   * @param {object} options - フィルタリングとページネーションのオプション
   * @returns {Promise<{items: Array, total: number}>} - ニュースのリストと総数
   */
  static async findAll(options = {}) {
    const {
      category,
      unit,
      tags,
      tags_any,
      sort = 'newest',
      search = '',
      ym = '',
      page = 1,
      limit = 9,
    } = options;

    const lim = Math.min(parseInt(limit, 10), 100);
    const p = Math.max(parseInt(page, 10), 1);
    const offset = (p - 1) * lim;

    const where = [];
    const params = [];

    if (category && String(category).trim()) {
      params.push(String(category).trim());
      where.push(`category = $${params.length}`);
    }
    if (unit && String(unit).trim()) {
      // unit複数選択対応: カンマ区切りで検索（部分一致）
      params.push('%' + normalizeSlug(unit) + '%');
      where.push(`unit LIKE $${params.length}`);
    }
    if (tags && String(tags).trim()) {
      const t = normalizeTags(tags);
      if (t.length) {
        params.push(JSON.stringify(t));
        where.push(`tags @> $${params.length}::jsonb`);
      }
    }
    if (!tags && tags_any && String(tags_any).trim()) {
      const anyList = normalizeTags(tags_any);
      if (anyList.length) {
        params.push(anyList);
        where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) z WHERE z.value = ANY($${params.length}))`);
      }
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length})`);
    }
    if (ym && /^\d{4}-\d{2}$/.test(ym)) {
      params.push(ym);
      where.push(`to_char(created_at, 'YYYY-MM') = $${params.length}`);
    }

    let orderBy = 'ORDER BY display_date DESC';
    if (sort === 'oldest') {
      orderBy = 'ORDER BY created_at ASC';
    } else if (sort === 'title') {
      orderBy = 'ORDER BY title ASC';
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // SQLiteとPostgreSQLで異なるクエリを使用
    let query;
    if (db.useSqlite) {
      // SQLite用: JSON関数を使わずシンプルに取得
      query = `
        SELECT
          id,
          title,
          SUBSTR(REPLACE(REPLACE(REPLACE(content, '<', ' '), '>', ' '), '  ', ' '), 1, 150) AS summary,
          image_urls AS thumbnail,
          category,
          unit,
          tags,
          created_at,
          (SELECT COUNT(*) FROM news ${whereSql}) AS total_count
        FROM news
        ${whereSql}
        ${orderBy}
        LIMIT ? OFFSET ?
      `;
      // SQLiteでは$記号ではなく?を使用
      params.push(lim, offset);
    } else {
      // PostgreSQL用: JSONB関数を使用
      query = `
        SELECT
          id,
          title,
          LEFT(regexp_replace(content, '<[^>]*>', '', 'g'), 150) AS summary,
          CASE 
            WHEN jsonb_array_length(image_urls) > 0 THEN jsonb_build_array(image_urls->0)
            ELSE '[]'::jsonb
          END AS thumbnail,
          category,
          unit,
          tags,
          created_at,
          COUNT(*) OVER() AS total_count
        FROM news
        ${whereSql}
        ${orderBy}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(lim, offset);
    }

    const { rows } = await db.query(query, params);

    const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
    const items = rows.map(({ total_count, ...item }) => {
      // SQLiteではJSON文字列として保存されているため、配列にパース
      if (db.useSqlite) {
        if (typeof item.tags === 'string') {
          try {
            item.tags = JSON.parse(item.tags);
          } catch {
            item.tags = [];
          }
        }
        if (typeof item.thumbnail === 'string') {
          try {
            const parsed = JSON.parse(item.thumbnail);
            // 最初の画像のみを配列として返す
            item.thumbnail = Array.isArray(parsed) && parsed.length > 0 ? [parsed[0]] : [];
          } catch {
            item.thumbnail = [];
          }
        }
      }
      return item;
    });

    return { items, total };
  }

  // NOTE: findById, create, update, delete も同様にリファクタリングが必要です
}

module.exports = News;