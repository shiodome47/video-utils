# @shiodome47/video-utils

動画まわりの小さな道具を集めたものです。**計算だけ**（画面は無い）で、**ほかに要るものはありません**（React も要りません）。

- **URL**: YouTube の動画 ID を取る・Dropbox の共有リンクを再生用にする・安全な URL か
- **mp4**: 目次（`moov`）を前へ移す（**iPhone の Safari で、保存した動画が 0 秒から進まない**問題の対策）
- **字幕**: SRT・WebVTT を読む・近い字幕をまとめる・今ある印と突き合わせる

- 見本: （Vercel に置いたら、ここに URL を書きます）
- English: [see below](#english)

## 入れ方

```bash
npm install @shiodome47/video-utils
```

ブラウザで動きます（`Blob`・`URL` を使います）。Node.js 18 から上でも、`openExternal` 以外は動きます。

## 1. 動画の URL

```ts
import { extractYouTubeId, normalizeDropboxUrl, safeExternalUrl } from '@shiodome47/video-utils'

extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc') // 'dQw4w9WgXcQ'
normalizeDropboxUrl('https://www.dropbox.com/scl/fi/…/a.mp4?rlkey=…&dl=0') // …?rlkey=…&raw=1（<video> で再生できる）
safeExternalUrl('javascript:alert(1)') // undefined（開かない）
```

| 関数 | すること |
|---|---|
| `extractYouTubeId(url)` | YouTube の URL から動画の ID を取り出す。取れなければ `null` |
| `isYouTubeUrl(url)` | YouTube の動画の URL か |
| `buildYouTubeEmbedUrl(id)` | 埋め込み（iframe）の URL を作る |
| `isDropboxUrl(url)` | Dropbox の URL か |
| `normalizeDropboxUrl(url)` | Dropbox の共有リンクを、**再生できる形**（`raw=1`）にする。Dropbox 以外はそのまま |
| `normalizeDropboxUrlForDownload(url)` | Dropbox の共有リンクを、**ダウンロードする形**（`dl=1`）にする |
| `isSafeUrl(url)` | http(s) の URL か（`javascript:` などは `false`） |
| `safeExternalUrl(url)` | 安全な URL だけを返す（ほかは `undefined`）。リンクの `href` に入れる前に通す |
| `openExternal(url)` | 安全な URL のときだけ、新しいタブで開く（`noopener`）。開いたら `true` |
| `getDomain(url)` | 表示用のドメイン |

`extractYouTubeId` が読める形: `watch?v=`・`youtu.be/`・`/embed/`・`/shorts/`・`/live/`・`/v/`・`youtube-nocookie.com`・`m.`・`music.`・最後の `/`・後ろの `?si=…`。

### 気をつけること

- **似た名前のサイトは通しません**（`evilyoutube.com`・`evildropbox.com` など）。ドメインそのものか、その下（`www.`・`m.` など）だけを見ます
- 動画 ID は英数字・`-`・`_` だけを通します（ほかの文字が混ざったものは、埋め込みに使わない）
- ファイルの読み込みや同期で入ってきた URL は、入力のときの検査を通っていません。**開く直前にも** `safeExternalUrl`・`openExternal` を通してください

## 2. mp4 の目次（faststart）

```ts
import { faststart, inspectMp4 } from '@shiodome47/video-utils'

const fixed = await faststart(blob) // 直したら新しい Blob、直さなくてよければ null
const video = fixed ?? blob

const { boxes, complete } = await inspectMp4(blob)
// boxes: [{ type: 'ftyp', size }, { type: 'mdat', size }, { type: 'moov', size }]、complete: 最後までそろっているか
```

### なぜ要るか

mp4 の中は「部品（箱）」が並んでいて、目次（`moov`）と本体（`mdat`）があります。
Dropbox などに置いた動画は、**目次がいちばん後ろ**にあることが多いです。

**iPhone の Safari** は、端末に保存した動画（Blob）を再生するとき、目次が後ろにあると、
長さは読めても**再生が 0 秒から進まない**ことがあります。目次を前へ移すと再生できます。

- 映像そのものは変えません。目次の中の「本体のどこに映像があるか」の表（`stco`・`co64`）を、目次の大きさだけずらします
- 本体は元の Blob を切り出して使うので、大きな動画でもメモリをあまり使いません
- すでに目次が前にあるもの・mp4 でないもの・途中で切れているものは `null`（そのまま使う）
- `inspectMp4` は調べる用です。`complete: false` なら、ダウンロードが途中で切れています

## 3. 字幕（SRT・WebVTT）

```ts
import { joinCues, parseSubtitles, planSubtitleImport } from '@shiodome47/video-utils'

const cues = parseSubtitles(text) // [{ start, end, text }]（秒）。SRT か WebVTT かは自動で見分ける
const joined = joinCues(cues, 1.0) // 前の字幕が終わって 1 秒以内に始まる字幕を、1 つにまとめる

// 今ある印（ブックマークなど）と突き合わせる。前後 1 秒（SAME_TIME_SEC）は同じ時刻とみなす
const plan = planSubtitleImport(cues, [{ id: 'b1', positionSeconds: 12.3, label: '' }])
// plan.add: 新しく足す字幕 / plan.fill: 文の無い印に文を入れる / plan.skipped: 文のある印があったので足さない数
```

- 文の書式（`<i>`・`{\an8}`・`&amp;` など）は取り除きます。改行は残します
- 番号の行・`WEBVTT` の見出し・`NOTE` は飛ばします。空行の無い SRT も読めます
- **時刻のけたがとても多いもの**（`Infinity` になるもの）は読みません（そのまま保存すると、同期・バックアップが壊れるため）
- `planSubtitleImport` は決めるだけで、何も書き換えません。保存は使う側で行います

## 開発

```bash
npm install
npm test            # テスト（vitest）
npm run typecheck   # 型の確かめ
npm run build       # dist/ を作る（Vite のライブラリモード）
npm run dev         # 見本のページ（examples/web）
```

公開の手順は [`PUBLISHING.md`](PUBLISHING.md)。

## ライセンス

MIT

---

## English

Small, dependency-free helpers for video apps (no UI, no React).

```bash
npm install @shiodome47/video-utils
```

**URLs**

- `extractYouTubeId(url)` / `isYouTubeUrl(url)` / `buildYouTubeEmbedUrl(id)`: YouTube video IDs from `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`, `/v/`, `youtube-nocookie.com`, etc. Look-alike hosts such as `evilyoutube.com` are rejected; IDs must be `[A-Za-z0-9_-]`.
- `normalizeDropboxUrl(url)`: turns a Dropbox share link into a playable one (`raw=1`). `normalizeDropboxUrlForDownload(url)` uses `dl=1`. `isDropboxUrl(url)`.
- `isSafeUrl(url)` / `safeExternalUrl(url)` / `openExternal(url)`: allow only http(s) (blocks `javascript:` and friends); opens with `noopener,noreferrer`. Check again right before opening URLs that came from imports or sync.
- `getDomain(url)`.

**mp4 faststart**

- `faststart(blob)`: moves the `moov` box in front of `mdat` and shifts the chunk offsets (`stco` / `co64`). Returns a new `Blob`, or `null` when nothing needs fixing. The media data is sliced from the original blob, so memory use stays low.
- Why: **Safari on iPhone** may not play a locally stored video (Blob) past 0:00 when `moov` is at the end — common for files hosted on Dropbox.
- `inspectMp4(blob)`: lists top-level boxes and tells whether the file is complete.

**Subtitles**

- `parseSubtitles(text)`: SRT or WebVTT (auto-detected) → `[{ start, end, text }]` in seconds. Strips `<i>`, `{\an8}`, entities. Rejects absurd timestamps that would become `Infinity`.
- `joinCues(cues, gapSec)`: merges cues that start within `gapSec` seconds of the previous one.
- `planSubtitleImport(cues, marks)`: compares cues with existing marks (bookmarks, `positionSeconds`) within ±1 s (`SAME_TIME_SEC`) and returns what to add / fill / skip. It changes nothing itself.

MIT License.
