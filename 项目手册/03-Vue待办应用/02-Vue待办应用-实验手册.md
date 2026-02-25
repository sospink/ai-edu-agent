# Vue 待办应用 - 实验手册

> 本实验将指导您使用 Vue 3 构建一个待办事项应用，学习响应式数据、列表渲染、事件处理等核心概念。您将从零开始创建一个功能完整的 Todo App。

## 步骤 1: 创建项目目录

### 创建工作目录

首先，创建项目目录：

```bash
mkdir -p /workspace/projects/vue-todo
```

### 验证目录创建

```bash
ls -la /workspace/projects/
```

您应该看到 `vue-todo` 目录已创建。

<!-- verify: command:ls /workspace/projects/|contains|vue-todo -->
<!-- questions: 什么是工作目录|Vue 项目结构是怎样的|为什么用 CDN 方式 -->

## 步骤 2: 创建基础 HTML 文件

### 创建 index.html

```bash
cat > /workspace/projects/vue-todo/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vue 待办应用</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; }
    h1 { text-align: center; color: #333; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div id="app">
    <div class="container">
      <h1>📝 Vue 待办应用</h1>
      <p>Hello, {{ name }}!</p>
    </div>
  </div>

  <script>
    const { createApp } = Vue
    
    createApp({
      data() {
        return {
          name: 'Vue'
        }
      }
    }).mount('#app')
  </script>
</body>
</html>
EOF
```

### 验证文件创建

```bash
cat /workspace/projects/vue-todo/index.html | head -20
```

<!-- verify: file_exists:/workspace/projects/vue-todo/index.html -->
<!-- verify: command:cat /workspace/projects/vue-todo/index.html|contains|Vue 待办应用 -->
<!-- questions: Vue CDN 是什么|为什么用 createApp|mount 是什么意思 -->

## 步骤 3: 添加输入框和按钮

### 更新 HTML 文件

```bash
cat > /workspace/projects/vue-todo/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vue 待办应用</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; }
    h1 { text-align: center; color: #333; margin-bottom: 20px; }
    .input-box { display: flex; gap: 10px; margin-bottom: 20px; }
    .input-box input { 
      flex: 1; padding: 12px; border: 2px solid #ddd; 
      border-radius: 8px; font-size: 16px; 
    }
    .input-box input:focus { border-color: #42b883; outline: none; }
    .input-box button { 
      padding: 12px 24px; background: #42b883; color: white; 
      border: none; border-radius: 8px; cursor: pointer; font-size: 16px;
    }
    .input-box button:hover { background: #3aa876; }
  </style>
</head>
<body>
  <div id="app">
    <div class="container">
      <h1>📝 Vue 待办应用</h1>
      
      <div class="input-box">
        <input 
          v-model="newTodo" 
          @keyup.enter="addTodo"
          placeholder="输入待办事项..."
        >
        <button @click="addTodo">添加</button>
      </div>
      
      <p>输入内容: {{ newTodo }}</p>
    </div>
  </div>

  <script>
    const { createApp } = Vue
    
    createApp({
      data() {
        return {
          newTodo: ''
        }
      },
      methods: {
        addTodo() {
          if (this.newTodo.trim()) {
            alert('添加: ' + this.newTodo)
            this.newTodo = ''
          }
        }
      }
    }).mount('#app')
  </script>
</body>
</html>
EOF

echo "✓ 已更新 index.html - 添加了输入框和按钮"
```

<!-- verify: command:cat /workspace/projects/vue-todo/index.html|contains|v-model -->
<!-- questions: v-model 是什么|@keyup.enter 是什么|为什么要 trim() -->

## 步骤 4: 实现待办列表

### 添加列表功能

