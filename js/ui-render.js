import { getNetworkState } from './network.js';
import { renderDisconnected, renderTitle, renderCreate, renderJoin, renderConnecting } from './views/auth-view.js';
import { renderLobby } from './views/lobby-view.js';
import { renderAlibi, renderTurns, renderReveal, renderFinal } from './views/game-view.js';

// ===== 状態管理 =====
let ui = { screen: 'title', nameInput: '', codeInput: '', customCode: '', useCustomCode: false, expansionChoice: false, joinError: null, createError: null, disconnected: false };
let turnLocal = null;
let alibiLocal = { round: null, shown: false, values: null };
let chatMessages = [];
let chatCollapsed = false;
let labels = ['容疑者 A', '容疑者 B', '容疑者 C'];

// ===== 状態取得・設定 =====
export function getUIState() { return { ui, turnLocal, alibiLocal, chatMessages, chatCollapsed, labels }; }
export function setUIState(state) {
  ui = state.ui ?? ui; turnLocal = state.turnLocal ?? turnLocal;
  alibiLocal = state.alibiLocal ?? alibiLocal; chatMessages = state.chatMessages ?? chatMessages;
  chatCollapsed = state.chatCollapsed ?? chatCollapsed; labels = state.labels ?? labels;
}

// ===== ターンローカル状態の保証 =====
export function ensureTurnLocal(roomView) {
  const key = roomView.round + '-' + roomView.currentPos + '-' + roomView.phase;
  if (!turnLocal || turnLocal.key !== key) {
    turnLocal = { key, evidenceSeen: false, chosenTwo: new Set(), swapChoice: null, swapDecided: false, guessChoice: null, peekedValues: null };
  }
}

// ===== メインrender関数 =====
export function render(stage) {
  stage.innerHTML = '';
  if (ui.disconnected) { renderDisconnected(stage); return; }
  if (ui.screen === 'title') { renderTitle(stage); return; }
  if (ui.screen === 'create') { renderCreate(stage); return; }
  if (ui.screen === 'join') { renderJoin(stage); return; }
  if (ui.screen === 'connecting') { renderConnecting(stage); return; }
  
  const { roomView, myPlayerIndex, isHost } = getNetworkState();
  if (!roomView) { renderConnecting(stage); return; }
  
  if (roomView.phase === 'lobby') { renderLobby(stage); return; }
  if (roomView.phase === 'alibi') { renderAlibi(stage); return; }
  if (roomView.phase === 'turns') { renderTurns(stage); return; }
  if (roomView.phase === 'reveal') { renderReveal(stage); return; }
  if (roomView.phase === 'final') { renderFinal(stage); return; }
}
