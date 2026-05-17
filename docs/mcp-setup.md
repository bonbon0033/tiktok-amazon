# MCP セットアップ — Claude Code から TikTok 自動投稿

このプロジェクトは [Model Context Protocol](https://modelcontextprotocol.io/) サーバーを同梱しており、Claude Code から直接 TikTok 投稿ツールを呼べる。

```
Claude Code
   ↓  (MCP tool call: mcp__tiktok-publisher__tiktok_inbox_post)
mcp-servers/tiktok-mcp.mjs
   ↓  (HTTPS)
TikTok Content Posting API
   ↓
あなたの TikTok アカウント
```

## セットアップ手順（合計 30-60分）

### 1. TikTok 開発者アプリを作成（10分）

1. <https://developers.tiktok.com/> にログイン (TikTok アカウントで)
2. 「Manage Apps」→「Connect an app」→「Connect manually」
3. アプリ情報を入力:
   - App name: 例 `YourHandle Auto Poster`
   - Description: 「Personal use, automated posting of self-made affiliate videos」
   - Category: Tools / Productivity
4. 「Products」タブで以下を **Add** する:
   - **Login Kit**（OAuth）
   - **Content Posting API**
5. 「Login Kit」の設定:
   - Redirect URI: `http://localhost:8080/callback`
   - Scopes: `user.info.basic`, `video.upload`, `video.publish`
6. 「Content Posting API」の設定:
   - **Direct Post** モードを使う場合は「Apply for Audit」(初回は数日かかる)
   - **Inbox post** モードだけなら審査不要、すぐ使える ⭐ 推奨

### 2. 環境変数を設定（2分）

プロジェクトルートに `.env` を作成 (gitignore 済):

```bash
TIKTOK_CLIENT_KEY=XXXXXXXXXXXX        # アプリの Client Key (Manage Apps で確認)
TIKTOK_CLIENT_SECRET=XXXXXXXXXXXX     # Client Secret
TIKTOK_REDIRECT_URI=http://localhost:8080/callback
```

参考: `.env.example` をコピーして埋める。

### 3. OAuth トークン取得（3分）

```bash
node scripts/tiktok-auth.mjs
# → ブラウザが開いて TikTok にログイン → アプリ承認
# → callback で .tiktok-auth.json に access_token が保存される
```

確認:

```bash
cat .tiktok-auth.json
# → { "access_token": "...", "expires_in": 86400, ... }
```

⚠ `.tiktok-auth.json` は **gitignore 必須**（access_token = 認可ヘッダー相当）。

### 4. CLI でのテスト投稿（3分）

```bash
# Inbox モード (drafts へ。即時公開しない、TikTok アプリで最終確認)
node scripts/tiktok-publish.mjs output/top3-price-tiktok-20260516.mp4

# 出力例:
# ▶ Init (inbox) top3-price-tiktok-20260516.mp4 (11.4 MB)
#   publish_id: v_inbox_file~v2-1.xxxxxx
# ▶ Upload to open-upload.tiktokapis.com
# ✓ Uploaded
# → Video is in TikTok inbox/drafts.
# → Open the TikTok app to finalize caption + sound + publish.
```

スマホで TikTok アプリ → プロフィール → 「ドラフト」を開けば動画が入ってる。
キャプ + トレンド音源 + ブランドコンテンツ開示を設定して投稿。

### 5. Claude Code に MCP サーバー登録（5分）

`~/.claude/mcp.json` (なければ作成) に追加:

```json
{
  "mcpServers": {
    "tiktok-publisher": {
      "command": "node",
      "args": ["C:/Users/googo/projects/tiktok-amazon/mcp-servers/tiktok-mcp.mjs"]
    }
  }
}
```

Claude Code を再起動 → セッション開始時に `mcp__tiktok-publisher__*` ツールが登録される。

### 6. Claude Code から自然言語で投稿

```
> 最新の output/*.mp4 を inbox に投稿して
```

→ Claude が `mcp__tiktok-publisher__tiktok_inbox_post` を呼び、結果を返す。

## MCP サーバーが提供するツール

| ツール名 | 用途 | スコープ要件 |
|---|---|---|
| `tiktok_inbox_post` | 動画をドラフトにアップ (要審査なし) | `video.upload` |
| `tiktok_direct_post` | 動画を即時公開 (要審査) | `video.publish` (audited) |
| `tiktok_check_status` | 投稿の処理状況を確認 | 上記いずれか |
| `tiktok_creator_info` | クリエイターの投稿制限を取得 | `user.info.basic` |

## 規約・安全性の確認事項

- **Inbox モード が圧倒的に安全**: TikTok の審査不要、誤投稿リスク低い。最終確認をユーザーが必ず通すので brand content 開示も漏れない。
- **Direct モードは Audited App 専用**: アプリの用途審査 + 機能審査の両方を通過する必要あり。Yu のフェーズ的に Week 9 以降。
- **AI 生成ラベル**: TikTok の 2026 ルールで Edge TTS / AI 編集された動画は「AI-generated content」ラベルを付ける義務がある。`tiktok_direct_post` の `ai_generated_toggle` を `true` にすればこのフラグが立つ。Inbox モードの場合はアプリで手動 ON にする。
- **ブランドコンテンツ開示**: Amazon Associates 規約で必須。`brand_content_toggle: true` (default) で自動 ON。
- **レート制限**: 1日 15投稿 / アカウント (TikTok API 仕様)。スパム判定回避のため週 5 本前後に留める。
- **Non-public mode 制限**: 未審査アプリは初期はプライバシー `SELF_ONLY` のみ。動作確認は SELF_ONLY で行う。

## トラブルシューティング

### "access_token expired" エラー

```bash
# .tiktok-auth.json に refresh_token があれば自動更新したいが、今は再認証が早い
rm .tiktok-auth.json
node scripts/tiktok-auth.mjs
```

### "scope not granted" エラー

開発者アプリの設定で対応スコープ (video.upload / video.publish) が有効か確認。再認証必要。

### "invalid app" エラー

Client Key / Secret が間違っている、または開発者アプリが「Approved」になっていない (Inbox は Development モードでも動くが、Direct は要 Production 切替)。

### CapCut 連携は？

CapCut は公式の MCP / Open API を出していない (2026年5月時点)。よってこのプロジェクトは:

- **動画生成は HyperFrames で完結** (35秒の GSAP timeline でビート同期も完了済)
- **音源は TikTok 内のトレンドを後乗せ** (`scripts/render-for-tiktok.sh` がナレなし版を作る)

これで CapCut 不要の運用が成立する。CapCut 公式 API がリリースされたら MCP サーバーを追加する。

## 完全自動投稿の最短経路（Week 9 以降）

```bash
# 1. Direct post スコープ申請 (TikTok 開発者画面、数日〜2週間で審査)
# 2. 審査通過後、Claude Code から自然言語で:
#    「output/top3-price-tiktok-*.mp4 をキャプ X で direct post して、AI ラベル ON」
# 3. Claude が mcp__tiktok-publisher__tiktok_direct_post を呼んで完全自動投稿
```

これで「動画生成 → キャプ生成 → 投稿」まで Claude Code 1セッションで完結。

## 参考リンク

- [Content Posting API ドキュメント](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [Model Context Protocol 仕様](https://modelcontextprotocol.io/specification)
- [TikTok クリエイティブセンター (音源)](https://www.tiktok.com/business/creativecenter/inspiration/popular/music/jp)
