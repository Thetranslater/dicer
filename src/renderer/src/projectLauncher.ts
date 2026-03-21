import { createApp } from 'vue'
import './assets/main.css'
import ProjectLauncher from './windows/ProjectLauncher.vue'
import { setupMenuListeners } from './utils/fileService'

setupMenuListeners()

createApp(ProjectLauncher).mount('#app')
