# BGM セットアップ（完全無料）

両方の composition (`index.html` / `story-mode/index.html`) は既に BGM トラックの口を開けてある:
```html
<audio id="aud-bgm" class="clip" data-start="0" data-duration="30" data-track-index="4" src="assets/audio/bgm.mp3" data-volume="0.18"></audio>
```
ここに `assets/audio/bgm.mp3` を置けば、動画レンダ時に自動でミックスされる（音量 18% で背景）。

## おすすめソース（商用 OK・クレジット不要）

| サイト | 特徴 | URL |
|---|---|---|
| **DOVA-SYNDROME** | 18,000曲超、ジャンル豊富、登録不要 | https://dova-s.jp/ |
| **Pixabay Music** | 高品質、英語サイト、登録不要 | https://pixabay.com/music/ |
| **MusMus** | TikTok/YouTube 想定、シンプル | https://musmus.main.jp/ |
| **甘茶の音楽工房** | 落ち着いた系、ピアノ多め | https://amachamusic.chagasi.com/ |

## 推奨ジャンル別キーワード

ランキング型動画 (`index.html`) → **テンション高め・エレクトロニカ**
- DOVA-SYNDROME 検索: 「エレクトロニカ」「ヒップホップ」「テクノ」
- Pixabay: `electronic`, `trap`, `hip-hop`, `corporate-tech`

ストーリー型動画 (`story-mode/index.html`) → **静か→盛り上がり・lo-fi**
- DOVA-SYNDROME: 「ヒーリング」「lo-fi」「ピアノ」
- Pixabay: `lofi`, `chillhop`, `ambient`, `inspirational`

## ダウンロード〜設定の手順

1. 上記サイトで 30秒以上の楽曲を 1つダウンロード（MP3 形式）
2. ファイル名を `bgm.mp3` にリネーム
3. `assets/audio/` フォルダに配置
4. `bash scripts/new-video.sh` を再実行 → BGM 入りで再レンダ

## ボリューム調整

ナレが聞こえにくい場合: `data-volume` を `0.18` から `0.10〜0.15` に下げる
背景が薄い場合: `0.18` から `0.25〜0.30` に上げる

## ストーリー型は別 BGM を当てる場合

```
assets/audio/bgm.mp3            ← ランキング型用（テンション高め）
assets/audio/bgm-story.mp3      ← ストーリー型用（静か）
```
として、`story-mode/index.html` の audio タグの src を `assets/audio/bgm-story.mp3` に書き換え。

## 規約・著作権の注意

- **DOVA-SYNDROME / Pixabay / MusMus** は商用利用・クレジット不要だが、サイトごとの最終確認は必須
- **TikTok の商用利用音源ライブラリ** から選ぶのが最も安全（ただし TikTok 限定）
- **JASRAC 登録曲・市販 CD・ストリーミング音源** は絶対 NG（著作権侵害）
- 動画レンダリング時に BGM を焼き込むので、TikTok 上で **「商用音源を使用」モード** を選ぶこと（TikTok のクリエイター音源で上書きしないなら問題なし）

## TikTok のトレンド音源を使う場合

レンダ時は **BGM なし** で動画を作って、TikTok 投稿時にプラットフォーム内のトレンド音源を後乗せ:
- `index.html` の `aud-bgm` の `data-volume` を `0` にしてレンダ
- または `aud-bgm` の行を削除
- TikTok での編集画面で「楽曲を追加」→ おすすめから選択

トレンド音源は再生回数が伸びやすい（アルゴリズム）ので、**BGM 焼き込みなし**で TikTok のトレンドに乗せるのが定石。
ストーリー型は雰囲気重視なので焼き込み BGM 推奨、ランキング型はトレンド音源優先、という使い分けが現実的。
