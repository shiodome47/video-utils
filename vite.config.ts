import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// 部品のビルド（Vite のライブラリモード）。dist/index.js を作る。型（dist/*.d.ts）は tsc（tsconfig.build.json）が作る
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020',
    minify: false,
  },
})
