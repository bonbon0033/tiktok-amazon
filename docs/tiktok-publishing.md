# TikTok 投稿フロー完全ガイド（音源選定 + 自動化）

このプロジェクトの動画を **TikTok の動向に最適化** して投稿するためのガイド。
焼込ナレ版 / TikTok 音源版を使い分け、投稿は段階的に自動化する。

## 1. なぜ TikTok のトレンド音源を使うのか（事実）

| 効果 | 詳細 |
|---|---|
| **アルゴリズム加点** | トレンド音源使用動画は For You への露出量が 1.5-3倍になるという公式&第三者検証データあり |
| **「乗っかり拡散」** | 同じ音源を使った動画群がクラスタ化 → 既にバズった音源のリーチに乗れる |
| **音オフ視聴対応**| 40-60% は音オフ → 字幕で意味が通る前提なら、音は何でもいい (=トレンド使い得) |
| **オリジナリティ確保** | 音源 + 自分の映像の組合せでオリジナル化、TikTok の "リミックス文化" に乗れる |

→ **動画には焼込ナレを入れず、TikTok 内で音源を後乗せ** が現状ベスト。
焼込ナレ版は YouTube Shorts / Instagram Reels 用に流用する。

## 2. 当パイプラインの 2バージョン運用

```bash
# A. ナレ焼込版（YouTube Shorts / IG Reels 用）
npx hyperframes render --composition compositions-roots/top3-price.html --output output/top3-premium-YYYYMMDD.mp4

# B. ナレなし TikTok 用（音源は後乗せ）
bash scripts/render-for-tiktok.sh compositions-roots/top3-price.html
# → output/top3-price-tiktok-YYYYMMDD.mp4
```

両方を同じ `output/` に置き、プラットフォームで使い分ける。

## 3. TikTok トレンド音源の探し方

### 方法 A: TikTok クリエイティブセンター（公式）

URL: <https://www.tiktok.com/business/creativecenter/inspiration/popular/music/jp>

- **「人気上昇中の楽曲」** を毎週月曜にチェック
- ジャンル / 地域 / 期間でフィルタ可能
- 楽曲ごとに「使用動画数」「過去 7日間の伸び率」が見える
- 商用音源ライブラリ（ビジネスアカウント限定、無料楽曲多数）も同サイトから

### 方法 B: For You を観察

1. アプリの For You を 30分流す
2. **3回以上耳にした楽曲** = 旬
3. 音源ページに飛んで「保存」しておく（投稿時に呼び出し容易）

### 方法 C: ハッシュタグから逆引き

`#自己啓発` `#朝活` `#副業` のタグで最近 1週間のバズ動画 (10万再生+) を 10本見る → 多用されている音源を控えておく。

### 当ジャンルでの定番音源タイプ（2026 春時点）

| 動画タイプ | 推奨音源傾向 | 例 |
|---|---|---|
| ランキング型 (TOP5) | アップテンポ・トラップ系・80-110 BPM | TikTok の「電子・ヒップホップ」カテゴリ |
| ストーリー/スライド型 | lo-fi ピアノ・チル系 | 「インスピレーション」「ピアノ」カテゴリ |
| FOMO 煽り型 | 緊張感ある電子音・サイレン入り | 「サウンドエフェクト」「テンション」 |
| 朝活/美意識ルーティン | アコースティック・チル | 「ヒーリング」「自然」 |

> 楽曲タイトルは月単位で変わるので、ハードコードせず **毎週 月曜にクリエイティブセンターで更新** する運用に。

## 4. 投稿のステップ（手動運用）

1. `bash scripts/render-for-tiktok.sh <composition>` で TikTok 版 mp4 生成
2. `node agents/prepare-for-mobile.mjs` で `output/mobile-ready/` に投稿セット出力
   - `video.mp4`
   - `caption.txt` (キャプション)
   - `hashtags.txt` (ハッシュタグ 10個)
3. **mp4 + テキスト**をスマホへ転送
   - 推奨: Google Drive / iCloud / Dropbox の同期フォルダ
   - 高速: `adb push` (Android) / AirDrop (iOS)
