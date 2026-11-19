/**
 * mp4 のいちばん外側の箱（ftyp・moov・mdat など）を並べる（調べる用）。
 * 箱の大きさの合計がファイルの大きさと合わなければ、途中で切れている。
 */
export async function inspectMp4(blob: Blob): Promise<{ boxes: { type: string; size: number }[]; complete: boolean }> {
  const boxes: { type: string; size: number }[] = []
  let pos = 0
  while (pos + 8 <= blob.size && boxes.length < 50) {
    const head = new DataView(await blob.slice(pos, pos + 16).arrayBuffer())
    let size = head.getUint32(0)
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7))
    if (size === 1 && head.byteLength >= 16) size = Number(head.getBigUint64(8))
    else if (size === 0) size = blob.size - pos
    if (size < 8 || !/^[\x20-\x7e]{4}$/.test(type)) break
    boxes.push({ type, size })
    pos += size
  }
  return { boxes, complete: pos === blob.size }
}
