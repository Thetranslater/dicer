<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="settings-window">
    <aside class="settings-nav">
      <RouterLink class="nav-item" to="/project">Project</RouterLink>
      <!-- <RouterLink class="nav-item" to="/editor">Editor</RouterLink> -->
      <RouterLink class="nav-item" to="/images">Images Manager</RouterLink>
    </aside>

    <main class="settings-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.settings-window {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-columns: 220px 1fr;
  background: #fff;
  color: #1f2328;
}

.settings-nav {
  border-right: 1px solid #d0d7de;
  background: #f6f8fa;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-item {
  height: 34px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  padding: 0 10px;
  cursor: pointer;
  font-size: 14px;
  line-height: 34px;
  color: #1f2328;
  text-decoration: none;
}

.nav-item:hover {
  background: #eaeef2;
}

.nav-item.router-link-exact-active {
  background: #dbeafe;
  border-color: #bfdbfe;
  color: #0b57d0;
}

.settings-content {
  min-width: 0;
  min-height: 0;
  display: flex;
}
</style>
