---
description: ConoHa VPSへのデプロイ手順（Ubuntu 26.04 LTS + GitHub自動デプロイ）
---

# ConoHa VPS デプロイ手順書

## 前提条件

- **VPS**: ConoHa VPS（Ubuntu 26.04 LTS）
- **ドメイン**: tajimibs.org
- **リポジトリ**: https://github.com/aptmara/boyscout-tajimi

---

## Part 1: VPS初期設定（SSHでVPSに接続して実行）

### 1.1 VPSにSSH接続

```bash
ssh root@<VPSのIPアドレス>
```

### 1.2 システム更新

```bash
apt update && apt upgrade -y
```

### 1.3 デプロイ用ユーザー作成（rootでの運用は非推奨）

```bash
# deployユーザーを作成
adduser deploy
usermod -aG sudo deploy

# SSH鍵の設定
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 1.4 ファイアウォール設定

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## Part 2: 必須ソフトウェアのインストール

### 2.1 Node.js (v20 LTS) のインストール

```bash
# NodeSourceリポジトリを追加
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.jsをインストール
apt install -y nodejs

# バージョン確認
node -v
npm -v
```

### 2.2 PM2（プロセスマネージャー）のインストール

```bash
npm install -g pm2

# 起動時に自動実行するよう設定
pm2 startup systemd -u deploy --hp /home/deploy
```

### 2.3 Nginx のインストール

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 2.4 PostgreSQL のインストール

```bash
apt install -y postgresql postgresql-contrib

# PostgreSQL起動確認
systemctl status postgresql
```

---

## Part 3: データベース設定

### 3.1 PostgreSQLユーザーとデータベース作成

```bash
# postgresユーザーに切り替え
sudo -u postgres psql

# PostgreSQLコンソール内で実行
CREATE USER boyscout WITH PASSWORD '強力なパスワードをここに設定';
CREATE DATABASE boyscout_tajimi OWNER boyscout;
GRANT ALL PRIVILEGES ON DATABASE boyscout_tajimi TO boyscout;
\q
```

**重要**: パスワードは安全なものを設定し、メモしておいてください。

---

## Part 4: アプリケーションのデプロイ

### 4.1 ディレクトリ作成とリポジトリクローン

```bash
# deployユーザーに切り替え
su - deploy

# ディレクトリ作成
sudo mkdir -p /var/www/boyscout-tajimi
sudo chown deploy:deploy /var/www/boyscout-tajimi

# リポジトリをクローン
cd /var/www
git clone https://github.com/aptmara/boyscout-tajimi.git
cd boyscout-tajimi
```

### 4.2 環境変数ファイルの作成

```bash
nano /var/www/boyscout-tajimi/.env
```

以下の内容を記述：

```ini
# アプリケーション設定
PORT=3000
NODE_ENV=production

# データベース接続（PostgreSQL）
DATABASE_URL=postgresql://boyscout:パスワード@localhost:5432/boyscout_tajimi

# セキュリティ（必ず変更すること）
SESSION_SECRET=ここに64文字以上のランダム文字列を設定

# 初回管理者（db:setup時に作成）
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=安全な管理者パスワード
```

**SESSION_SECRETの生成方法**:
```bash
openssl rand -hex 32
```

### 4.3 依存関係インストールとビルド

```bash
cd /var/www/boyscout-tajimi
npm ci --production
npm run build
```

### 4.4 データベース初期化

```bash
npm run db:setup
```

### 4.5 PM2でアプリケーション起動

```bash
pm2 start npm --name "boyscout-tajimi" -- start
pm2 save
```

動作確認：
```bash
pm2 status
curl http://localhost:3000
```

---

## Part 5: Nginx設定（リバースプロキシ + HTTPS）

### 5.1 Nginx設定ファイル作成

```bash
sudo nano /etc/nginx/sites-available/boyscout-tajimi
```

以下の内容を記述：

```nginx
server {
    listen 80;
    server_name tajimibs.org www.tajimibs.org;

    # アップロードファイルのサイズ上限
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.2 設定を有効化

```bash
sudo ln -s /etc/nginx/sites-available/boyscout-tajimi /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # デフォルト設定を削除
sudo nginx -t  # 設定テスト
sudo systemctl reload nginx
```

---

## Part 6: SSL証明書（Let's Encrypt）

### 6.1 Certbot インストール

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 SSL証明書取得

**重要**: 実行前にドメインのDNS設定で、tajimibs.org がVPSのIPアドレスを指していることを確認してください。

```bash
sudo certbot --nginx -d tajimibs.org -d www.tajimibs.org
```

プロンプトに従って：
1. メールアドレスを入力
2. 利用規約に同意（A）
3. HTTPからHTTPSへのリダイレクト設定（2を選択推奨）

### 6.3 自動更新の確認

```bash
sudo certbot renew --dry-run
```

---

## Part 7: GitHub Actions用SSH鍵の設定

### 7.1 VPS側でSSH鍵ペアを生成

```bash
# deployユーザーで実行
su - deploy
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 7.2 秘密鍵を表示（コピー用）

```bash
cat ~/.ssh/github_actions
```

この内容を **すべて** コピーしてください（`-----BEGIN ... -----END ...` を含む）。

### 7.3 GitHub Secrets に登録

GitHubリポジトリで **Settings → Secrets and variables → Actions** に移動し、以下を登録：

| Secret名 | 値 |
|----------|-----|
| `VPS_HOST` | VPSのIPアドレス（例: `123.456.78.90`） |
| `VPS_USERNAME` | `deploy` |
| `VPS_SSH_KEY` | 上記でコピーした秘密鍵の全文 |
| `VPS_PORT` | `22`（変更している場合はそのポート番号） |

---

## Part 8: 動作確認

### 8.1 ブラウザで確認

1. `https://tajimibs.org` にアクセス
2. サイトが正常に表示されることを確認
3. `https://tajimibs.org/admin/login.html` で管理画面にログインできることを確認

### 8.2 自動デプロイの確認

1. ローカルでコードを変更
2. `git add . && git commit -m "テストデプロイ" && git push origin main`
3. GitHub → Actions タブでワークフローの実行を確認
4. VPSに変更が反映されていることを確認

---

## トラブルシューティング

### PM2のログ確認
```bash
pm2 logs boyscout-tajimi
```

### Nginxのエラーログ確認
```bash
sudo tail -f /var/log/nginx/error.log
```

### PostgreSQLの接続テスト
```bash
psql -U boyscout -d boyscout_tajimi -h localhost
```

### GitHub Actionsが失敗する場合
1. Secretsの値が正しいか確認
2. VPSでSSH接続をテスト: `ssh -i ~/.ssh/github_actions deploy@VPSのIP`
3. ファイアウォールでSSHポートが開いているか確認

---

## 定期メンテナンス

### システム更新（月1回推奨）
```bash
sudo apt update && sudo apt upgrade -y
pm2 update
```

### SSL証明書（自動更新されるが、念のため確認）
```bash
sudo certbot certificates
```

### ログのローテーション
```bash
pm2 flush  # PM2ログをクリア
```
