<script setup lang="ts">
import Editor from '../components/Editor.vue'
</script>

<template>
  <div class="app-container">
    <Editor />
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
