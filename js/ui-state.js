// js/ui-state.js
// UI の共有状態と ensureTurnLocal を提供する純粋な状態モジュール

let ui = { screen: 'title', nameInput: '', codeInput: '', customCode: '', useCustomCode: false, expansionChoice: false, joinError: null, createError: null, disconnected: false };
let turnLocal = null;
let alibiLocal = { round: null, shown: false, values: null };
let chatMessages = [];
let chatCollapsed = false;
let labels = ['容疑者 A', '容疑者 B', '容疑者 C'];

export function getUIState() {
  return { ui, turnLocal, alibiLocal, chatMessages, chatCollapsed, labels };
}

export function setUIState(state) {
  ui = state.ui ?? ui;
  turnLocal = state.turnLocal ?? turnLocal;
  alibiLocal = state.alibiLocal ?? alibiLocal;
  chatMessages = state.chatMessages ?? chatMessages;
  chatCollapsed = state.chatCollapsed ?? chatCollapsed;
  labels = state.labels ?? labels;
}

export function ensureTurnLocal(roomView) {
  if (!roomView) return;
  const key = roomView.round + '-' + roomView.currentPos + '-' + roomView.phase;
  if (!turnLocal || turnLocal.key !== key) {
    turnLocal = { key, evidenceSeen: false, chosenTwo: new Set(), swapChoice: null, swapDecided: false, guessChoice: null, peekedValues: null };
  }
}
