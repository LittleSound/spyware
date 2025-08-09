<script setup lang="ts">
import * as Y from 'yjs'
import type { Immutable } from 'immer'
import { produce } from 'immer'
import { bind } from 'immer-yjs'

interface TodoItem {
  id: string
  title: string
  completed: boolean
  createdAt: number
}

interface AppState {
  todos: TodoItem[]
  users: { [userId: string]: { name: string; color: string; lastSeen: number } }
  currentUser: string
}

// Initialize Yjs document
const ydoc = ref<Y.Doc | null>(null)
const ymap = ref<Y.Map<any> | null>(null)

// State management with immer-yjs
const state = shallowRef<Immutable<AppState>>({
  todos: [],
  users: {},
  currentUser: 'user1'
})

// UI state
const newTodoTitle = ref('')
const isConnected = ref(false)
const simulateUsers = ref(false)
const connectionLog = ref<string[]>([])

// User colors for simulation
const userColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

// Initialize CRDT setup
function initializeCRDT() {
  try {
    // Create new Yjs document
    ydoc.value = new Y.Doc()
    ymap.value = ydoc.value.getMap('appState')
    
    // Initialize default state if empty
    if (!ymap.value.get('todos')) {
      ymap.value.set('todos', [])
    }
    if (!ymap.value.get('users')) {
      ymap.value.set('users', {})
    }
    if (!ymap.value.get('currentUser')) {
      ymap.value.set('currentUser', 'user1')
    }

    // Bind Yjs state to immer
    const unbind = bind(ymap.value as Y.Map<any>, state as any)
    
    // Observe changes
    ymap.value.observe(() => {
      logConnection('State synchronized')
    })

    isConnected.value = true
    logConnection('CRDT initialized successfully')
    
    // Add current user
    updateUser('user1', 'You', '#3b82f6')
    
    return unbind
  } catch (error) {
    console.error('Failed to initialize CRDT:', error)
    logConnection(`Error: ${(error as Error).message}`)
    return () => {}
  }
}

// Update state using immer with Yjs backing
function updateState(updater: (draft: AppState) => void) {
  if (!ymap.value) return
  
  try {
    // Get current state from Yjs
    const currentState = {
      todos: ymap.value.get('todos') || [],
      users: ymap.value.get('users') || {},
      currentUser: ymap.value.get('currentUser') || 'user1'
    }
    
    // Apply immer update
    const newState = produce(currentState, updater)
    
    // Update Yjs state
    ymap.value.set('todos', newState.todos)
    ymap.value.set('users', newState.users)
    ymap.value.set('currentUser', newState.currentUser)
    
    logConnection('State updated via immer-yjs')
  } catch (error) {
    console.error('Failed to update state:', error)
    logConnection(`Update error: ${(error as Error).message}`)
  }
}

// Todo operations
function addTodo() {
  const title = newTodoTitle.value.trim() || `Todo ${Date.now()}`
  
  updateState((draft) => {
    draft.todos.push({
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: Date.now()
    })
  })
  
  newTodoTitle.value = ''
}

function removeTodo(id: string) {
  updateState((draft) => {
    draft.todos = draft.todos.filter(todo => todo.id !== id)
  })
}

function toggleTodo(id: string) {
  updateState((draft) => {
    const todo = draft.todos.find(t => t.id === id)
    if (todo) {
      todo.completed = !todo.completed
    }
  })
}

function updateTodoTitle(id: string, title: string) {
  updateState((draft) => {
    const todo = draft.todos.find(t => t.id === id)
    if (todo) {
      todo.title = title
    }
  })
}

// User management
function updateUser(userId: string, name: string, color: string) {
  updateState((draft) => {
    draft.users[userId] = {
      name,
      color,
      lastSeen: Date.now()
    }
  })
}

function clearAllTodos() {
  updateState((draft) => {
    draft.todos = []
  })
}

// Simulate multiple users for demo
function startUserSimulation() {
  if (!simulateUsers.value) return
  
  const userIds = ['user2', 'user3', 'user4']
  const names = ['Alice', 'Bob', 'Charlie']
  
  userIds.forEach((userId, index) => {
    updateUser(userId, names[index], userColors[index + 1])
    
    // Simulate random actions
    setTimeout(() => {
      if (Math.random() > 0.5) {
        updateState((draft) => {
          draft.todos.push({
            id: crypto.randomUUID(),
            title: `${names[index]}'s todo`,
            completed: false,
            createdAt: Date.now()
          })
        })
        logConnection(`${names[index]} added a todo`)
      }
    }, (index + 1) * 2000)
  })
}

function stopUserSimulation() {
  updateState((draft) => {
    // Keep only current user
    draft.users = { [draft.currentUser]: draft.users[draft.currentUser] }
  })
}

// Logging
function logConnection(message: string) {
  const timestamp = new Date().toLocaleTimeString()
  connectionLog.value.unshift(`[${timestamp}] ${message}`)
  if (connectionLog.value.length > 20) {
    connectionLog.value = connectionLog.value.slice(0, 20)
  }
}

// Lifecycle
onMounted(() => {
  const unbind = initializeCRDT()
  
  onUnmounted(() => {
    unbind()
    if (ydoc.value) {
      ydoc.value.destroy()
    }
  })
})

