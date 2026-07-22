// js/app.js
import { getURLParam } from './utils.js';
import { getCurrentLang, triggerLangChange, getLangName } from './i18n.js';
import { getSettings, updateSettings, isTutorialCompleted, getNotificationPermission } from './storage.js';
import { getNetworkState, processBotTurnIfNeeded } from './network.js';
import { render } from './ui-render.js';
import { getUIState, setUIState } from './ui-state.js';
import { createRoom, joinRoom, leaveRoom, hostStartGame, hostAdvanceAfterReveal, hostPlayAgain, restoreGame, onKicked } from './controllers/game-controller.js';
import { openTutorialModal, openHistoryModal, openStatsModal, openRulesModal, showEmote } from './controllers/modal-controller.js';
import { initChat, handleChatMessage } from './features/chat.js';
import { requestNotificationPermission, showNotificationBanner, sendTurnNotification } from './features/notifications.js';

const stage = document.getElementById('stage');

// ===== グローバル関数の登録 =====
window.createRoom = createRoom();
window.joinRoom = joinRoom();
window.leaveRoom = leaveRoom();
window.hostStartGame = hostStartGame();
window.hostAdvanceAfterReveal = hostAdvanceAfterReveal();
window.hostPlayAgain = hostPlayAgain();
window.restoreGame = restoreGame();
window.onKicked = onKicked();
window.showEmote = showEmote;
window.openTutorialModal = openTutorialModal;
window.openHistoryModal = openHistoryModal;
window.openStatsModal = openStatsModal;
window.openRulesModal = openRulesModal;
window.onChatMessage = handleChatMessage;
window.installPWA = async function() {
  if (!window.deferredPrompt) {
    showNotificationBanner('ホーム画面に追加してアプリのように使えます');
    return;
  }
  window.deferredPrompt.prompt();
  const { outcome } = await window.deferredPrompt.userChoice;
  window.deferredPrompt = null;
};

// ===== 初期状態の設定 =====
const urlParams = new URLSearchParams(window.location.search);
const roomCodeFromUrl = urlParams.get('room');
if (roomCodeFromUrl) {
  const { ui } = getUIState();
  ui.codeInput = roomCodeFromUrl.toUpperCase();
  ui.screen = 'join';
}

const settings = getSettings();
if (settings.darkMode) document.documentElement.setAttribute('data-theme', 'dark');
if (settings.highContrast) document.documentElement.setAttribute('data-contrast', 'high');
if (settings.reduceMotion) document.documentElement.setAttribute('data-reduce-motion', 'true');

// ===== イベントリスナーの設定 =====
document.getElementById('langBtn').onclick = function() {
  const newLang = getCurrentLang() === 'ja' ? 'en' : 'ja';
  triggerLangChange(newLang);
  this.textContent = getLangName(newLang === 'ja' ? 'en' : 'ja');
  const { labels } = getUIState();
  setUIState({ labels: newLang === 'ja' ? ['容疑者 A', '容疑者 B', '容疑者 C'] : ['Suspect A', 'Suspect B', 'Suspect C'] });
  render(stage);
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
});

window.addEventListener('beforeunload', (e) => {
  const { isHost, room } = getNetworkState();
  if (isHost && room && room.phase !== 'final' && room.phase !== 'lobby') {
    e.preventDefault();
    e.returnValue = 'ゲームが進行中です。タブを閉じると部屋が削除されます。';
  }
});

// ===== ゲーム状態変更時のフック =====
window.onGameStateChanged = function(view) {
  render(stage);
  
  if (view && view.phase === 'turns') {
    const { myPlayerIndex } = getNetworkState();
    const curIdx = view.turnOrder[view.currentPos];
    if (curIdx === myPlayerIndex) {
      sendTurnNotification(view.players[myPlayerIndex]?.name);
    }
  }
  
  if (view && view.phase === 'turns') {
    setTimeout(() => {
      processBotTurnIfNeeded();
    }, 800);
  }
};

// ===== 初期化実行 =====
initChat();
render(stage);

if (getNotificationPermission() === null && 'Notification' in window) {
  setTimeout(() => {
    requestNotificationPermission();
  }, 3000);
}
