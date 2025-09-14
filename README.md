# ボーイスカウト 多治見第一団公式ウェブサイト

## 概要

このリポジトリは、ボーイスカウト 多治見第一団 の公式ウェブサイトのソースコードです。
私たちの団の活動、各部門の紹介、最新ニュース、入団案内など、様々な情報を提供することを目的としています。

## サイト構成と主なコンテンツ

本ウェブサイトは以下の主要なページで構成されています。

* **トップページ (`index.html`)**: ウェブサイトの顔となるメインページです。
* **私たちについて (`about.html`)**: 団の紹介、理念、活動方針などを掲載します。
* **各部門紹介**:
    * ビーバースカウト (`unit-beaver.html`)
    * カブスカウト (`unit-cub.html`)
    * ボーイスカウト (`unit-boy.html`)
    * ベンチャースカウト (`unit-venture.html`)
    * ローバースカウト (`unit-rover.html`)
* **活動記録 (`activity-log.html`)**: 定期的な集会や特別なイベントの様子をお伝えします。
    * 活動詳細 (例: `activity-detail-placeholder.html` - 今後拡充予定)
* **お知らせ (`news-list.html`)**: 団からの最新情報や告知事項を掲載します。
    * お知らせ詳細 (例: `news-detail-placeholder.html` - 今後拡充予定)
* **入団案内 (`join.html`)**: 新しくボーイスカウト活動に参加したい方への情報を提供します。
* **お問い合わせ (`contact.html`)**: ご質問や見学希望などの連絡先です。
* **その他**:
    * メンバー紹介 (プレースホルダー: `members-placeholder.html` - 今後拡充予定)
    * お客様の声・体験談 (`testimonials.html`)
    * プライバシーポリシー (`privacy.html`)
    * サイトマップ (`sitemap.html`)

## 使用技術

- フロント: HTML5 / CSS3（`common-styles.css`）/ JavaScript（`common-scripts.js`）
- バックエンド: Node.js 18+ / Express 5
- データベース: PostgreSQL（`pg`）
- セッション: `express-session` + `connect-pg-simple`（Postgresに保存）
- Webhook 署名: HMAC-SHA256（`WEBHOOK_SECRET`）

## セットアップ（ローカル・本番共通）

当初は静的サイトでしたが、現在は管理機能とAPIのため Node.js + PostgreSQL が必要です。

### 必要なもの
- Node.js 18 以上（グローバル `fetch` を使用）
- npm または yarn
- PostgreSQL（クラウドDB可）

### 環境変数（.env）

必須（本番想定）
- `DATABASE_URL`（Postgres接続文字列）
  - 例: `postgres://USER:PASSWORD@HOST:PORT/DBNAME`
  - SSLパラメータが無くても、コード側で `ssl: { rejectUnauthorized: false }` を指定しています。
- `SESSION_SECRET`（十分に長いランダム文字列）
- `WEBHOOK_SECRET`（Webhook用HMACの秘密鍵）
- `INITIAL_ADMIN_USERNAME`（初回管理者作成に使用・任意）
- `INITIAL_ADMIN_PASSWORD`（初回管理者作成に使用・任意）
- `NODE_ENV`（`production` 推奨）
- `PORT`（任意。未設定時は 3000）
- `HMAC_TOLERANCE_SEC`（任意。署名のタイムスタンプ許容秒、既定 300）

### インストールと初期化
```bash
# 依存関係インストール
npm install

# DB 初期化（テーブル作成・サイト設定の初期投入・初回管理者作成）
npm run db:setup

# 起動
npm start
```
アクセス: `http://localhost:3000`

管理画面: `http://localhost:3000/admin/login.html`

