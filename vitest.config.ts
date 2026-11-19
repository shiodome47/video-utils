import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // window.open・Blob を使うので、ブラウザのまねをする jsdom で動かす
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
