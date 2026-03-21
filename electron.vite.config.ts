import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          images: resolve(__dirname, 'src/renderer/images.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html'),
          projectLauncher: resolve(__dirname, 'src/renderer/project-launcher.html')
        }
      }
    }
  }
})
