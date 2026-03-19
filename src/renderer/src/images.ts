import { createApp } from 'vue'
import ImagesWindow from './windows/ImagesManager.vue'
import './assets/main.css'
import {setupMenuListeners} from './utils/fileService'

setupMenuListeners()

createApp(ImagesWindow).mount('#app')