```bash
cat > /workspace/projects/vue-todo/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vue 待办应用</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; }
    h1 { text-align: center; color: #333; margin-bottom: 20px; }
    .input-box { display: flex; gap: 10px; margin-bottom: 20px; }
    .input-box input { 
      flex: 1; padding: 12px; border: 2px solid #ddd; 
      border-radius: 8px; font-size: 16px; 
    }
    .input-box input:focus { border-color: #42b883; outline: none; }
    .input-box button { 
      padding: 12px 24px; background: #42b883; color: white; 
      border: none; border-radius: 8px; cursor: pointer; font-size: 16px;
    }
    .input-box button:hover { background: #3aa876; }
    .todo-list { list-style: none; }
    .todo-item { 
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; background: white; margin-bottom: 8px;
      border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .todo-item.done { opacity: 0.6; }
    .todo-item.done span { text-decoration: line-through; }
    .todo-item input[type="checkbox"] { width: 20px; height: 20px; }
    .todo-item span { flex: 1; }
    .todo-item button { 
      padding: 6px 12px; background: #ff6b6b; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .empty { text-align: center; color: #999; padding: 40px; }
  </style>
</head>
<body>
  <div id="app">
    <div class="container">
      <h1>📝 Vue 待办应用</h1>
      
      <div class="input-box">
        <input 
          v-model="newTodo" 
          @keyup.enter="addTodo"
          placeholder="输入待办事项..."
        >
        <button @click="addTodo">添加</button>
      </div>
      
      <ul class="todo-list">
        <li 
          v-for="todo in todos" 
          :key="todo.id"
          :class="['todo-item', { done: todo.done }]"
        >
          <input type="checkbox" v-model="todo.done">
          <span>{{ todo.text }}</span>
          <button @click="removeTodo(todo.id)">删除</button>
        </li>
      </ul>
      
      <p v-if="todos.length === 0" class="empty">
        暂无待办事项，添加一个吧！
      </p>
    </div>
  </div>

  <script>
    const { createApp } = Vue
    
    createApp({
      data() {
        return {
          newTodo: '',
          todos: [
            { id: 1, text: '学习 Vue 基础', done: true },
            { id: 2, text: '完成待办应用', done: false },
            { id: 3, text: '部署上线', done: false }
          ]
        }
      },
      methods: {
        addTodo() {
          if (this.newTodo.trim()) {
            this.todos.push({
              id: Date.now(),
              text: this.newTodo.trim(),
              done: false
            })
            this.newTodo = ''
          }
        },
        removeTodo(id) {
          this.todos = this.todos.filter(todo => todo.id !== id)
        }
      }
    }).mount('#app')
  </script>
</body>
</html>
EOF

echo "✓ 已添加列表功能"
```

<!-- verify: command:cat /workspace/projects/vue-todo/index.html|contains|v-for -->
<!-- questions: :key 为什么重要|filter 方法怎么用|如何实现编辑功能 -->

## 步骤 5: 添加统计功能

### 添加计算属性

```bash
cat > /workspace/projects/vue-todo/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vue 待办应用</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; }
    h1 { text-align: center; color: #333; margin-bottom: 20px; }
    .input-box { display: flex; gap: 10px; margin-bottom: 20px; }
    .input-box input { 
      flex: 1; padding: 12px; border: 2px solid #ddd; 
      border-radius: 8px; font-size: 16px; 
    }
    .input-box input:focus { border-color: #42b883; outline: none; }
    .input-box button { 
      padding: 12px 24px; background: #42b883; color: white; 
      border: none; border-radius: 8px; cursor: pointer; font-size: 16px;
    }
    .input-box button:hover { background: #3aa876; }
    .stats { 
      display: flex; justify-content: space-between; 
      padding: 12px 16px; background: white; margin-bottom: 16px;
      border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stats span { color: #666; }
    .stats strong { color: #42b883; }
    .todo-list { list-style: none; }
    .todo-item { 
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; background: white; margin-bottom: 8px;
      border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .todo-item.done { opacity: 0.6; }
    .todo-item.done span { text-decoration: line-through; }
    .todo-item input[type="checkbox"] { width: 20px; height: 20px; }
    .todo-item span { flex: 1; }
    .todo-item button { 
      padding: 6px 12px; background: #ff6b6b; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .empty { text-align: center; color: #999; padding: 40px; }
    .clear-btn { 
      width: 100%; padding: 12px; margin-top: 16px;
      background: #f0f0f0; border: none; border-radius: 8px;
      cursor: pointer; color: #666;
    }
    .clear-btn:hover { background: #e0e0e0; }
  </style>
</head>
<body>
  <div id="app">
    <div class="container">
      <h1>📝 Vue 待办应用</h1>
      
      <div class="input-box">
        <input 
          v-model="newTodo" 
          @keyup.enter="addTodo"
          placeholder="输入待办事项..."
        >
        <button @click="addTodo">添加</button>
      </div>
      
      <div class="stats" v-if="todos.length > 0">
        <span>总计: <strong>{{ totalCount }}</strong></span>
        <span>已完成: <strong>{{ doneCount }}</strong></span>
        <span>未完成: <strong>{{ undoneCount }}</strong></span>
      </div>
      
      <ul class="todo-list">
        <li 
          v-for="todo in todos" 
          :key="todo.id"
          :class="['todo-item', { done: todo.done }]"
        >
          <input type="checkbox" v-model="todo.done">
          <span>{{ todo.text }}</span>
          <button @click="removeTodo(todo.id)">删除</button>
        </li>
      </ul>
      
      <p v-if="todos.length === 0" class="empty">
        🎉 暂无待办事项，添加一个吧！
      </p>
      
      <button 
        v-if="doneCount > 0" 
        class="clear-btn"
        @click="clearDone"
      >
        清除已完成 ({{ doneCount }})
      </button>
    </div>
  </div>

  <script>
    const { createApp } = Vue
    
    createApp({
      data() {
        return {
          newTodo: '',
          todos: [
            { id: 1, text: '学习 Vue 基础', done: true },
            { id: 2, text: '完成待办应用', done: false },
            { id: 3, text: '部署上线', done: false }
          ]
        }
      },
      computed: {
        totalCount() {
          return this.todos.length
        },
        doneCount() {
          return this.todos.filter(t => t.done).length
        },
        undoneCount() {
          return this.todos.filter(t => !t.done).length
        }
      },
      methods: {
        addTodo() {
          if (this.newTodo.trim()) {
            this.todos.push({
              id: Date.now(),
              text: this.newTodo.trim(),
              done: false
            })
            this.newTodo = ''
          }
        },
        removeTodo(id) {
          this.todos = this.todos.filter(todo => todo.id !== id)
        },
        clearDone() {
          this.todos = this.todos.filter(todo => !todo.done)
        }
      }
    }).mount('#app')
  </script>
</body>
</html>
EOF

echo "✓ 已添加统计功能"
```

