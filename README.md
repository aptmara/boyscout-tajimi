# ボーイスカウト 多治見第一団 公式ウェブサイト

このリポジトリは、ボーイスカウト多治見第一団の公式サイトのソースです。静的HTMLをベースに、Node.js + Express + PostgreSQL による管理画面・APIでニュース/活動記録/サイト設定を更新できます。

## 主要機能

- 公開サイト: トップ/団紹介/各隊ページ/活動記録/お知らせ/入団案内/お問い合わせ など
- 管理画面: ニュース・活動記録の作成/編集/削除、サイト共通設定の一括更新
- API: ニュース/活動記録の公開取得、管理用CRUD、サイト公開設定の取得
- Webhook取り込み: 署名付きJSONを受け取り、ニュース/活動記録を自動登録
- 画像はURL参照方式（ファイルは保持せず、外部ストレージ/CDNのURLを保存）

## 技術スタック

- フロント: HTML/CSS（Tailwind・`common-styles.css`）/ Vanilla JS
- サーバ: Node.js 18+ / Express 5
- DB: PostgreSQL（`pg`）/ セッションは `connect-pg-simple` でPostgresに保存
- 補助: `.env` 読込（`dotenv`）、CSSビルド（`tailwindcss`）

## ディレクトリ（要点のみ）

- `server.js`: エントリ。静的配信・セッション・DB連携API・Webhook・`/json-api` ルータのマウント・`/uploads` の公開
- `server-json.js`: JSONファイル保存ベースの実験用API（`/json-api` 配下にマウント、本番非推奨）
- `database.js`: Postgres接続/初期化（テーブル作成・VIEW/TRIGGER・初回管理者作成）
- `admin/`: 管理UI（ログイン・ダッシュボード・編集・設定・ブランディング）
- `dynamic-*.js`: 公開ページ側の動的読込（ニュース/活動の一覧・詳細、トップの最新表示など）
- `styles/` + `tailwind.config.js`: CSSビルド入力。出力は `common-styles.css`

## セットアップ

前提: Node.js 18+ / PostgreSQL / npm または yarn

1) 依存関係のインストール
- `npm install`

2) 環境変数（.env）
- `DATABASE_URL`（必須）例: `postgres://USER:PASSWORD@HOST:PORT/DBNAME`
- `SESSION_SECRET`（必須）十分に長いランダム文字列
- `WEBHOOK_SECRET`（任意/使う場合は必須）Webhook署名検証用の秘密鍵
- `INITIAL_ADMIN_USERNAME`・`INITIAL_ADMIN_PASSWORD`（任意）初回管理者を自動作成
- `NODE_ENV`（任意）`production` 推奨
- `PORT`（任意）未設定時は 10000
- `HOST`（任意）未設定時は `0.0.0.0`
- `HMAC_TOLERANCE_SEC`（任意）デフォルト 300 秒
- `SMTP_HOST`（必須）お問い合わせフォームで使用するSMTPサーバーホスト名
- `SMTP_PORT`（任意）デフォルトは 587
- `SMTP_SECURE`（任意）`true` の場合は SMTPS (既定ポート 465) を利用
- `SMTP_STARTTLS`（任意）`false` で STARTTLS を無効化（デフォルトは `SMTP_SECURE=false` のとき自動的に STARTTLS を試行）
- `SMTP_REQUIRE_TLS`（任意）`true` で STARTTLS の利用を必須化
- `SMTP_TLS_REJECT_UNAUTHORIZED`（任意）`false` で自己署名証明書を許容
- `SMTP_USER` / `SMTP_PASS`（任意）SMTP 認証が必要な場合の資格情報
- `SMTP_FROM`（必須）送信メールの From ヘッダ（例: `"多治見第一団" <noreply@example.jp>`）
- `CONTACT_FORM_FROM`（任意）From ヘッダを個別指定したい場合に設定（未設定時は `SMTP_FROM` を使用）
- `DEFAULT_CONTACT_EMAIL`（任意）管理画面でメールアドレス未設定時の送信先フォールバック

3) DB 初期化
- `npm run db:setup`

4) 起動
- `npm start`
- アクセス: `http://localhost:10000`
- 管理画面: `http://localhost:10000/admin/login.html`

補足: セッションテーブルが自動作成されない場合、以下のDDLを実行してください。
```sql
CREATE TABLE IF NOT EXISTS "session" (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

## 管理画面

- ログイン: `/admin/login.html`（DBの `admins` テーブルのユーザー）
- ダッシュボード: `/admin/app.html`（ニュース・活動・設定・ブランディングに遷移）
- 記事編集: `/admin/edit.html`（ニュース）/ `/admin/activity-edit.html`（活動）
- サイト設定: `/admin/settings.html`（住所/連絡先/各隊情報/プライバシー/トップ画像など）

## API（要点）

- セッション: `POST /api/login`, `POST /api/logout`, `GET /api/session`
- 公開取得:
  - `GET /api/news`, `GET /api/news/:id`
  - `GET /api/activities`, `GET /api/activities/:id`
  - `GET /api/public-settings`（公開して良い範囲の設定のみ）
- 管理（要ログイン）:
  - `POST|PUT|DELETE /api/news/*`, `POST|PUT|DELETE /api/activities/*`
  - `PUT /api/settings`
- Webhook（HMAC署名必須／本文はJSON）:
  - `POST /api/news-webhook`
  - `POST /api/activity-webhook`

署名仕様（共通）
- ヘッダ: `X-Timestamp`（UNIX秒）, `X-Signature`（`sha256=<hex>` も可）
- 許容ずれ: 300 秒（`HMAC_TOLERANCE_SEC` で変更可）
- 計算式: `HMAC-SHA256(secret, "<timestamp>.<raw-body>" )`

サンプル
```bash
export WEBHOOK_SECRET=your-secret
ts=$(date +%s)
body='{"title":"テスト","content":"本文","images":["https://example.com/a.jpg"]}'
sig=$(node -e "const c=require('crypto');const s=process.env.WEBHOOK_SECRET;const ts=process.argv[1];const b=process.argv[2];console.log('sha256='+c.createHmac('sha256',s).update(ts+'.'+b,'utf8').digest('hex'));" $ts "$body")
curl -X POST http://localhost:10000/api/news-webhook \
  -H 'Content-Type: application/json' \
  -H "X-Timestamp: $ts" \
  -H "X-Signature: $sig" \
  --data "$body"
```

## 開発メモ

- CSS ビルド（Tailwind）: `npm run build:css`（入力: `styles/input.css` → 出力: `common-styles.css`）
- 実験用JSON API: `/json-api` 配下（本番では未使用想定）。画像は `/uploads` に保存・`/uploads` で公開
- 画像はURLで管理（Google Drive 等のURLやCDNを想定）

## 今後の展望

- 詳細ページの実装強化: `activity-detail-placeholder.html` / `news-detail-placeholder.html` の本格対応
- 画像まわり: アップロード機能 or 画像CDN連携（Drive直リンクの安全な埋め込み/サイズ最適化）
- 認証/運用強化: パスワードリセット、レート制限、CSRF対策、`helmet` 等のヘッダ強化
- Webhook堅牢化: リプレイ防止（nonce/一意ID）と署名検証ログの整備
- 設定/APIの整理: 重複ルートや権限制御の統一、公開/非公開キーの明確化
- 国際化/表示: 一部の文字化けの解消、UI文言の統一、アクセシビリティ改善（WCAG準拠）
- 開発体験: CI/テスト導入、型/静的検査、Docker化、環境差分のドキュメント整備

## ライセンス

- ISC（`package.json` 参照）
