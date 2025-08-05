<script setup lang="ts">
import type { Patch } from 'undou'
import { patchState, undou } from 'undou'

interface TodoItem {
  id: string
  title: string
  completed: boolean
}

// --- Undo/Redo ---

const maxStackSize = ref(10)

interface PatchItem {
  direct: Patch[]
  inverse: Patch[]
}
const undoStack = ref<PatchItem[]>([])
const redoStack = ref<PatchItem[]>([])

const state = undou({
  todos: [] as TodoItem[],
}, (patches, inversePatches) => {
  if (maxStackSize.value > -1 && undoStack.value.length >= maxStackSize.value)
    undoStack.value.shift()
  undoStack.value.push(markRaw({
    direct: patches,
    inverse: inversePatches,
  }))
  redoStack.value.length = 0
})

function undo() {
  if (undoStack.value.length === 0)
    return
  const patch = undoStack.value.pop()!
  redoStack.value.push(patch)
  patchState(state, patch.inverse)
}

function redo() {
  if (redoStack.value.length === 0)
    return
  const patch = redoStack.value.pop()!
  undoStack.value.push(patch)
  patchState(state, patch.direct)
}

// --- ToDo APP ---

const newTodoTitle = ref('')

const selectedTodo = ref<string | null>(null)

function addTodo() {
  if (newTodoTitle.value.trim() === '')
    newTodoTitle.value = `new todo ${Math.random().toString(36).substring(2, 6)}`
  state.value.todos.push({
    id: crypto.randomUUID(),
    title: newTodoTitle.value.trim(),
    completed: false,
  })
  newTodoTitle.value = ''
}

function removeTodo(id: string) {
  const newList = state.value.todos.filter(todo => todo.id !== id)
  state.value.todos = newList
}

function clearAllTodos() {
  if (state.value.todos.length === 0)
    return
  state.value.todos = []
}
</script>

<template>
  <div flex="~ col">
    <h1 text-xl font-200 px10 pt10>
      Undou
    </h1>
    <div flex="~ col md:row gap-10">
      <div p10 flex="~ col gap-10" flex-1>
        <div>
          <h2 text-xl font-900>
            ToDo Demo
          </h2>
        </div>

        <div flex="~ gap-2">
          <input v-model="newTodoTitle" type="text" ipt placeholder="new todo">
          <button btn @click="addTodo">
            Add
          </button>
          <button bg-red-500 btn @click="clearAllTodos">
            Clear All
          </button>
        </div>

        <div flex="~ col gap-2">
          <div v-for="todo in state.value.todos" :key="todo.id" flex="~ items-start">
            <div flex="~ gap-4" p2 rounded-md bg-gray-600 cursor-pointer :class="{ '!outline-2 outline-blue-400': selectedTodo === todo.id }" @click="selectedTodo = todo.id">
              <div size-8 flex="~ items-center justify-center">
                <input v-model="todo.completed" type="checkbox" size-4 cursor-pointer click-feedback>
              </div>
              <div flex="~ items-center">
                <input v-model.lazy="todo.title" outline-none>
              </div>
              <button btn @click="removeTodo(todo.id)">
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      <div p10 flex="~ col gap-10" flex-1>
        <div flex="~ gap-2">
          <button btn :disabled="undoStack.length === 0" class="disabled:opacity-50" @click="undo">
            Undo ({{ undoStack.length }})
          </button>
          <button btn :disabled="redoStack.length === 0" class="disabled:opacity-50" @click="redo">
            Redo ({{ redoStack.length }})
          </button>

          <div flex="~ gap-1" ml-5>
            <p flex="~ items-center" op-75>
              Max:
            </p>
            <input v-model="maxStackSize" type="number" min="-1" max="100" ipt>
          </div>
        </div>

        <div flex="~ items-center gap-5" font-100>
          <div flex="~ items-center gap-2">
            <div rounded-full bg-green-300 h-2 w-2 />
            <div op-75>
              Direct Patches
            </div>
          </div>
          <div flex="~ items-center gap-2">
            <div rounded-full bg-red-300 h-2 w-2 />
            <div op-75>
              Inverse Patches
            </div>
          </div>
        </div>

        <div flex="~ col gap-5">
          <div flex="~ col gap-2">
            <h2 text-lg font-100>
              Undos
            </h2>
            <div v-for="(patch, index) in undoStack" :key="index" text-sm>
              <p text-green-300>
                {{ patch.direct }}
              </p>
              <p text-xs text-red-300>
                {{ patch.inverse }}
              </p>
            </div>
          </div>
          <div flex="~ col gap-2">
            <h2 text-lg font-100>
              Redos
            </h2>
            <div v-for="(patch, index) in redoStack" :key="index" text-sm>
              <p text-green-300>
                {{ patch.direct }}
              </p>
              <p text-xs text-red-300>
                {{ patch.inverse }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