<!-- verify: command:cat /workspace/projects/vue-todo/index.html|contains|computed -->
<!-- verify: command:cat /workspace/projects/vue-todo/index.html|contains|clearDone -->
<!-- questions: computed 和 methods 有什么区别|如何添加本地存储|如何添加筛选功能 -->

## 步骤 6: 挑战任务 - 添加本地存储

### 任务说明

让待办数据持久化，刷新页面后数据不丢失。

### 创建完整版本（带 localStorage）

```bash
cat > /workspace/projects/vue-todo/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vue 待办应用</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; }
    h1 { text-align: center; color: white; margin-bottom: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    .input-box { display: flex; gap: 10px; margin-bottom: 20px; }
    .input-box input { 
      flex: 1; padding: 14px 16px; border: none; 
      border-radius: 10px; font-size: 16px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .input-box button { 
      padding: 14px 28px; background: #42b883; color: white; 
      border: none; border-radius: 10px; cursor: pointer; font-size: 16px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .input-box button:hover { transform: translateY(-2px); }
    .stats { 
      display: flex; justify-content: space-between; 
      padding: 14px 18px; background: white; margin-bottom: 16px;
      border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .stats span { color: #666; font-size: 14px; }
    .stats strong { color: #42b883; }
    .todo-list { list-style: none; }
    .todo-item { 
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px; background: white; margin-bottom: 10px;
      border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .todo-item:hover { transform: translateX(4px); }
    .todo-item.done { opacity: 0.7; }
    .todo-item.done span { text-decoration: line-through; color: #999; }
    .todo-item input[type="checkbox"] { width: 22px; height: 22px; cursor: pointer; }
    .todo-item span { flex: 1; font-size: 15px; }
    .todo-item button { 
      padding: 8px 14px; background: #ff6b6b; color: white;
      border: none; border-radius: 6px; cursor: pointer;
      opacity: 0; transition: opacity 0.2s;
    }
    .todo-item:hover button { opacity: 1; }
    .empty { text-align: center; color: white; padding: 40px; font-size: 18px; }
    .clear-btn { 
      width: 100%; padding: 14px; margin-top: 16px;
      background: rgba(255,255,255,0.2); border: none; border-radius: 10px;
      cursor: pointer; color: white; font-size: 15px;
      transition: background 0.2s;
    }
    .clear-btn:hover { background: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <div id="app">
    <div class="container">
      <h1>📝 Vue 待办应用</h1>
      
      <div class="input-box">
        <input 
          v-model="newTodo" 
          @keyup.enter="addTodo"
          placeholder="输入待办事项，按回车添加..."
        >
        <button @click="addTodo">添加</button>
      </div>
      
      <div class="stats" v-if="todos.length > 0">
        <span>总计: <strong>{{ totalCount }}</strong></span>
        <span>已完成: <strong>{{ doneCount }}</strong></span>
        <span>未完成: <strong>{{ undoneCount }}</strong></span>
      </div>
      
      <ul class="todo-list">
        <li 
          v-for="todo in todos" 
          :key="todo.id"
          :class="['todo-item', { done: todo.done }]"
        >
          <input type="checkbox" v-model="todo.done">
          <span>{{ todo.text }}</span>
          <button @click="removeTodo(todo.id)">删除</button>
        </li>
      </ul>
      
      <p v-if="todos.length === 0" class="empty">
        🎉 暂无待办事项，添加一个吧！
      </p>
      
      <button 
        v-if="doneCount > 0" 
        class="clear-btn"
        @click="clearDone"
      >
        清除已完成 ({{ doneCount }})
      </button>
    </div>
  </div>

  <script>
    const { createApp } = Vue
    
    createApp({
      data() {
        return {
          newTodo: '',
          todos: JSON.parse(localStorage.getItem('vue-todos')) || []
        }
      },
      computed: {
        totalCount() {
          return this.todos.length
        },
        doneCount() {
          return this.todos.filter(t => t.done).length
        },
        undoneCount() {
          return this.todos.filter(t => !t.done).length
        }
      },
      watch: {
        todos: {
          deep: true,
          handler(newTodos) {
            localStorage.setItem('vue-todos', JSON.stringify(newTodos))
          }
        }
      },
      methods: {
        addTodo() {
          if (this.newTodo.trim()) {
            this.todos.push({
              id: Date.now(),
              text: this.newTodo.trim(),
              done: false
            })
            this.newTodo = ''
          }
        },
        removeTodo(id) {
          this.todos = this.todos.filter(todo => todo.id !== id)
        },
        clearDone() {
          this.todos = this.todos.filter(todo => !todo.done)
        }
      }
    }).mount('#app')
  </script>
</body>
</html>
EOF

echo "✅ Vue 待办应用（完整版）已完成！"
echo "📁 文件位置: /workspace/projects/vue-todo/index.html"
```

