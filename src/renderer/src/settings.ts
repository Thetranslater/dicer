import { createApp } from 'vue'
import './assets/main.css'
import { setupMenuListeners } from './utils/fileService'
import SettingsWindow from './windows/SettingsWindow.vue'
import settingsRouter from './router/settings'

setupMenuListeners()

createApp(SettingsWindow).use(settingsRouter).mount('#app')
