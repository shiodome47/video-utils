import {
  buildYouTubeEmbedUrl,
  extractYouTubeId,
  faststart,
  getDomain,
  inspectMp4,
  isDropboxUrl,
  isSafeUrl,
  joinCues,
  normalizeDropboxUrl,
  normalizeDropboxUrlForDownload,
  parseSubtitles,
} from '@shiodome47/video-utils'
import './demo.css'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

/** 表の 1 行（文字は textContent で入れる。貼られた文字を HTML として読まない） */
function row(cells: string[], tag: 'td' | 'th' = 'td'): HTMLTableRowElement {
  const tr = document.createElement('tr')
  cells.forEach((c, i) => {
    const el = document.createElement(i === 0 && tag === 'td' && cells.length === 2 ? 'th' : tag)
    el.textContent = c
    tr.append(el)
  })
  return tr
}

// ─── 1. URL ───

function showUrl() {
  const url = $<HTMLInputElement>('url').value.trim()
  const id = extractYouTubeId(url)
  const out = $<HTMLTableSectionElement>('url-out')
  const rows: [string, string][] = [
    ['安全な URL か（isSafeUrl）', isSafeUrl(url) ? 'はい yes' : 'いいえ no'],
    ['ドメイン（getDomain）', getDomain(url)],
    ['YouTube の動画 ID（extractYouTubeId）', id ?? '—'],
  ]
  if (id) rows.push(['埋め込みの URL（buildYouTubeEmbedUrl）', buildYouTubeEmbedUrl(id)])
  if (isDropboxUrl(url)) {
    rows.push(['再生用（normalizeDropboxUrl）', normalizeDropboxUrl(url)])
    rows.push(['ダウンロード用（normalizeDropboxUrlForDownload）', normalizeDropboxUrlForDownload(url)])
  }
  out.replaceChildren(...rows.map((r) => row(r)))
}
$<HTMLInputElement>('url').addEventListener('input', showUrl)
showUrl()

// ─── 2. 字幕 ───

const SAMPLE = `1
00:00:01,000 --> 00:00:02,500
<i>こんにちは</i>

2
00:00:02,800 --> 00:00:04,000
今日は手話の練習をします

3
00:00:08,000 --> 00:00:10,000
{\\an8}Hello, world`

const fmt = (t: number) => {
  const m = Math.floor(t / 60)
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, '0')}`
}

function showSubs() {
  const cues = joinCues(parseSubtitles($<HTMLTextAreaElement>('subs').value), Number($<HTMLInputElement>('gap').value) || 0)
  $('subs-count').textContent = `${cues.length} 件 cues`
  $('subs-out').replaceChildren(...cues.map((c) => row([fmt(c.start), fmt(c.end), c.text])))
}
$<HTMLTextAreaElement>('subs').value = SAMPLE
$('subs').addEventListener('input', showSubs)
$('gap').addEventListener('input', showSubs)
$<HTMLInputElement>('subs-file').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  $<HTMLTextAreaElement>('subs').value = await file.text()
  showSubs()
})
showSubs()

// ─── 3. mp4 ───

let downloadUrl: string | null = null

$<HTMLInputElement>('mp4').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  const out = $('mp4-out')
  out.replaceChildren()
  if (downloadUrl) URL.revokeObjectURL(downloadUrl)
  downloadUrl = null
  if (!file) return

  const p = (text: string) => {
    const el = document.createElement('p')
    el.textContent = text
    out.append(el)
    return el
  }
  const before = await inspectMp4(file)
  p(`並び boxes: ${before.boxes.map((b) => b.type).join(' → ') || '—'}（${before.complete ? '最後までそろっている complete' : '途中で切れている・mp4 でない incomplete'}）`)

  const fixed = await faststart(file)
  if (!fixed) {
    p('直す必要はありません（目次がすでに前にある・mp4 でない）。No change needed.')
    return
  }
  const after = await inspectMp4(fixed)
  p(`直したあと fixed: ${after.boxes.map((b) => b.type).join(' → ')}`)
  downloadUrl = URL.createObjectURL(fixed)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = file.name.replace(/(\.\w+)?$/, '-faststart$1')
  a.textContent = '直した動画を保存 Download the fixed file'
  a.className = 'button'
  out.append(a)
})