4. TikTok アプリで投稿
   - 動画を選択 → **「サウンドを追加」** で **クリエイティブセンターで選んだ音源** を選択
   - キャプ・ハッシュをコピペ（クリップボード経由）
   - **「ブランドコンテンツ開示」を ON** に（規約必須）
   - 投稿
5. 投稿直後にコメント 1本を自分で書いてピン留め
6. 1時間後にアナリティクス確認

## 5. 自動化レベル別の選択肢

### Level 1: スマホ転送自動化（無料・即実装可能）

```
output/mobile-ready/  ←(自動コピー)←  output/*.mp4
                  ↓ (Drive 同期 / AirDrop)
              スマホ
                  ↓ (TikTok アプリ手動投稿)
              TikTok
```

→ 本プロジェクトの `agents/prepare-for-mobile.mjs` がここを担当。

### Level 2: TikTok Content Posting API（公式・要審査）

公式 Direct Post API。サーバから直接 TikTok に動画を post できる。

- **登録**: <https://developers.tiktok.com/> で開発者登録 → アプリ作成 → Content Posting API スコープ取得
- **条件**:
  - フォロワー数の最低条件あり（変動）
  - アプリ審査（用途・コンテンツの確認）
  - OAuth 認可（ユーザーごと）
- **コスト**: 開発・利用は無料
- **制約**:
  - 1日の投稿数上限あり
  - 投稿後の即時公開 / ドラフト保存 / プライベート公開を選択可能
  - 内容モデレーションが入る
- **コードのイメージ**（実装は Yu の認証取得後）:

  ```javascript
  // POST https://open.tiktokapis.com/v2/post/publish/video/init/
  // Authorization: Bearer <access_token>
  // body: { post_info: {...}, source_info: { video_size, chunk_size, total_chunk_count } }
  ```

- **推奨タイミング**: フォロワー 1,000 + 投稿 20本を超えてから検討。それまでは Level 1 で十分。

### Level 3: 非公式自動化（規約違反リスク）

`TikTokApi` (Python) や Selenium / Playwright で web 自動投稿。
**推奨しない**。アカウント停止 / IP ban のリスク高い。短期テストならともかく、長期運用では使うべきでない。

## 6. このプロジェクトでの推奨設定

| Phase | 投稿方法 | 自動化レベル |
|---|---|---|
| Week 1-4 (フォロワー 0-500) | スマホ手動 + `prepare-for-mobile` | Level 1 |
| Week 5-8 (フォロワー 500-1,000) | 同上 (頻度↑、週 5本) | Level 1 |
| Week 9+ (フォロワー 1,000+) | TikTok Content Posting API 申請 → 採用後完全自動 | Level 2 |

## 7. TikTok 規約・投稿時のセーフライン（再確認）

- **PR 表記**: 動画内バッジ ✓ + キャプに `#PR` ✓ + アプリ内「ブランドコンテンツ開示」ON（必須）
- **Amazon URL**: Bio Linktree から飛ばす（動画内 URL は表示しない / 短縮 URL は `amzn.to` のみ）
- **アフィリエイトリンクの URL 登録**: TikTok URL を Amazon Associates の管理画面に登録（必須）
- **音源**: クリエイティブセンターの **商用可** マークがある楽曲のみ。一般トレンド音源は個人投稿なら OK だが、ビジネスアカウント転換後は商用音源ライブラリを使う方が安全
- **NG ワード**: 「絶対稼げる」「100%痩せる」など断定 (景表法) / 医療効果暗示 (薬機法)

## 8. アナリティクスループ（投稿後の運用）

投稿後 48時間で:
- **完走率 < 30%** → フックを差し替え（`agents/hook-generator.mjs` 再実行 + キャプ 1行目だけ更新で同動画を再投稿）
- **CTR (プロフリンク) < 1%** → CTA テキスト変更 + 商品差し替え検討
- **保存数 > 100** → 翌週類似テーマを 2-3本投稿（テンプレ流用）

`docs/tiktok-viral-patterns.md` の「自社学習データ」セクションに結果を追記して、エージェントが翌週の選定に反映できるよう蓄積する。
