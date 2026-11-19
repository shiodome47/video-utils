/**
 * mp4 の目次（moov）を本体（mdat）より前へ移す（iPhone で端末の中の動画を再生できるように）。
 */
import { describe, expect, it } from 'vitest'
import { faststart } from '../faststart'

/** 箱を作る（大きさ 4 バイト・種類 4 文字・中身） */
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const body = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(8 + body)
  new DataView(out.buffer).setUint32(0, out.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  let pos = 8
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}
const u32 = (...ns: number[]) => {
  const b = new Uint8Array(ns.length * 4)
  ns.forEach((n, i) => new DataView(b.buffer).setUint32(i * 4, n))
  return b
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}
const types = (b: Uint8Array) => {
  const out: string[] = []
  let pos = 0
  while (pos < b.length) {
    const size = new DataView(b.buffer, b.byteOffset).getUint32(pos)
    out.push(String.fromCharCode(...b.slice(pos + 4, pos + 8)))
    pos += size
  }
  return out
}

describe('faststart', () => {
  it('目次を本体の前へ移し、映像の位置の表（stco）をその分ずらす（同じ映像を指したまま）', async () => {
    const ftyp = box('ftyp', new TextEncoder().encode('isom0000'))
    const frames = new TextEncoder().encode('AAAABBBBCCCC')
    const mdat = box('mdat', frames)
    const mdatData = ftyp.length + 8 // 映像のはじまり
    // 映像は 3 つ（AAAA・BBBB・CCCC）
    const stco = box('stco', u32(0, 3, mdatData, mdatData + 4, mdatData + 8))
    const moov = box('moov', box('mvhd', u32(0, 0, 0)), box('trak', box('mdia', box('minf', box('stbl', stco)))))
    const file = concat(ftyp, mdat, moov)

    const fixed = await faststart(new Blob([file as BlobPart], { type: 'video/mp4' }))
    expect(fixed).not.toBeNull()
    const out = new Uint8Array(await fixed!.arrayBuffer())
    expect(out.length).toBe(file.length)
    expect(types(out)).toEqual(['ftyp', 'moov', 'mdat'])

    // 新しい表の位置にある映像が、元と同じ（AAAA・BBBB・CCCC）
    const at = (i: number) => {
      const stcoAt = out.indexOf('s'.charCodeAt(0), ftyp.length) // 'stco' を探す
      let p = stcoAt
      while (String.fromCharCode(...out.slice(p, p + 4)) !== 'stco') p++
      const offset = new DataView(out.buffer).getUint32(p + 4 + 8 + i * 4)
      return new TextDecoder().decode(out.slice(offset, offset + 4))
    }
    expect([at(0), at(1), at(2)]).toEqual(['AAAA', 'BBBB', 'CCCC'])
  })

  it('もう目次が前にあるもの・mp4 でないものは、そのまま（null）', async () => {
    const ftyp = box('ftyp', new TextEncoder().encode('isom0000'))
    const moov = box('moov', box('mvhd', u32(0)))
    const mdat = box('mdat', new TextEncoder().encode('AAAA'))
    expect(await faststart(new Blob([concat(ftyp, moov, mdat) as BlobPart]))).toBeNull()
    expect(await faststart(new Blob([new TextEncoder().encode('<html>not a video</html>') as BlobPart]))).toBeNull()
  })
})
