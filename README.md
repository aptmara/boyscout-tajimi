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

* HTML5
* CSS3 (主に `common-styles.css` で共通スタイルを定義)
* JavaScript (主に `common-scripts.js` で共通スクリプトを定義)

## ローカル環境での閲覧方法

当初は静的サイトでしたが、管理機能の追加に伴い、Node.jsサーバーが必要になりました。

### 必要なもの
*   Node.js (v14以降を推奨)
*   npm または yarn

### 実行方法

1.  **リポジトリのクローン**:
    ```bash
    git clone https://github.com/aptmara/boyscout-tajimi.git
    cd boyscout-tajimi
    ```

2.  **依存関係のインストール**:
    `npm` または `yarn` のいずれかを使って、必要なライブラリをインストールします。
    ```bash
    # npm を使う場合
    npm install

    # yarn を使う場合
    yarn install
    ```

3.  **環境変数の設定**:
    プロジェクトのルートにある `.env.example` ファイルをコピーして `.env` という名前のファイルを作成します。
    ```bash
    cp .env.example .env
    ```
    その後、作成した `.env` ファイルを開き、指示に従って各変数に値を設定してください。特に `SESSION_SECRET` は必ず設定してください。

4.  **データベースの初期化**:
    以下のコマンドを実行して、SQLiteデータベースファイルを作成し、必要なテーブルと初回管理者ユーザーをセットアップします。このコマンドは最初に一度だけ実行すればOKです。
    ```bash
    node database.js
    ```
    初回管理者のユーザー名は `admin`、パスワードは `.env` ファイルで設定した `INITIAL_ADMIN_PASSWORD` の値です。

5.  **サーバーの起動**:
    ```bash
    node server.js
    ```
    サーバーが起動したら、ブラウザで `http://localhost:3000` を開くとサイトが表示されます。
    管理画面には `http://localhost:3000/admin/login.html` からアクセスできます。

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
