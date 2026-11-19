/**
 * 動画の URL を見分ける・直す（YouTube の動画 ID・Dropbox の共有リンク・安全な URL）。計算だけ。
 */

/** host が domain そのものか、その下（www. m. など）か。evilyoutube.com などは通さない */
function within(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

/**
 * http(s) の URL か（安全に開けるか）。
 * javascript: などの危険な URL は false。
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * リンクや window.open に渡してよい URL だけを返す（それ以外は undefined）。
 * 入力画面で検査していても、ファイルの読み込みや同期で入ってきたデータは検査を通っていないため、
 * 開く直前にも必ずこれを通す。
 */
export function safeExternalUrl(url: string | undefined | null): string | undefined {
  return typeof url === 'string' && isSafeUrl(url) ? url : undefined
}

/** 安全な URL のときだけ新しいタブで開く（opener を渡さない） */
export function openExternal(url: string | undefined | null): boolean {
  const safe = safeExternalUrl(url)
  if (!safe) return false
  window.open(safe, '_blank', 'noopener,noreferrer')
  return true
}

/** YouTube の動画の URL か（動画 ID を取り出せるか） */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}

/**
 * YouTube URL から動画 ID を抽出する。
 * 対応形式:
 *   https://www.youtube.com/watch?v=VIDEO_ID（m. music. なども）
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID・/shorts/VIDEO_ID・/live/VIDEO_ID・/v/VIDEO_ID
 *   https://www.youtube-nocookie.com/embed/VIDEO_ID
 * 最後の「/」や、後ろに付いた ?si=… などはあってもよい
 */
export function extractYouTubeId(url: string): string | null {
  // 動画 ID は英数字・-・_ だけ（それ以外が混ざったものは、埋め込みに使わない）
  const valid = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null)
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const parts = parsed.pathname.split('/').filter(Boolean)
    // youtube.com とその下（www. m. music. など）だけ。evilyoutube.com などは YouTube とみなさない
    if (within(host, 'youtube.com') || within(host, 'youtube-nocookie.com')) {
      // /embed/ID・/shorts/ID・/live/ID・/v/ID
      if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) return valid(parts[1])
      // ?v=VIDEO_ID
      return valid(parsed.searchParams.get('v'))
    }
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      return valid(parts[0])
    }
    return null
  } catch {
    return null
  }
}

/** YouTube の動画 ID から、埋め込み（iframe）の URL を作る */
export function buildYouTubeEmbedUrl(videoId: string): string {
  // enablejsapi=1: postMessage で再生状態（終了など）を受け取るために必要
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`
}

/** Dropbox の URL か（dropbox.com とその下だけ。evildropbox.com などは違う） */
export function isDropboxUrl(url: string): boolean {
  try {
    return within(new URL(url).hostname.toLowerCase(), 'dropbox.com')
  } catch {
    return false
  }
}

/**
 * Dropbox の共有リンクを、ファイルを取りに行く（ダウンロードする）形にする。
 * - `dl` を消してから `dl=1` を付ける
 * - `rlkey`・`st` など、ほかの部分はそのまま
 * - Dropbox 以外の URL はそのまま返す
 */
export function normalizeDropboxUrlForDownload(url: string): string {
  try {
    const parsed = new URL(url)
    if (!within(parsed.hostname.toLowerCase(), 'dropbox.com')) return url
    parsed.searchParams.delete('dl')
    parsed.searchParams.set('dl', '1')
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Dropbox の共有リンクを、動画として再生できる形（`<video src>` に入れられる形）にする。
 * - `dl` を消して `raw=1` を付ける（すでにあっても同じ）
 * - `rlkey`・`st` など、ほかの部分はそのまま
 * - Dropbox 以外の URL はそのまま返す
 */
export function normalizeDropboxUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!within(parsed.hostname.toLowerCase(), 'dropbox.com')) return url
    parsed.searchParams.delete('dl')
    parsed.searchParams.set('raw', '1')
    return parsed.toString()
  } catch {
    return url
  }
}

/** URL のドメイン（表示用。URL でなければそのまま返す） */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
