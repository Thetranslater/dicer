import { createApp } from 'vue'
import './assets/main.css'
import SettingsWindow from './windows/SettingsWindow.vue'
import settingsRouter from './router/settings'

createApp(SettingsWindow).use(settingsRouter).mount('#app')
