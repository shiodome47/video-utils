/**
 * 動画の URL（YouTube の動画 ID・Dropbox の共有リンク・安全な URL）のテスト。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildYouTubeEmbedUrl,
  extractYouTubeId,
  getDomain,
  isDropboxUrl,
  isSafeUrl,
  isYouTubeUrl,
  normalizeDropboxUrl,
  normalizeDropboxUrlForDownload,
  openExternal,
  safeExternalUrl,
} from '../index'

const ID = 'dQw4w9WgXcQ'

describe('YouTube の動画 ID', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}/`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/v/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
  ])('%s', (url) => {
    expect(extractYouTubeId(url)).toBe(ID)
    expect(isYouTubeUrl(url)).toBe(true)
  })

  it('似た名前のサイト・おかしな ID・URL でないものは通さない', () => {
    expect(extractYouTubeId(`https://evilyoutube.com/watch?v=${ID}`)).toBeNull()
    expect(extractYouTubeId(`https://youtube.com.evil.example/watch?v=${ID}`)).toBeNull()
    expect(extractYouTubeId('https://www.youtube.com/watch?v=abc%3Fx%3D1')).toBeNull()
    expect(extractYouTubeId('https://www.youtube.com/')).toBeNull()
    expect(extractYouTubeId('not a url')).toBeNull()
    expect(isYouTubeUrl('https://example.com/video.mp4')).toBe(false)
  })

  it('埋め込みの URL', () => {
    expect(buildYouTubeEmbedUrl(ID)).toBe(`https://www.youtube.com/embed/${ID}?rel=0&modestbranding=1&enablejsapi=1`)
  })
})

describe('Dropbox の共有リンク', () => {
  const shared = 'https://www.dropbox.com/scl/fi/abc/video.mp4?rlkey=KEY&dl=0'

  it('再生用（raw=1）。rlkey などはそのまま', () => {
    const u = new URL(normalizeDropboxUrl(shared))
    expect(u.searchParams.get('raw')).toBe('1')
    expect(u.searchParams.has('dl')).toBe(false)
    expect(u.searchParams.get('rlkey')).toBe('KEY')
  })

  it('ダウンロード用（dl=1）', () => {
    const u = new URL(normalizeDropboxUrlForDownload(shared))
    expect(u.searchParams.get('dl')).toBe('1')
    expect(u.searchParams.get('rlkey')).toBe('KEY')
  })

  it('Dropbox 以外・似た名前のサイトは、そのまま返す', () => {
    expect(normalizeDropboxUrl('https://example.com/a.mp4?dl=0')).toBe('https://example.com/a.mp4?dl=0')
    expect(normalizeDropboxUrl('https://evildropbox.com/a.mp4?dl=0')).toBe('https://evildropbox.com/a.mp4?dl=0')
    expect(normalizeDropboxUrlForDownload('not a url')).toBe('not a url')
    expect(isDropboxUrl(shared)).toBe(true)
    expect(isDropboxUrl('https://evildropbox.com/a')).toBe(false)
  })
})

describe('安全な URL', () => {
  afterEach(() => vi.restoreAllMocks())

  it('http(s) だけを通す', () => {
    expect(isSafeUrl('https://example.com/')).toBe(true)
    expect(isSafeUrl('http://example.com/')).toBe(true)
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,hi')).toBe(false)
    expect(safeExternalUrl('https://example.com/')).toBe('https://example.com/')
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeExternalUrl(undefined)).toBeUndefined()
  })

  it('危険な URL は開かない。開くときは opener を渡さない', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    expect(openExternal('javascript:alert(1)')).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(openExternal('https://example.com/')).toBe(true)
    expect(open).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer')
  })

  it('表示用のドメイン', () => {
    expect(getDomain('https://www.example.com/a/b')).toBe('www.example.com')
    expect(getDomain('not a url')).toBe('not a url')
  })
})
