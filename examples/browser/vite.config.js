import { defineConfig } from 'vite'

// GitHub Pages のプロジェクトサイトは https://<user>.github.io/text-to-step/
// で配信されるため、本番ビルドのみ base を合わせる（開発サーバーはルート運用のまま）。
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/text-to-step/' : '/',
  build: {
    outDir: '../../gh-pages-dist',
    emptyOutDir: true,
  },
}))
