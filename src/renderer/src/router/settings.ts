import { createRouter, createWebHashHistory } from 'vue-router'
import ProjectSettings from '../components/settings/ProjectSettings.vue'
import EditorSettings from '../components/settings/EditorSettings.vue'
import ImagesManagerSettings from '../components/settings/ImagesManagerSettings.vue'

const settingsRouter = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/project' },
    { path: '/project', component: ProjectSettings },
    { path: '/editor', component: EditorSettings },
    { path: '/images', component: ImagesManagerSettings }
  ]
})

export default settingsRouter
