<script setup lang="ts">
import type { Patch } from 'undou'
import { patchState, undou } from 'undou'
import PatchItem from '~/components/PatchItem.vue'
import ToDoItem from '~/components/ToDoItem.vue'

interface TodoItem {
  id: string
  title: string
  completed: boolean
}

// --- Undo/Redo ---

const maxStackSize = ref(10)

interface PatchItemType {
  direct: Patch[]
  inverse: Patch[]
}
const undoStack = ref<PatchItemType[]>([])
const redoStack = ref<PatchItemType[]>([])

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
    id: crypto.randomUUID().split('-')[0],
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
          <button bg-red-500 btn :disabled="state.value.todos.length === 0" @click="clearAllTodos">
            Clear All
          </button>
        </div>

        <div flex="~ col gap-2">
          <ToDoItem
            v-for="todo in state.value.todos"
            :id="todo.id"
            :key="todo.id"
            v-model:completed="todo.completed"
            v-model:title="todo.title"
            :is-selected="selectedTodo === todo.id"
            @select="selectedTodo = $event"
            @remove="removeTodo"
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
          <div flex="~ col gap-3">
            <h2 text-lg font-100>
              Undos
            </h2>
            <div v-for="(patchItem, index) in undoStack" :key="index" flex="~ col gap-1" p2 rounded-md bg-gray-200 dark:bg-gray-700>
              <PatchItem
                v-for="(directItem, index2) in patchItem.direct"
                :key="`${index}-${index2}-direct`"
                text-xs text-green-300
                :patch="directItem"
              />
              <PatchItem
                v-for="(inverseItem, index2) in patchItem.inverse"
                :key="`${index}-${index2}-inverse`"
                text-xs text-red-300
                :patch="inverseItem"
              />
            </div>
          </div>
          <div flex="~ col gap-2">
            <h2 text-lg font-100>
              Redos
            </h2>
            <div v-for="(patchItem, index) in redoStack.slice().reverse()" :key="index" flex="~ col gap-1" p2 rounded-md bg-gray-200 dark:bg-gray-700>
              <PatchItem
                v-for="(directItem, index2) in patchItem.direct"
                :key="`${index}-${index2}-direct`"
                text-xs text-green-300
                :patch="directItem"
              />
              <PatchItem
                v-for="(inverseItem, index2) in patchItem.inverse"
                :key="`${index}-${index2}-inverse`"
                text-xs text-red-300
                :patch="inverseItem"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
