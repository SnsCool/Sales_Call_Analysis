# Sales Call Analysis

Zoom録画を自動取得し、AIが営業通話の問題箇所を抽出するWebアプリ。

## セットアップ

### 1. Supabase設定（必須）

1. [Supabase](https://supabase.com/) でプロジェクト作成
2. SQL Editor で `supabase/migrations/001_initial_schema.sql` を実行
3. `.env.local` を作成:

```bash
cp .env.local.example .env.local
```

4. 以下を設定（Project Settings → API から取得）:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 2. 起動

```bash
npm install
npm run dev
```

http://localhost:3000 でアクセス

---

## 必要なAPIキー一覧

| 機能 | 必須 | 環境変数 | 取得先 |
|------|------|----------|--------|
| **認証・DB** | ✅ | `NEXT_PUBLIC_SUPABASE_URL` | [Supabase](https://supabase.com/) |
| | | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| | | `SUPABASE_SERVICE_ROLE_KEY` | |
| **Zoom録画** | | `ZOOM_ACCOUNT_ID` | [Zoom Marketplace](https://marketplace.zoom.us/) |
| | | `ZOOM_CLIENT_ID` | Server-to-Server OAuth |
| | | `ZOOM_CLIENT_SECRET` | |
| **文字起こし** | | `GROQ_API_KEY` | [Groq](https://console.groq.com/) |
| **AI分析** | | `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/) |
| | | または `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/) |
| **Notion連携** | | `NOTION_API_KEY` | [Notion](https://notion.so/my-integrations) |

---

## ファイル構成

```
├── docs/
│   ├── SPECIFICATION.md    # 仕様書
│   ├── DETAILED_DESIGN.md  # 詳細設計書
│   └── UI_DESIGN.md        # UI設計書
├── supabase/
│   └── migrations/         # DBマイグレーション
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (dashboard)/   # 認証後の画面
│   │   ├── api/           # API Routes
│   │   └── login/         # ログイン画面
│   ├── components/        # UIコンポーネント
│   ├── lib/               # ユーティリティ
│   ├── stores/            # Zustand状態管理
│   └── types/             # 型定義
```

---

## 画面一覧

| 画面 | パス | 説明 |
|------|------|------|
| ログイン | `/login` | メール/パスワード認証 |
| ダッシュボード | `/` | 統計・最新情報 |
| 録画一覧 | `/recordings` | 録画リスト |
| 録画詳細 | `/recordings/[id]` | 動画・分析結果 |
| ナレッジ管理 | `/knowledge` | ルール管理（管理者のみ） |
| 設定 | `/settings` | プロフィール・通知 |

---

## 開発

```bash
npm run dev      # 開発サーバー
npm run build    # ビルド
npm run lint     # Lint
```
