/**
 * mp4 の目次（moov）を、本体（mdat）より前へ移す（いわゆる faststart）。
 *
 * Dropbox などの動画は、目次がファイルのいちばん後ろにあることが多い。
 * iPhone の Safari は、端末の中の動画（blob）を再生するとき、目次が後ろにあると、
 * 長さは読めても再生が 0 秒から進まないことがある。目次を前へ移せば再生できる。
 *
 * 目次を前へ移すと本体の位置が目次の大きさだけ後ろへずれるので、目次の中の
 * 「本体のどこに映像があるか」（stco・co64）を、その分だけずらす。映像そのものは変えない。
 */

interface Box {
  type: string
  start: number
  size: number
}

/** いちばん外側の箱を並べる（ファイルの中身は読まず、箱の頭だけ読む） */
async function topBoxes(blob: Blob): Promise<Box[] | null> {
  const boxes: Box[] = []
  let pos = 0
  while (pos + 8 <= blob.size) {
    const head = new DataView(await blob.slice(pos, pos + 16).arrayBuffer())
    let size = head.getUint32(0)
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7))
    if (size === 1 && head.byteLength >= 16) size = Number(head.getBigUint64(8))
    else if (size === 0) size = blob.size - pos
    if (size < 8 || pos + size > blob.size) return null
    boxes.push({ type, start: pos, size })
    pos += size
  }
  return pos === blob.size ? boxes : null
}

/** 中に箱が入っている箱（stco・co64 までたどるもの） */
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex', 'udta'])

/** 目次の中の位置の表（stco・co64）を delta だけずらす。ずらせなければ false */
function shiftChunkOffsets(moov: Uint8Array, delta: number): boolean {
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength)
  const walk = (from: number, to: number): boolean => {
    let pos = from
    while (pos + 8 <= to) {
      let size = view.getUint32(pos)
      const type = String.fromCharCode(moov[pos + 4], moov[pos + 5], moov[pos + 6], moov[pos + 7])
      let header = 8
      if (size === 1) {
        size = Number(view.getBigUint64(pos + 8))
        header = 16
      } else if (size === 0) size = to - pos
      if (size < header || pos + size > to) return false
      if (type === 'stco' || type === 'co64') {
        const count = view.getUint32(pos + header + 4)
        const first = pos + header + 8
        const width = type === 'stco' ? 4 : 8
        if (first + count * width > pos + size) return false
        for (let i = 0; i < count; i++) {
          const at = first + i * width
          if (type === 'stco') {
            const next = view.getUint32(at) + delta
            if (next > 0xffffffff) return false
            view.setUint32(at, next)
          } else {
            view.setBigUint64(at, view.getBigUint64(at) + BigInt(delta))
          }
        }
      } else if (CONTAINERS.has(type) && !walk(pos + header, pos + size)) {
        return false
      }
      pos += size
    }
    return true
  }
  return walk(8, moov.byteLength)
}

/**
 * 目次が本体より後ろにあれば、前へ移した新しい動画を返す（直す必要がなければ null）。
 * 本体は元の動画を切り出して使うので、大きな動画でもメモリをあまり使わない。
 */
export async function faststart(blob: Blob): Promise<Blob | null> {
  const boxes = await topBoxes(blob)
  if (!boxes) return null
  const moovIndex = boxes.findIndex((b) => b.type === 'moov')
  const mdatIndex = boxes.findIndex((b) => b.type === 'mdat')
  if (moovIndex < 0 || mdatIndex < 0 || moovIndex < mdatIndex) return null
  const moovBox = boxes[moovIndex]
  const moov = new Uint8Array(await blob.slice(moovBox.start, moovBox.start + moovBox.size).arrayBuffer())
  if (!shiftChunkOffsets(moov, moovBox.size)) return null
  const mdatStart = boxes[mdatIndex].start
  return new Blob(
    [blob.slice(0, mdatStart), moov, blob.slice(mdatStart, moovBox.start), blob.slice(moovBox.start + moovBox.size)] as BlobPart[],
    { type: blob.type || 'video/mp4' },
  )
}
