import './assets/main.css'

import { createApp } from 'vue'
import App from './windows/App.vue'

import {setupMenuListeners} from '../../includes/fileService'

setupMenuListeners()

createApp(App).mount('#app')
