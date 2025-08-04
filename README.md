# Undou draft

Trying to build a tool that can track and patch state change history. Used for scenarios similar to undo/redo functionality. The current implementation is based on [immer](https://github.com/immerjs/immer).

It's just a draft for now. If you want to play around, you can clone it and run `nr dev`.

If you don’t know how to use it, you can take a look at the [unit tests](./test/undou.test.ts).

## TODO

#### Important

- [x] Basic types at the root
- [x] Object
- [ ] Array
  - [x] on async scheduler
  - [ ] on sync scheduler
    - [ ] array instrumentations
- [ ] Vue reactivity

##### Low priority

- [ ] Map and Set
- [ ] ...
