const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');
const { authMiddleware, adminOnlyMiddleware } = require('../middleware/auth.middleware');
const { logAudit, getClientIP } = require('../middleware/audit.middleware');

// 全エンドポイントで認証＋管理者権限を要求
router.use(authMiddleware);
router.use(adminOnlyMiddleware);

/**
 * ユーザー一覧取得
 */
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, username, role FROM admins ORDER BY id ASC'
        );
        res.json({ users: rows });
    } catch (err) {
        console.error('[Users] List Error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * ユーザー作成
 */
router.post('/', async (req, res) => {
    const { username, password, role } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'ユーザー名とパスワードは必須です。' });
    }

    const validRoles = ['admin', 'editor'];
    const userRole = validRoles.includes(role) ? role : 'editor';

    try {
        // 重複チェック
        const existing = await db.query(
            'SELECT id FROM admins WHERE username = $1',
            [username]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'このユーザー名は既に使用されています。' });
        }

        const hash = await bcrypt.hash(password, 12);
        await db.query(
            'INSERT INTO admins (username, password, role) VALUES ($1, $2, $3)',
            [username, hash, userRole]
        );

        // 監査ログ
        await logAudit({
            action: 'user_created',
            username: req.session?.user?.username || 'unknown',
            ipAddress: getClientIP(req),
            details: JSON.stringify({ targetUser: username, role: userRole })
        });

        console.log(`[Users] ユーザー作成: ${username} (role=${userRole})`);
        res.status(201).json({ message: 'ユーザーを作成しました。' });
    } catch (err) {
        console.error('[Users] Create Error:', err);
        res.status(500).json({ error: 'ユーザーの作成に失敗しました。' });
    }
});

/**
 * ユーザー更新
 */
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body || {};

    if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: '無効なユーザーIDです。' });
    }

    try {
        // ユーザー存在確認
        const existing = await db.query('SELECT id, username FROM admins WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'ユーザーが見つかりません。' });
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (username) {
            // 重複チェック
            const dup = await db.query(
                'SELECT id FROM admins WHERE username = $1 AND id != $2',
                [username, id]
            );
            if (dup.rows.length > 0) {
                return res.status(400).json({ error: 'このユーザー名は既に使用されています。' });
            }
            updates.push(`username = $${paramIndex++}`);
            params.push(username);
        }

        if (password) {
            const hash = await bcrypt.hash(password, 12);
            updates.push(`password = $${paramIndex++}`);
            params.push(hash);
        }

        if (role) {
            const validRoles = ['admin', 'editor'];
            if (validRoles.includes(role)) {
                updates.push(`role = $${paramIndex++}`);
                params.push(role);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: '更新する項目がありません。' });
        }

        params.push(id);
        await db.query(
            `UPDATE admins SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            params
        );

        // 監査ログ
        await logAudit({
            action: 'user_updated',
            username: req.session?.user?.username || 'unknown',
            ipAddress: getClientIP(req),
            details: JSON.stringify({ targetUserId: id, updates: Object.keys(req.body) })
        });

        console.log(`[Users] ユーザー更新: ID=${id}`);
        res.json({ message: 'ユーザーを更新しました。' });
    } catch (err) {
        console.error('[Users] Update Error:', err);
        res.status(500).json({ error: 'ユーザーの更新に失敗しました。' });
    }
});

/**
 * ユーザー削除
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: '無効なユーザーIDです。' });
    }

    // 自分自身は削除不可
    if (req.session?.user?.id === Number(id)) {
        return res.status(400).json({ error: '自分自身を削除することはできません。' });
    }

    try {
        const existing = await db.query('SELECT username FROM admins WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'ユーザーが見つかりません。' });
        }

        await db.query('DELETE FROM admins WHERE id = $1', [id]);

        // 監査ログ
        await logAudit({
            action: 'user_deleted',
            username: req.session?.user?.username || 'unknown',
            ipAddress: getClientIP(req),
            details: JSON.stringify({ targetUser: existing.rows[0].username })
        });

        console.log(`[Users] ユーザー削除: ${existing.rows[0].username}`);
        res.json({ message: 'ユーザーを削除しました。' });
    } catch (err) {
        console.error('[Users] Delete Error:', err);
        res.status(500).json({ error: 'ユーザーの削除に失敗しました。' });
    }
});

module.exports = router;
