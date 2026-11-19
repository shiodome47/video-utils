/**
 * 字幕ファイル（SRT・WebVTT）を、開始時刻・終了時刻・文の一覧にする。計算だけ。
 * 文字起こしのサービス（Notta など）で書き出した .srt・.vtt を読んで、動画の印（ブックマークなど）を作るのに使える。
 */

export interface Cue {
  /** 開始時刻（秒） */
  start: number
  /** 終了時刻（秒）。無ければ開始と同じ */
  end: number
  text: string
}

/** 「00:01:02,345」「01:02.345」「1:02」などを秒に */
function parseStamp(s: string): number | null {
  // 時は 3 けたまで（とても大きな数は Infinity になり、そのまま保存すると同期・バックアップが読めなくなるため）
  const m = s.trim().match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/)
  if (!m) return null
  const [, h, mm, ss, ms] = m
  const t = Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss) + (ms ? Number(ms.padEnd(3, '0')) / 1000 : 0)
  return Number.isFinite(t) ? t : null
}

/** 字幕の文から書式（<i>、{\\an8}、♪ の前後の空白など）を取り除く。改行は残す */
function cleanText(lines: string[]): string {
  return lines
    .map((l) =>
      l
        .replace(/<[^>]+>/g, '')
        .replace(/\{\\[^}]*\}/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
}

/**
 * SRT・WebVTT の中身を読む（どちらか自動で見分ける）。
 * 時刻の行（「開始 --> 終了」）を手がかりに、その下の文を集める。番号の行・WEBVTT の見出し・NOTE は飛ばす。
 */
export function parseSubtitles(content: string): Cue[] {
  const lines = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  const cues: Cue[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/)
    if (!m) continue
    const start = parseStamp(m[1])
    const end = parseStamp(m[2])
    if (start == null) continue
    const body: string[] = []
    let j = i + 1
    for (; j < lines.length && lines[j].trim() !== ''; j++) {
      if (/-->/.test(lines[j])) break
      body.push(lines[j])
    }
    // 次の字幕の番号行が空行なしで続く SRT にも対応（数字だけの行で、その次が時刻なら区切り）
    if (body.length > 1 && /^\d+$/.test(body[body.length - 1].trim()) && /-->/.test(lines[j] ?? '')) body.pop()
    const text = cleanText(body)
    if (text) cues.push({ start, end: end ?? start, text })
    i = j - 1
  }
  return cues.sort((a, b) => a.start - b.start)
}

/**
 * 前の字幕が終わってから gapSec 秒以内に始まる字幕を、1 つにつなげる（細かすぎる字幕をまとめる）。
 * 0 ならつなげない。つなげた文は改行で区切る。
 */
export function joinCues(cues: Cue[], gapSec: number): Cue[] {
  if (gapSec <= 0) return cues
  const out: Cue[] = []
  for (const c of cues) {
    const last = out[out.length - 1]
    if (last && c.start - last.end <= gapSec) {
      last.text = `${last.text}\n${c.text}`
      last.end = Math.max(last.end, c.end)
    } else {
      out.push({ ...c })
    }
  }
  return out
}

/** 同じ時刻とみなす幅（秒） */
export const SAME_TIME_SEC = 1

export interface SubtitlePlan {
  /** 新しく足す（近くに印が無い字幕） */
  add: Cue[]
  /** 同じ時刻にラベルの無いブックマークがあるので、文を入れる */
  fill: { bookmarkId: string; label: string }[]
  /** 同じ時刻にラベルのあるブックマークがあるので、足さない */
  skipped: number
}

/**
 * 字幕を、今ある印（ブックマークなど。位置は秒）と突き合わせて、足すもの・文を入れるものを決める。
 * 前後 SAME_TIME_SEC 秒以内の印は同じ時刻とみなす。印のほうは書き換えず、決めた結果だけを返す（保存は使う側）。
 */
export function planSubtitleImport(
  cues: Cue[],
  existing: { id: string; positionSeconds: number; label: string }[],
): SubtitlePlan {
  const plan: SubtitlePlan = { add: [], fill: [], skipped: 0 }
  const used = new Set<string>()
  for (const c of cues) {
    const near = existing.find((b) => !used.has(b.id) && Math.abs(b.positionSeconds - c.start) <= SAME_TIME_SEC)
    if (!near) {
      plan.add.push(c)
      continue
    }
    used.add(near.id)
    if (near.label.trim()) plan.skipped++
    else plan.fill.push({ bookmarkId: near.id, label: c.text })
  }
  return plan
}
