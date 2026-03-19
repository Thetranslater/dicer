import './assets/main.css'

import { createApp } from 'vue'
import App from './windows/App.vue'

import {setupMenuListeners} from './utils/fileService'

setupMenuListeners()

createApp(App).mount('#app')
