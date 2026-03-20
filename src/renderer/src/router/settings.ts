import { createRouter, createWebHashHistory } from 'vue-router'
import ProgramSettings from '../components/settings/ProgramSettings.vue'
import EditorSettings from '../components/settings/EditorSettings.vue'
import ImagesManagerSettings from '../components/settings/ImagesManagerSettings.vue'

const settingsRouter = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/program' },
    { path: '/program', component: ProgramSettings },
    { path: '/editor', component: EditorSettings },
    { path: '/images', component: ImagesManagerSettings }
  ]
})

export default settingsRouter