<!-- verify: command:cat /workspace/projects/vue-todo/index.html|contains|localStorage -->
<!-- verify: command:cat /workspace/projects/vue-todo/index.html|contains|watch -->
<!-- questions: localStorage 有什么限制|watch 的 deep 是什么|如何同步到服务器 -->

## 步骤 7: 查看项目成果

### 查看创建的文件

```bash
ls -la /workspace/projects/vue-todo/
```

### 查看文件大小

```bash
wc -l /workspace/projects/vue-todo/index.html
```

您应该看到创建的 HTML 文件及其行数。

<!-- verify: command:ls /workspace/projects/vue-todo/|contains|index.html -->
<!-- questions: 如何在浏览器中预览|如何部署到服务器|如何添加更多功能 -->

## 步骤 8: 总结与扩展

### 本项目学到了什么

恭喜您完成了 Vue 待办应用项目！您已掌握：

1. **Vue 应用创建** - createApp 和 mount
2. **响应式数据** - data 函数返回对象
3. **双向绑定** - v-model 指令
4. **列表渲染** - v-for 和 :key
5. **条件渲染** - v-if 和 v-show
6. **事件处理** - @click 和 @keyup
7. **计算属性** - computed 自动计算
8. **侦听器** - watch 监听变化
9. **本地存储** - localStorage 持久化

### 扩展练习

尝试以下练习巩固学习：

1. **添加筛选** - 全部/已完成/未完成
2. **添加编辑** - 双击编辑待办内容
3. **添加拖拽** - 拖拽排序待办项
4. **添加分类** - 支持待办分类标签

### Vue 常用指令速查

| 指令 | 说明 |
|------|------|
| `v-model` | 双向数据绑定 |
| `v-for` | 列表渲染 |
| `v-if` | 条件渲染（移除DOM） |
| `v-show` | 条件显示（CSS隐藏） |
| `v-bind` / `:` | 属性绑定 |
| `v-on` / `@` | 事件绑定 |

继续探索 Vue 的更多可能！🚀

<!-- questions: 如何学习 Vue 组件|有什么 Vue 项目推荐|如何使用 Vue CLI -->
