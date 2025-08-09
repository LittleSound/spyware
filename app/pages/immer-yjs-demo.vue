<script setup lang="ts">
import * as Y from 'yjs'
import { yMapToDraft } from 'immer-yjs'
import { produce } from 'immer'

interface TodoItem {
  id: string
  title: string
  completed: boolean
  createdAt: number
}

interface AppState {
  todos: TodoItem[]
  users: string[]
}

// Initialize Yjs document
const ydoc = new Y.Doc()
const ymap = ydoc.getMap('state')

// Initialize state if empty
if (!ymap.has('todos')) {
  ymap.set('todos', new Y.Array())
}
if (!ymap.has('users')) {
  ymap.set('users', new Y.Array())
}

// Reactive state using immer-yjs
const state = ref<AppState>({
  todos: [],
  users: []
})

const currentUser = ref(`User${Math.floor(Math.random() * 1000)}`)
const newTodoTitle = ref('')
const isConnected = ref(false)
const connectionStatus = ref('Disconnected')

// Update local state when Yjs document changes
function updateLocalState() {
  const draft = yMapToDraft(ymap) as AppState
  state.value = {
    todos: draft.todos || [],
    users: draft.users || []
  }
}

// Initialize observers
ydoc.on('update', updateLocalState)
ymap.observe(updateLocalState)

// Add current user on mount
onMounted(() => {
  const ytodos = ymap.get('todos') as Y.Array<any>
  const yusers = ymap.get('users') as Y.Array<string>
  
  // Add current user if not already present
  const users = yusers.toArray()
  if (!users.includes(currentUser.value)) {
    yusers.push([currentUser.value])
  }
  
  // Simulate connection status
  isConnected.value = true
  connectionStatus.value = 'Connected (Simulated)'
  
  updateLocalState()
})

onUnmounted(() => {
  // Remove current user on unmount
  const yusers = ymap.get('users') as Y.Array<string>
  const users = yusers.toArray()
  const index = users.indexOf(currentUser.value)
  if (index > -1) {
    yusers.delete(index, 1)
  }
})

// CRDT operations using immer-yjs
function addTodo() {
  if (newTodoTitle.value.trim() === '') {
    newTodoTitle.value = `New todo by ${currentUser.value}`
  }

  const ytodos = ymap.get('todos') as Y.Array<any>
  
  ydoc.transact(() => {
    const newTodo: TodoItem = {
      id: crypto.randomUUID().split('-')[0],
      title: newTodoTitle.value.trim(),
      completed: false,
      createdAt: Date.now()
    }
    
    ytodos.push([newTodo])
  })

  newTodoTitle.value = ''
}

function removeTodo(id: string) {
  const ytodos = ymap.get('todos') as Y.Array<any>
  const todos = ytodos.toArray()
  const index = todos.findIndex((todo: TodoItem) => todo.id === id)
  
  if (index > -1) {
    ytodos.delete(index, 1)
  }
}

function toggleTodo(id: string) {
  const ytodos = ymap.get('todos') as Y.Array<any>
  const todos = ytodos.toArray()
  const index = todos.findIndex((todo: TodoItem) => todo.id === id)
  
  if (index > -1) {
    ydoc.transact(() => {
      const todo = todos[index]
      const updatedTodo = { ...todo, completed: !todo.completed }
      ytodos.delete(index, 1)
      ytodos.insert(index, [updatedTodo])
    })
  }
}

function updateTodoTitle(id: string, title: string) {
  const ytodos = ymap.get('todos') as Y.Array<any>
  const todos = ytodos.toArray()
  const index = todos.findIndex((todo: TodoItem) => todo.id === id)
  
  if (index > -1) {
    ydoc.transact(() => {
      const todo = todos[index]
      const updatedTodo = { ...todo, title }
      ytodos.delete(index, 1)
      ytodos.insert(index, [updatedTodo])
    })
  }
}

function clearAllTodos() {
  const ytodos = ymap.get('todos') as Y.Array<any>
  const length = ytodos.length
  if (length > 0) {
    ytodos.delete(0, length)
  }
}

// Simulate adding another user
function simulateUser() {
  const yusers = ymap.get('users') as Y.Array<string>
  const newUser = `Bot${Math.floor(Math.random() * 100)}`
  yusers.push([newUser])
  
  // Simulate the new user adding a todo
  setTimeout(() => {
    const ytodos = ymap.get('todos') as Y.Array<any>
    const botTodo: TodoItem = {
      id: crypto.randomUUID().split('-')[0],
      title: `Todo from ${newUser}`,
      completed: false,
      createdAt: Date.now()
    }
    ytodos.push([botTodo])
  }, 1000)
  
  // Remove the simulated user after 5 seconds
  setTimeout(() => {
    const users = yusers.toArray()
    const index = users.indexOf(newUser)
    if (index > -1) {
      yusers.delete(index, 1)
    }
  }, 5000)
}

