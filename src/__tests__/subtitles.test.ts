import { describe, expect, it } from 'vitest'
import { joinCues, parseSubtitles, planSubtitleImport } from '../subtitles'

const srt = `﻿1
00:00:03,000 --> 00:00:06,500
▼ストーリー1
姉　妊娠　来年　三月

2
00:00:35,250 --> 00:00:38,000
<i>毎月</i>　検診　行く

3
00:01:02,000 --> 00:01:04,000
{\\an8}最後
`

describe('字幕ファイルからブックマーク', () => {
  it('SRT を読み、開始時刻と文（複数行のまま・書式は取り除く）にする', () => {
    expect(parseSubtitles(srt)).toEqual([
      { start: 3, end: 6.5, text: '▼ストーリー1\n姉　妊娠　来年　三月' },
      { start: 35.25, end: 38, text: '毎月　検診　行く' },
      { start: 62, end: 64, text: '最後' },
    ])
  })

  it('WebVTT（見出し・NOTE・時:分の省略）も読む', () => {
    const vtt = 'WEBVTT\n\nNOTE メモ\n\n00:05.000 --> 00:07.000 align:start\nこんにちは\n\n01:00:01.500 --> 01:00:03.000\nさようなら\n'
    expect(parseSubtitles(vtt).map((c) => [c.start, c.text])).toEqual([
      [5, 'こんにちは'],
      [3601.5, 'さようなら'],
    ])
  })

  it('空行の無い SRT（番号の行が文の直後に続く）でも、番号を文に混ぜない', () => {
    const tight = '1\n00:00:01,000 --> 00:00:02,000\nあ\n2\n00:00:03,000 --> 00:00:04,000\nい\n'
    expect(parseSubtitles(tight).map((c) => c.text)).toEqual(['あ', 'い'])
  })

  it('細かい字幕は、前の字幕が終わってから n 秒以内ならつなげる', () => {
    const cues = [
      { start: 0, end: 1, text: 'a' },
      { start: 1.5, end: 2, text: 'b' },
      { start: 10, end: 11, text: 'c' },
    ]
    expect(joinCues(cues, 0)).toHaveLength(3)
    expect(joinCues(cues, 1).map((c) => [c.start, c.text])).toEqual([
      [0, 'a\nb'],
      [10, 'c'],
    ])
  })

  it('同じ時刻（±1 秒）にブックマークがあれば足さず、ラベルが空ならそこに文を入れる', () => {
    const cues = [
      { start: 3, end: 4, text: '新しい文' },
      { start: 10, end: 11, text: 'ラベルの無いところへ' },
      { start: 20, end: 21, text: 'もうある' },
    ]
    const plan = planSubtitleImport(cues, [
      { id: 'x', positionSeconds: 10.4, label: '' },
      { id: 'y', positionSeconds: 19.5, label: '手で書いた' },
    ])
    expect(plan.add.map((c) => c.text)).toEqual(['新しい文'])
    expect(plan.fill).toEqual([{ bookmarkId: 'x', label: 'ラベルの無いところへ' }])
    expect(plan.skipped).toBe(1)
  })
})
