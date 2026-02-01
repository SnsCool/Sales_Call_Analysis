# Sales Call Analysis - 仕様書

## 概要
Zoom録画を自動取得し、AIが営業通話の問題箇所を抽出、管理者がフィードバックを作成して営業担当者に共有するWebアプリケーション。

---

## システム構成

| 項目 | 技術 |
|------|------|
| フロントエンド | Next.js 14 + TypeScript + Tailwind CSS |
| バックエンド | Next.js API Routes |
| データベース | Supabase (PostgreSQL) |
| 認証 | Supabase Auth |
| 文字起こし | Groq API (Whisper) |
| AI分析 | OpenAI GPT-4 または Claude |
| 動画処理 | FFmpeg |
| 定期実行 | Vercel Cron または外部サービス |

---

## ユーザーロール

### 管理者
- 全営業担当者の録画を閲覧
- フル動画の閲覧
- AIが抽出した問題箇所の確認・修正
- フィードバックの作成・共有
- ナレッジ（チェックルール）の管理

### 営業担当者（32名）
- 自分の録画一覧を確認
- 自分へのフィードバックを確認
- 該当動画クリップ + 文字起こしの確認

---

## 主要機能

### 1. Zoom録画の自動取得
- 32アカウントのZoom APIからServer-to-Server OAuthで認証
- 定期実行（毎日 or 毎時）で新規録画をチェック
- 録画ファイル（MP4）をダウンロード・保存

### 2. 文字起こし
- Groq API (Whisper) で音声をテキスト化
- タイムスタンプ付きで保存
- 話者分離（可能であれば）

### 3. AI分析
- ナレッジ（マークダウン形式）に基づいて問題箇所を検出
- 検出項目:
  - 該当するルール名
  - タイムスタンプ（何分何秒）
  - 該当する発言テキスト
  - 問題の説明

### 4. 動画クリップ生成
- FFmpegで問題箇所の前後を切り出し
- タイムスタンプでジャンプ可能なプレイヤー

### 5. フィードバック管理
- AIが抽出した問題箇所一覧
- 管理者による修正・コメント追加
- 営業担当者への共有

### 6. Notionレポート連携
- 営業担当者ごとにフィードバック結果をNotionに自動追記
- 構造:
  - 営業担当者ページ → 月別 → 日付ごとの商談記録
  - 各記録に問題点一覧（タイムスタンプ + 内容）
- 特定ブロックへのリンク生成（block_id使用）
- アプリからリンククリックで該当箇所にジャンプ
- Notion API使用（要: NOTION_API_KEY, NOTION_DATABASE_ID）

### 7. Notionからナレッジ抽出（agent-browser使用）
- **Vercel agent-browser** でNotionページを取得
- 特徴:
  - トークン消費93%削減
  - Rust製CLI、高速動作
  - AIが処理しやすい簡潔な出力形式
- 変換フロー:
  ```
  agent-browser
       ↓ Notionにアクセス
  ページ内容を簡潔な形式で取得
       ↓ 変換スクリプト
  YAML+MD形式のナレッジファイル
       ↓
  knowledge/ ディレクトリに保存
  ```
- 必要: `npx @anthropic-ai/agent-browser` または `npx agent-browser`
- 定期同期または手動同期

### 8. ナレッジ管理
- **YAML + マークダウン形式**（フロントマター）でチェックルールを管理
- ファイル構造:
  ```
  knowledge/
  ├── greeting/
  │   ├── proper-greeting.md
  │   └── company-introduction.md
  ├── closing/
  │   └── next-action.md
  └── ng-words/
      └── prohibited-phrases.md
  ```
- ルールファイル例:
  ```markdown
  ---
  id: rule-001
  category: 挨拶
  priority: high
  keywords: [お世話になっております, ありがとうございます]
  check_type: must_include
  ---
  # 挨拶のルール
  通話開始時に適切な挨拶を行う必要があります。
  ## チェックポイント
  - 会社名を名乗っているか
  - 担当者名を名乗っているか
  ```
- アプリ内で編集可能（Supabaseにも同期）
- Git管理で変更履歴を追跡

---

## データモデル（Supabase）

### users
- id, email, name, role (admin/sales), zoom_account_id

### zoom_accounts
- id, name, account_id, client_id, client_secret (暗号化)

### recordings
- id, user_id, zoom_meeting_id, title, date, duration, video_url, transcript

### analyses
- id, recording_id, rule_id, timestamp, text, description, status (pending/approved/rejected)

### feedbacks
- id, recording_id, admin_id, content, shared_at

### knowledge_rules
- id, category, title, content (markdown), priority

---

## 画面構成

1. **ダッシュボード** - 未処理録画数、最新フィードバック
2. **録画一覧** - フィルタ・検索、ステータス表示
3. **録画詳細** - 動画プレイヤー + 文字起こし + 問題箇所一覧
4. **フィードバック作成** - 問題箇所の確認・修正・コメント
5. **ナレッジ管理** - ルールの追加・編集・削除
6. **設定** - アカウント管理、API設定

---

## 処理フロー

```
1. [定期実行] Zoom APIから新規録画を取得
       ↓
2. 録画ファイルをダウンロード
       ↓
3. Groq APIで文字起こし（タイムスタンプ付き）
       ↓
4. AIがナレッジに基づいて問題箇所を抽出
       ↓
5. 問題箇所の動画クリップを生成
       ↓
6. 管理者に通知
       ↓
7. 管理者が確認・修正
       ↓
8. 営業担当者に共有
```

---

## 必要な環境変数

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Groq API
GROQ_API_KEY=

# AI分析用
OPENAI_API_KEY= または ANTHROPIC_API_KEY=

# Notion連携
NOTION_API_KEY=
NOTION_DATABASE_ID=
```

---

## 実装順序

### Phase 1: 基盤構築
1. Supabaseプロジェクト作成・テーブル設計
2. 認証機能（管理者/営業担当者ログイン）
3. 基本的なUI（ダッシュボード、録画一覧）

### Phase 2: Zoom連携
4. Zoom OAuth認証
5. 録画一覧取得API
6. 録画ダウンロード機能

### Phase 3: 文字起こし・分析
7. Groq API連携（文字起こし）
8. ナレッジ管理機能
9. AI分析機能（問題箇所抽出）

### Phase 4: フィードバック
10. 動画クリップ生成
11. フィードバック作成・共有機能
12. 通知機能

### Phase 5: 自動化
13. 定期実行設定
14. バッチ処理最適化

---

## 検証方法

1. `npm run dev` で開発サーバー起動
2. Supabaseダッシュボードでデータ確認
3. 1アカウントでZoom録画取得テスト
4. 文字起こし精度確認
5. AI分析結果の妥当性確認