セッションは Postgres に保存します（`connect-pg-simple`）。環境やバージョンによりセッションテーブルが自動作成されない場合は、以下のようなスキーマを作成してください。
```sql
CREATE TABLE IF NOT EXISTS "session" (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

## 本番運用のポイント

- Node 18+ / `NODE_ENV=production` / 強力な `SESSION_SECRET` を設定
- `DATABASE_URL` はクラウドDB（Render/Supabase 等）に接続可
- ポートは `PORT` で指定（PaaSの要件に従う）
- 画像はURLを保持（サーバ側でファイル保存しない設計）
- ログ/デバッグ出力は本番では抑制（`NODE_ENV` により一部制御済み）

## 管理機能とサイト設定

### ログイン/ダッシュボード
- ログイン: `/admin/login.html`
- 記事管理（お知らせ）: `/admin/dashboard.html`（一覧/削除、`edit.html` で作成・編集）

### サイト設定（一括更新）
- ページ: `/admin/settings.html`
- API: `GET /api/settings`（公開）/ `GET /api/settings/all`（要ログイン）/ `PUT /api/settings`（要ログイン）
- 主な項目:
  - フッター/共通: 住所、電話（代表/サブ）、メール、問い合わせ担当者名
  - 各隊リーダー名: ビーバー/カブ/ボーイ/ベンチャー/ローバー
  - プライバシーポリシー: 制定日、最終更新日、窓口担当/電話/メール
  - お問い合わせ: Googleマップ埋め込みHTML
  - トップ画像: ヒーロー背景、活動ハイライト（3枚）、プロフィール（2枚）

反映先（例）:
- 共通連絡先: `.contact-address`, `.contact-phone`, `.contact-email`
- 各隊の指導者名: `.leader-*-name`（各隊ページ）
- プライバシー: `#enactment-date`, `#last-updated-date`, `.privacy-contact-*`
- お問い合わせ: `.contact-person-name`, `.contact-phone-secondary`, `#contact-map-embed`
- トップ画像: `.hero-bg`, `#index-activity-img-1..3`, `#index-testimonial-img-1..2`

（注）各隊ページのギャラリー等の画像は静的HTMLのままです。管理から差し替えたい場合は、同様のID/クラス付与と設定キー追加で拡張可能です。

## API 概要

### ニュース（News）
- 公開: `GET /api/news`, `GET /api/news/:id`
- 管理: `POST /api/news`, `PUT /api/news/:id`, `DELETE /api/news/:id`（要ログイン）
- Webhook: `POST /api/news-webhook`（HMAC 署名必須／本文は JSON）

### 活動記録（Activities）
- 公開: `GET /api/activities`, `GET /api/activities/:id`
- 管理: `POST /api/activities`, `PUT /api/activities/:id`, `DELETE /api/activities/:id`（要ログイン）
- Webhook: `POST /api/activity-webhook`（HMAC 署名必須／本文は JSON）

### Webhook 署名仕様（共通）
- ヘッダ: `X-Timestamp`（UNIX秒）, `X-Signature`（`sha256=<hex>` または `<hex>` のみ）
- 許容ずれ: 既定 300 秒（環境変数 `HMAC_TOLERANCE_SEC` で変更可）
- 署名計算: `HMAC-SHA256(secret, "<timestamp>.<rawBody>")`
- 注意: `rawBody` はUTF-8バイト列。JSONの空白や改行差は別計算になるため、送信側はサーバに送る文字列そのものを用いて署名を計算してください。

curl（例）
```bash
export WEBHOOK_SECRET=your-secret
ts=$(date +%s)
body='{"title":"テスト","content":"本文","images":["https://example.com/a.jpg"]}'
sig=$(node -e "const c=require('crypto');const s=process.env.WEBHOOK_SECRET;const ts=process.argv[1];const b=process.argv[2];console.log('sha256='+c.createHmac('sha256',s).update(ts+'.'+b,'utf8').digest('hex'));" $ts "$body")
curl -X POST http://localhost:3000/api/news-webhook \
  -H 'Content-Type: application/json' \
  -H "X-Timestamp: $ts" \
  -H "X-Signature: $sig" \
  --data "$body"
```

## 今後の展望 (TODO)

* **コンテンツ拡充**:
    * `activity-detail-placeholder.html` および `news-detail-placeholder.html` のテンプレートを元に、実際の活動記録やお知らせ記事を作成・追加。
    * `members-placeholder.html` に指導者や団委員の情報を掲載。
* **デザイン改善**:
    * 全体的なデザインのブラッシュアップ。
    * モバイルフレンドリーなレスポンシブデザインの強化。
* **機能追加**:
    * 活動記録やお知らせの簡単な更新システムの導入検討（例: 静的サイトジェネレータの活用）。
    * お問い合わせフォームの動作確認と改善。
* **アクセシビリティ**: WCAG (Web Content Accessibility Guidelines) に基づいたアクセシビリティの向上。

## 既知の注意点

- 一部の文言に文字化けが残存（`dynamic-activities.js` の表示テキストなど）。本番公開時は修正推奨。
- 画像アップロードは行わず、画像URLをDBに保持する運用です（外部ストレージ/CDNを想定）。
