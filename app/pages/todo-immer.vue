<script setup lang="ts">
import type { Immutable } from 'immer'
import { produce } from 'immer'
import ToDoItem from '~/components/ToDoItem.vue'

interface TypeTodoItem {
  id: string
  title: string
  completed: boolean
}

interface AppState {
  todos: TypeTodoItem[]
}

// --- Undo/Redo with State Snapshots ---

const maxStackSize = ref(10)

const state = shallowRef<Immutable<AppState>>({
  todos: [],
})

const undoStack = ref<Immutable<AppState>[]>([])
const redoStack = ref<Immutable<AppState>[]>([])

function saveToHistory() {
  if (maxStackSize.value > -1 && undoStack.value.length >= maxStackSize.value)
    undoStack.value.shift()

  undoStack.value.push(state.value)
  redoStack.value.length = 0
}

function updateState(updater: (draft: AppState) => void) {
  saveToHistory()
  state.value = produce(state.value, updater)
}

function undo() {
  if (undoStack.value.length === 0)
    return

  const previousState = undoStack.value.pop()!
  redoStack.value.push(state.value)
  state.value = previousState
}

function redo() {
  if (redoStack.value.length === 0)
    return

  const nextState = redoStack.value.pop()!
  undoStack.value.push(state.value)
  state.value = nextState
}

// --- ToDo APP ---

const newTodoTitle = ref('')
const selectedTodo = ref<string | null>(null)

function addTodo() {
  if (newTodoTitle.value.trim() === '')
    newTodoTitle.value = `new todo ${Math.random().toString(36).substring(2, 6)}`

  updateState((draft) => {
    draft.todos.push({
      id: crypto.randomUUID().split('-')[0],
      title: newTodoTitle.value.trim(),
      completed: false,
    })
  })

  newTodoTitle.value = ''
}

function removeTodo(id: string) {
  updateState((draft) => {
    draft.todos = draft.todos.filter(todo => todo.id !== id)
  })
}

function clearAllTodos() {
  if (state.value.todos.length === 0)
    return

  updateState((draft) => {
    draft.todos = []
  })
}

function updateTodoCompleted(id: string, completed: boolean) {
  updateState((draft) => {
    const todo = draft.todos.find(t => t.id === id)
    if (todo) {
      todo.completed = completed
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
</script>

<template>
  <div flex="~ col">
    <h1 text-xl font-200 px10 pt10>
      Immer Todo
    </h1>
    <div flex="~ col md:row gap-10">
      <div p10 flex="~ col gap-10" flex-1>
        <div>
          <h2 text-xl font-900>
            ToDo Demo (Immer)
          </h2>
        </div>

        <div flex="~ gap-2">
          <input v-model="newTodoTitle" type="text" ipt placeholder="new todo">
          <button btn @click="addTodo">
            Add
          </button>
          <button bg-red-500 btn :disabled="state.todos.length === 0" @click="clearAllTodos">
            Clear All
          </button>
        </div>

        <div flex="~ col gap-2">
          <ToDoItem
            v-for="todo in state.todos"
            :id="todo.id"
            :key="todo.id"
            :completed="todo.completed"
            :title="todo.title"
            :is-selected="selectedTodo === todo.id"
            @select="selectedTodo = $event"
            @remove="removeTodo"
            @update:completed="updateTodoCompleted(todo.id, $event)"
            @update:title="updateTodoTitle(todo.id, $event)"
          />
        </div>
      </div>

      <div p10 flex="~ col gap-10" flex-1>
        <div flex="~ gap-2">
          <button btn :disabled="undoStack.length === 0" @click="undo">
            Undo ({{ undoStack.length }})
          </button>
          <button btn :disabled="redoStack.length === 0" @click="redo">
            Redo ({{ redoStack.length }})
          </button>

          <div flex="~ gap-1" ml-5>
            <p flex="~ items-center" op-75>
              Max:
            </p>
            <input v-model="maxStackSize" type="number" min="-1" max="100" ipt>
          </div>
        </div>

        <div flex="~ col gap-5">
          <div flex="~ col gap-3">
            <h2 text-lg font-100>
              Undo Stack
            </h2>
            <div v-for="(state, index) in undoStack" :key="index" flex="~ col gap-1" p2 rounded-md bg-gray-200 dark:bg-gray-700>
              <div text-xs text-blue-300>
                State {{ undoStack.length - index }}: {{ state.todos.length }} todos
              </div>
            </div>
          </div>
          <div flex="~ col gap-2">
            <h2 text-lg font-100>
              Redo Stack
            </h2>
            <div v-for="(state, index) in redoStack.slice().reverse()" :key="index" flex="~ col gap-1" p2 rounded-md bg-gray-200 dark:bg-gray-700>
              <div text-xs text-orange-300>
                State {{ redoStack.length - index }}: {{ state.todos.length }} todos
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
