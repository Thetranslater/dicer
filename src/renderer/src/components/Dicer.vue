<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '../composables/useEditorStore'
import { Expression } from '../utils/expression'

const { getEditor } = useEditorStore()

// 下拉选项
const diceOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

// 当前输入的值
const inputValue = ref<string>('10')

// 下拉框是否显示
const showDropdown = ref(false)

// 当前选中的值（用于显示）
// const selectedValue = computed(() => {
//   const num = parseInt(inputValue.value, 10)
//   if (diceOptions.includes(num)) {
//     return num
//   }
//   return inputValue.value
// })

// 处理下拉选择
function handleSelect(value: number) {
  inputValue.value = value.toString()
  showDropdown.value = false
}

// 处理焦点事件 - 显示下拉
function handleFocus() {
  showDropdown.value = true
}

// 处理失焦事件 - 延迟隐藏以允许点击下拉项
function handleBlur() {
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

// 投掷骰子
function rollDice() {
  const editor = getEditor()
  if (!editor) return

  const expression = inputValue.value.trim()

  // 如果为空，使用默认值 1d10
  let diceExpression = expression || '1d10'

  // 检查是否是纯数字（从下拉框选择的）
  if (/^\d+$/.test(diceExpression)) {
    // 纯数字：转换为 1dX 格式
    diceExpression = `1d${diceExpression}`
  }

  // 统一使用 Expression 类解析并评估表达式
  let result: number
  try {
    const expr = new Expression(diceExpression)
    result = expr.evaluate()
  } catch (e) {
    // 如果解析失败，使用默认值 0
    result = 0
  }

  // 插入带有实际结果的文本到编辑器
  const text = `${expression}=${result}`
  editor.chain().focus().insertContent(text).run()
}
</script>

<template>
  <div class="dicer-wrapper">
    <!-- 骰子按钮 -->
    <button @mouseup="rollDice" title="投掷骰子">
      <span class="dice-icon">&#127922;</span>
    </button>

    <!-- 可输入下拉选择框 -->
    <div class="dicer-select-wrapper">
      <input type="text" class="dicer-input" v-model="inputValue" @focus="handleFocus" @blur="handleBlur"
        placeholder="10" />

      <!-- 下拉选项 -->
      <div class="dicer-dropdown" v-show="showDropdown">
        <div v-for="option in diceOptions" :key="option" class="dicer-option" @mousedown.prevent="handleSelect(option)">
          {{ option }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dicer-wrapper {
  display: flex;
  align-items: center;
  gap: 0;

  >button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border: 1px solid #ccc;
    background: #fff;
    border-right: none;
    border-radius: 3px 0 0 3px;
    cursor: pointer;
    padding: 0;
  }

  .dicer-select-wrapper {
    position: relative;

    .dicer-input {
      width: 50px;
      height: 28px;
      border: 1px solid #ccc;
      border-left: none;
      border-radius: 0 3px 3px 0;
      padding: 0 8px;
      font-size: 13px;
      outline: none;

      &:focus {
        border-color: #4a90d9;
      }
    }

    .dicer-dropdown {
      position: absolute;
      top: 100%;
      left: -1px;
      right: -1px;
      max-height: 200px;
      overflow-y: auto;
      background: #fff;
      border: 1px solid #ccc;
      border-top: none;
      border-radius: 0 0 3px 3px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      z-index: 100;

      .dicer-option {
        padding: 6px 10px;
        cursor: pointer;
        font-size: 13px;
      }
    }
  }
}

.dice-icon {
  font-size: 16px;
}

.dicer-wrapper>button:hover {
  background: #e8e8e8;
}

.dicer-option:hover {
  background: #f0f0f0;
}
</style>
