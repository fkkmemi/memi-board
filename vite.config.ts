import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'memi-board.js',
    },
    rollupOptions: {
      external: [
        'vue',
        'vue-router',
        'vuefire',
        /^firebase\//,
      ],
    },
    sourcemap: true,
  },
})
