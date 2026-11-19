/**
 * mp4 の部品の並びを調べる（inspectMp4）のテスト。
 */
import { describe, expect, it } from 'vitest'
import { inspectMp4 } from '../index'

function box(type: string, bodySize: number): Uint8Array {
  const out = new Uint8Array(8 + bodySize)
  new DataView(out.buffer).setUint32(0, out.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  return out
}

describe('inspectMp4', () => {
  it('いちばん外側の部品を並べ、最後までそろっているかを返す', async () => {
    const blob = new Blob([box('ftyp', 8), box('moov', 16), box('mdat', 32)] as BlobPart[])
    expect(await inspectMp4(blob)).toEqual({
      boxes: [
        { type: 'ftyp', size: 16 },
        { type: 'moov', size: 24 },
        { type: 'mdat', size: 40 },
      ],
      complete: true,
    })
  })

  it('途中で切れているときは complete が false', async () => {
    const full = new Uint8Array(await new Blob([box('ftyp', 8), box('mdat', 32)] as BlobPart[]).arrayBuffer())
    const cut = new Blob([full.slice(0, 30)] as BlobPart[])
    expect((await inspectMp4(cut)).complete).toBe(false)
  })
})
