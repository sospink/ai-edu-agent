# Vue 待办应用 - 知识手册

## 📚 项目概述

### 学习目标

- 理解 Vue 3 的基本概念
- 掌握组件、响应式数据、事件处理
- 学会使用 v-model、v-for、v-if 指令
- 构建一个简单的待办事项应用

### 适用人群

- 前端开发初学者
- 想要学习 Vue 的开发者
- 有 HTML/CSS/JS 基础的学习者

---

## 🎯 核心概念

### 什么是 Vue？

**Vue** 是一个渐进式 JavaScript 框架，用于构建用户界面。

**Vue 的特点**：
- **响应式** - 数据变化自动更新视图
- **组件化** - 可复用的 UI 组件
- **简洁** - 易学易用的 API

### Vue 3 新特性

- **Composition API** - 更灵活的代码组织
- **更好的 TypeScript 支持**
- **更小的包体积**
- **更快的渲染性能**

---

## 🏗️ 基础语法

### 1. 创建 Vue 应用

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body>
  <div id="app">
    {{ message }}
  </div>

  <script>
    const { createApp } = Vue
    
    createApp({
      data() {
        return {
          message: 'Hello Vue!'
        }
      }
    }).mount('#app')
  </script>
</body>
</html>
```

### 2. 响应式数据

```javascript
createApp({
  data() {
    return {
      count: 0,
      name: 'Vue',
      items: ['A', 'B', 'C']
    }
  },
  methods: {
    increment() {
      this.count++
    }
  }
}).mount('#app')
```

### 3. 模板语法

**文本插值**：
```html
<p>{{ message }}</p>
```

**属性绑定**：
```html
<a :href="url">链接</a>
<button :disabled="isDisabled">按钮</button>
```

**事件绑定**：
```html
<button @click="handleClick">点击</button>
<input @input="handleInput">
```

### 4. 常用指令

**v-model（双向绑定）**：
```html
<input v-model="text">
<p>输入内容: {{ text }}</p>
```

**v-for（列表渲染）**：
```html
<ul>
  <li v-for="item in items" :key="item.id">
    {{ item.name }}
  </li>
</ul>
```

**v-if / v-else（条件渲染）**：
```html
<p v-if="show">显示</p>
<p v-else>隐藏</p>
```

**v-show（显示/隐藏）**：
```html
<p v-show="visible">内容</p>
```

---

## 💡 实用技巧

### 1. 计算属性

```javascript
createApp({
  data() {
    return {
      items: [
        { name: 'A', done: true },
        { name: 'B', done: false },
        { name: 'C', done: true }
      ]
    }
  },
  computed: {
    // 自动计算，有缓存
    doneCount() {
      return this.items.filter(item => item.done).length
    },
    undoneCount() {
      return this.items.filter(item => !item.done).length
    }
  }
}).mount('#app')
```

### 2. 侦听器

```javascript
createApp({
  data() {
    return {
      searchText: ''
    }
  },
  watch: {
    // 监听数据变化
    searchText(newVal, oldVal) {
      console.log(`搜索词从 ${oldVal} 变为 ${newVal}`)
      this.doSearch(newVal)
    }
  }
}).mount('#app')
```

### 3. 样式绑定

```html
<!-- 对象语法 -->
<div :class="{ active: isActive, error: hasError }"></div>

<!-- 数组语法 -->
<div :class="[baseClass, activeClass]"></div>

<!-- 内联样式 -->
<div :style="{ color: textColor, fontSize: size + 'px' }"></div>
```

---

## ⚠️ 常见错误

### 错误 1：忘记 key

```html
<!-- ❌ 错误 - 缺少 key -->
<li v-for="item in items">{{ item }}</li>

<!-- ✅ 正确 -->
<li v-for="item in items" :key="item.id">{{ item }}</li>
```

### 错误 2：直接修改数组索引

```javascript
// ❌ 不会触发更新
this.items[0] = newValue

// ✅ 正确方式
this.items.splice(0, 1, newValue)
// 或
this.items = [...this.items]
```

### 错误 3：在模板中使用复杂逻辑

```html
<!-- ❌ 不推荐 -->
<p>{{ items.filter(i => i.done).length }}</p>

<!-- ✅ 使用计算属性 -->
<p>{{ doneCount }}</p>
```

---

## 🎓 总结

### 关键要点

1. **响应式** - data 中的数据变化会自动更新视图
2. **v-model** - 实现表单双向绑定
3. **v-for** - 渲染列表，记得加 key
4. **v-if/v-show** - 条件渲染
5. **computed** - 计算属性，有缓存

### 下一步

完成实验手册中的挑战任务，构建一个完整的待办事项应用！
