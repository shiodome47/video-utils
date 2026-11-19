/**
 * @shiodome47/video-utils — 動画まわりの小さな道具（計算だけ。画面は無い・React も要らない）。
 *
 * - URL: YouTube の動画 ID を取る・Dropbox の共有リンクを再生用にする・安全な URL か
 * - mp4: 目次（moov）を前へ移す（iPhone の Safari で、保存した動画が 0 秒から進まない問題の対策）
 * - 字幕: SRT・WebVTT を読む・近い字幕をまとめる・今ある印と突き合わせる
 */
export * from './url'
export * from './faststart'
export * from './inspect'
export * from './subtitles'
