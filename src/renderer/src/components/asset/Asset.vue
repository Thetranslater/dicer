<script setup lang="ts">
type AssetListItem = {
  name: string
  path: string
  isDirectory: boolean
  relativePath?: string
  isAssetFile?: boolean
}

defineProps<{
  item: AssetListItem
  selected?: boolean
  dropTarget?: boolean
}>()
</script>

<template>
  <div class="asset-card" :class="{ selected, 'drop-target': dropTarget }" :title="item.relativePath || item.path">
    <div class="asset-icon" :class="{ folder: item.isDirectory, asset: !item.isDirectory }">
      <span v-if="item.isDirectory">DIR</span>
      <span v-else>AST</span>
    </div>
    <div class="asset-name">{{ item.name }}</div>
  </div>
</template>

<style scoped>
.asset-card {
  width: 96px;
  height: 92px;
  min-height: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 4px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
}

.asset-card:hover {
  background: transparent;
  border-color: #d0d7de;
}

.asset-card.selected {
  border-color: #0b57d0;
  box-shadow: 0 0 0 2px rgba(11, 87, 208, 0.14);
}

.asset-card.drop-target {
  border-color: #1a7f37;
  box-shadow: 0 0 0 2px rgba(26, 127, 55, 0.18);
}

.asset-icon {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid #d0d7de;
  display: grid;
  place-items: center;
  font-size: 10px;
  color: #57606a;
  user-select: none;
}

.asset-icon.folder {
  background: #fff8c5;
  border-color: #e3b341;
  color: #7d4e00;
}

.asset-icon.asset {
  background: #eaf2ff;
  border-color: #bfdbfe;
  color: #0b57d0;
}

.asset-name {
  width: 100%;
  font-size: 11px;
  line-height: 1.2;
  color: #1f2328;
  text-align: center;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