// Watch simulation toggle
watch(simulateUsers, (newVal) => {
  if (newVal) {
    startUserSimulation()
  } else {
    stopUserSimulation()
  }
})

// Computed properties
const completedCount = computed(() => 
  state.value.todos.filter(todo => todo.completed).length
)

const totalCount = computed(() => state.value.todos.length)

const activeUsers = computed(() => 
  Object.entries(state.value.users).filter(([_, user]) => 
    Date.now() - user.lastSeen < 30000
  )
)
</script>

<template>
  <div class="demo-container">
    <div class="header">
      <h1>🔄 immer-yjs CRDT Demo</h1>
      <p class="subtitle">
        Interactive collaborative todo list with conflict-free replicated data types
      </p>
    </div>

    <!-- Connection Status -->
    <div class="status-panel">
      <div class="status-item">
        <span class="status-label">CRDT Status:</span>
        <span :class="['status-value', isConnected ? 'connected' : 'disconnected']">
          {{ isConnected ? '🟢 Connected' : '🔴 Disconnected' }}
        </span>
      </div>
      
      <div class="status-item">
        <span class="status-label">Active Users:</span>
        <div class="users-list">
          <span 
            v-for="[userId, user] in activeUsers" 
            :key="userId"
            class="user-badge"
            :style="{ backgroundColor: user.color }"
          >
            {{ user.name }}
          </span>
        </div>
      </div>

      <div class="status-item">
        <label class="simulate-toggle">
          <input v-model="simulateUsers" type="checkbox">
          Simulate Multiple Users
        </label>
      </div>
    </div>

    <div class="main-content">
      <!-- Todo Management -->
      <div class="todo-section">
        <h2>📝 Collaborative Todo List</h2>
        
        <div class="todo-controls">
          <input 
            v-model="newTodoTitle" 
            type="text" 
            placeholder="Enter new todo..."
            class="todo-input"
            @keyup.enter="addTodo"
          >
          <button @click="addTodo" class="btn btn-primary">
            Add Todo
          </button>
          <button 
            @click="clearAllTodos" 
            class="btn btn-danger"
            :disabled="totalCount === 0"
          >
            Clear All
          </button>
        </div>

        <div class="todo-stats">
          <span>Total: {{ totalCount }}</span>
          <span>Completed: {{ completedCount }}</span>
          <span>Remaining: {{ totalCount - completedCount }}</span>
        </div>

        <div class="todo-list">
          <div 
            v-for="todo in state.todos" 
            :key="todo.id"
            class="todo-item"
            :class="{ completed: todo.completed }"
          >
            <input 
              :checked="todo.completed"
              type="checkbox" 
              @change="toggleTodo(todo.id)"
            >
            <input 
              :value="todo.title"
              type="text"
              class="todo-title"
              @input="updateTodoTitle(todo.id, ($event.target as HTMLInputElement).value)"
            >
            <button @click="removeTodo(todo.id)" class="btn btn-small btn-danger">
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Info Panel -->
      <div class="info-section">
        <h3>📚 CRDT Technology Stack</h3>
        
        <div class="info-card">
          <h4>🔗 Yjs Features</h4>
          <ul>
            <li>Conflict-free replicated data types</li>
            <li>Real-time collaborative editing</li>
            <li>Offline support with automatic sync</li>
            <li>Efficient delta-based updates</li>
          </ul>
        </div>

        <div class="info-card">
          <h4>⚡ immer-yjs Integration</h4>
          <ul>
            <li>Familiar immutable state patterns</li>
            <li>Automatic Yjs synchronization</li>
            <li>Type-safe state updates</li>
            <li>Zero-copy state binding</li>
          </ul>
        </div>

        <div class="info-card">
          <h4>🔄 Connection Log</h4>
          <div class="log-container">
            <div v-for="(log, index) in connectionLog" :key="index" class="log-entry">
              {{ log }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #1f2937;
}

.subtitle {
  font-size: 1.1rem;
  color: #6b7280;
  margin: 0;
}

.status-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 1px solid #e5e7eb;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-label {
  font-weight: 600;
  color: #374151;
}

.status-value.connected {
  color: #10b981;
  font-weight: 600;
}

.status-value.disconnected {
  color: #ef4444;
  font-weight: 600;
}

.users-list {
  display: flex;
  gap: 0.5rem;
}

.user-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
}

.simulate-toggle input {
  margin-right: 0.5rem;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.todo-section, .info-section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.todo-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.todo-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.todo-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.todo-item.completed {
  opacity: 0.7;
}

.todo-item.completed .todo-title {
  text-decoration: line-through;
}

.todo-title {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.875rem;
}

.info-card {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  border: 1px solid #e5e7eb;
}

.info-card h4 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 600;
}

.info-card ul {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.info-card li {
  margin-bottom: 0.25rem;
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  background: #1f2937;
  border-radius: 4px;
  padding: 0.75rem;
}

.log-entry {
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 0.75rem;
  color: #d1d5db;
  line-height: 1.4;
  margin-bottom: 0.25rem;
}

@media (max-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .status-panel {
    flex-direction: column;
    gap: 1rem;
  }
  
  .todo-controls {
    flex-direction: column;
  }
}
</style>