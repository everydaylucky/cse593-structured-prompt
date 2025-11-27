import type { PromptItem } from "./prompt-storage";

export type UndoRedoAction = 
  | { type: "add"; prompt: PromptItem; index: number }
  | { type: "delete"; prompt: PromptItem; index: number }
  | { type: "update"; oldPrompt: PromptItem; newPrompt: PromptItem; index: number }
  | { type: "reorder"; oldIndex: number; newIndex: number }
  | { type: "batch"; actions: UndoRedoAction[] };

export interface UndoRedoState {
  undoStack: UndoRedoAction[];
  redoStack: UndoRedoAction[];
  maxSize: number;
}

const STORAGE_KEY = "structify-undo-redo-state";
const MAX_HISTORY_SIZE = 100;

export const getUndoRedoState = (): UndoRedoState => {
  if (typeof window === "undefined") {
    return { undoStack: [], redoStack: [], maxSize: MAX_HISTORY_SIZE };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { undoStack: [], redoStack: [], maxSize: MAX_HISTORY_SIZE };
    }
    const parsed = JSON.parse(stored) as UndoRedoState;
    return {
      ...parsed,
      maxSize: MAX_HISTORY_SIZE,
      undoStack: parsed.undoStack.slice(-MAX_HISTORY_SIZE),
      redoStack: parsed.redoStack.slice(-MAX_HISTORY_SIZE),
    };
  } catch (error) {
    console.error("Failed to load undo/redo state:", error);
    return { undoStack: [], redoStack: [], maxSize: MAX_HISTORY_SIZE };
  }
};

export const saveUndoRedoState = (state: UndoRedoState): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // 限制历史记录大小
    const limitedState = {
      ...state,
      undoStack: state.undoStack.slice(-state.maxSize),
      redoStack: state.redoStack.slice(-state.maxSize),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedState));
  } catch (error) {
    console.error("Failed to save undo/redo state:", error);
  }
};

export const addUndoAction = (action: UndoRedoAction): void => {
  const state = getUndoRedoState();
  state.undoStack.push(action);
  // 添加新操作时，清空 redo 栈
  state.redoStack = [];
  saveUndoRedoState(state);
};

export const canUndo = (): boolean => {
  const state = getUndoRedoState();
  return state.undoStack.length > 0;
};

export const canRedo = (): boolean => {
  const state = getUndoRedoState();
  return state.redoStack.length > 0;
};

export const getUndoAction = (): UndoRedoAction | null => {
  const state = getUndoRedoState();
  if (state.undoStack.length === 0) {
    return null;
  }
  return state.undoStack[state.undoStack.length - 1];
};

export const getRedoAction = (): UndoRedoAction | null => {
  const state = getUndoRedoState();
  if (state.redoStack.length === 0) {
    return null;
  }
  return state.redoStack[state.redoStack.length - 1];
};

export const popUndoAction = (): UndoRedoAction | null => {
  const state = getUndoRedoState();
  if (state.undoStack.length === 0) {
    return null;
  }
  const action = state.undoStack.pop()!;
  saveUndoRedoState(state);
  return action;
};

export const popRedoAction = (): UndoRedoAction | null => {
  const state = getUndoRedoState();
  if (state.redoStack.length === 0) {
    return null;
  }
  const action = state.redoStack.pop()!;
  saveUndoRedoState(state);
  return action;
};

export const pushRedoAction = (action: UndoRedoAction): void => {
  const state = getUndoRedoState();
  state.redoStack.push(action);
  saveUndoRedoState(state);
};

export const pushUndoAction = (action: UndoRedoAction): void => {
  const state = getUndoRedoState();
  state.undoStack.push(action);
  saveUndoRedoState(state);
};

export const clearUndoRedoHistory = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
};