// Computed properties
const completedCount = computed(() => state.value.todos.filter(t => t.completed).length)
const totalCount = computed(() => state.value.todos.length)
const sortedTodos = computed(() => 
  [...state.value.todos].sort((a, b) => b.createdAt - a.createdAt)
)
</script>

<template>
  <div class="container mx-auto p-6 max-w-4xl">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">
        Immer-YJS CRDT Demo
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Interactive demonstration of Collaborative Real-time Data Types using Yjs and immer-yjs
      </p>
    </div>

    <!-- Connection Status -->
    <div class="mb-6 p-4 rounded-lg" :class="isConnected ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'">
      <div class="flex items-center gap-2">
        <div 
          class="w-3 h-3 rounded-full" 
          :class="isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'"
        />
        <span class="font-semibold">{{ connectionStatus }}</span>
      </div>
      <div class="text-sm mt-2">
        Current user: <span class="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{{ currentUser }}</span>
      </div>
      <div class="text-sm mt-1">
        Active users: {{ state.users.length }} - 
        <span class="font-mono text-xs">{{ state.users.join(', ') }}</span>
      </div>
    </div>

    <div class="grid md:grid-cols-2 gap-8">
      <!-- Todo Management -->
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-semibold mb-4">
            Collaborative Todo List
          </h2>
          <div class="flex gap-2 mb-4">
            <input 
              v-model="newTodoTitle" 
              type="text" 
              placeholder="Add a new todo..."
              class="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800"
              @keydown.enter="addTodo"
            >
            <button 
              @click="addTodo"
              class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Add
            </button>
          </div>

          <div class="flex gap-2 mb-4">
            <button 
              @click="simulateUser"
              class="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Simulate User
            </button>
            <button 
              @click="clearAllTodos"
              :disabled="totalCount === 0"
              class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>

          <div class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ completedCount }} of {{ totalCount }} completed
          </div>
        </div>

        <!-- Todo List -->
        <div class="space-y-2 max-h-96 overflow-y-auto">
          <div 
            v-for="todo in sortedTodos" 
            :key="todo.id"
            class="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <input 
              :checked="todo.completed"
              type="checkbox" 
              @change="toggleTodo(todo.id)"
              class="w-4 h-4"
            >
            <input 
              :value="todo.title"
              @input="updateTodoTitle(todo.id, ($event.target as HTMLInputElement).value)"
              class="flex-1 bg-transparent border-none outline-none"
              :class="todo.completed ? 'line-through text-gray-500' : ''"
            >
            <button 
              @click="removeTodo(todo.id)"
              class="text-red-500 hover:text-red-700 px-2"
            >
              ×
            </button>
          </div>
          
          <div v-if="totalCount === 0" class="text-center text-gray-500 py-8">
            No todos yet. Add one above or simulate a user to see collaboration in action!
          </div>
        </div>
      </div>

      <!-- CRDT Information -->
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-semibold mb-4">
            CRDT Information
          </h2>
          
          <div class="space-y-4">
            <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <h3 class="font-semibold mb-2">What is CRDT?</h3>
              <p class="text-sm">
                Conflict-free Replicated Data Types (CRDTs) automatically resolve conflicts in distributed systems, 
                enabling real-time collaboration without central coordination.
              </p>
            </div>
            
            <div class="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <h3 class="font-semibold mb-2">Yjs Features</h3>
              <ul class="text-sm space-y-1">
                <li>• Conflict-free merging</li>
                <li>• Efficient delta updates</li>
                <li>• Offline-first approach</li>
                <li>• Type-aware operations</li>
              </ul>
            </div>

            <div class="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <h3 class="font-semibold mb-2">immer-yjs Integration</h3>
              <p class="text-sm">
                Combines Yjs CRDT capabilities with Immer's immutable updates, 
                providing a familiar React-like state management experience for collaborative apps.
              </p>
            </div>

            <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 class="font-semibold mb-2">Demo Features</h3>
              <ul class="text-sm space-y-1">
                <li>• Real-time state synchronization</li>
                <li>• Multi-user simulation</li>
                <li>• Conflict-free operations</li>
                <li>• Immutable state updates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  min-height: 100vh;
}
</style>