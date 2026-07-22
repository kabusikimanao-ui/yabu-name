import { escapeHtml, genCode, getURLParam, generateRoomURL } from './utils.js';
import { t, getCurrentLang, setCurrentLang, triggerLangChange, getSupportedLangs, getLangName } from './i18n.js';
import { saveGameState, loadGameState, clearGameState, getOrCreateToken, getMatchHistory, getPlayerStats, getAllPlayerStats, getSettings, updateSettings, isTutorialCompleted, setTutorialCompleted, getNotificationPermission, setNotificationPermission } from './storage.js';
import { buildRoundState, resolveChipsInto, actJoin, redact, finalizeGame, advanceRound, processBotTurnIfNeeded, addBot } from './game-core.js';
import { getNetworkState, setNetworkState, hostBroadcast, sweepClosedConnections, hostHandleRequest, hostSelfAction, sendToHost, clientHandleMessage, startHeartbeat, Net, processBotTurnIfNeeded as netProcessBotTurn } from './network.js';
import { render, getUIState, setUIState, ensureTurnLocal } from './ui-render.js';

const PeerCtor = (typeof window !== 'undefined' && window.Peer) ? window.Peer : (typeof Peer !== 'undefined' ? Peer : null);
const stage = document.getElementById('stage');

// ===== Issue #2: URLパラメータの解析 =====
const urlParams = new URLSearchParams(window.location.search);
const roomCodeFromUrl = urlParams.get('room');
if (roomCodeFromUrl) {
  const { ui } = getUIState();
  ui.codeInput = roomCodeFromUrl.toUpperCase();
  ui.screen = 'join';
}

// ===== Issue #8: ダークモードの初期適用 =====
const settings = getSettings();
if (settings.darkMode) {
  document.documentElement.setAttribute('data-theme', 'dark');
}

// ===== Issue #19: アクセシビリティ設定の初期適用 =====
if (settings.highContrast) {
  document.documentElement.setAttribute('data-contrast', 'high');
}
if (settings.reduceMotion) {
  document.documentElement.setAttribute('data-reduce-motion', 'true');
}
// ===== 部屋作成 =====
window.createRoom = async function() {
  const { ui } = getUIState();
  const name = (ui.nameInput || '').trim() || (getCurrentLang() === 'ja' ? '探偵1' : 'Detective1');
  ui.screen = 'connecting'; ui.createError = null;
  render(stage);

  let code;
  if (ui.useCustomCode && ui.customCode) {
    code = ui.customCode.toUpperCase().trim();
    if (code.length < 3 || code.length > 6) {
      ui.screen = 'create';
      ui.createError = t('codeLengthError');
      render(stage);
      return;
    }
  } else {
    code = genCode();
  }

  let settled = false;
  const p = new Promise(resolve => {
    try {
      const peer = new PeerCtor('yabu-' + code);
      peer.on('open', () => { if (settled) return; settled = true; resolve(peer); });
      peer.on('error', (err) => { if (settled) return; settled = true; try { peer.destroy(); } catch (e) {} resolve(null); });
    } catch (e) { resolve(null); }
  });

  const peer = await p;
  if (!peer) {
    ui.screen = 'create';
    ui.createError = t('roomInUse');
    render(stage);
    return;
  }

  setNetworkState({ isHost: true, peer, room: { code, phase: 'lobby', expansionEnabled: !!ui.expansionChoice, players: [], round: 1, startIdx: 0 } });
  const { room } = getNetworkState();
  const out = actJoin(room, name, 'HOST', null, new Map());
  setNetworkState({ myPlayerIndex: out.result.playerIndex, roomView: redact(room, new Map()) });
  
  peer.on('connection', conn => {
    conn.on('data', msg => hostHandleRequest(conn, msg));
    conn.on('close', () => { hostBroadcast(); });
  });
  
  ui.screen = null;
  startHeartbeat();
  render(stage);
};

// ===== 部屋参加 =====
window.joinRoom = function() {
  const { ui } = getUIState();
  const code = (ui.codeInput || '').trim().toUpperCase();
  const name = (ui.nameInput || '').trim();
  if (!code) { ui.joinError = t('enterCode'); render(stage); return; }
  
  ui.screen = 'connecting'; ui.joinError = null; ui.disconnected = false;
  render(stage);
  
  setNetworkState({ isHost: false });
  const token = getOrCreateToken(code);
  
  try {
    const peer = new PeerCtor();
    setNetworkState({ peer });
    peer.on('open', () => {
      const hostConn = peer.connect('yabu-' + code, { reliable: true });
      setNetworkState({ hostConn });
      hostConn.on('open', async () => {
        const { result, error } = await sendToHost('join', { name, token });
        if (error) {
          ui.screen = 'join'; ui.joinError = error;
          try { peer.destroy(); } catch (e) {}
          render(stage);
          return;
        }
        setNetworkState({ myPlayerIndex: result.playerIndex });
        ui.screen = null;
        render(stage);
      });
      hostConn.on('data', clientHandleMessage);
      hostConn.on('close', () => {
        const { roomView } = getNetworkState();
        if (roomView) { ui.disconnected = true; render(stage); }
      });
    });
    peer.on('error', err => {
      if (ui.screen !== 'connecting') return;
      ui.screen = 'join';
      ui.joinError = (err && err.type === 'peer-unavailable') ? t('roomNotFound') : t('connectionError');
      render(stage);
    });
  } catch (e) {
    ui.screen = 'join';
    ui.joinError = t('connectionError');
    render(stage);
  }
};
// ===== 退出 =====
window.leaveRoom = function() {
  const confirmMsg = t('leaveConfirm');
  if (!confirm(confirmMsg)) return;
  
  const { hostConn, peer, connections } = getNetworkState();
  try { if (hostConn) hostConn.close(); } catch (e) {}
  try { if (peer) peer.destroy(); } catch (e) {}
  
  setNetworkState({ isHost: false, peer: null, hostConn: null, connections: new Map(), room: null, roomView: null, myPlayerIndex: -1 });
  const { ui } = getUIState();
  ui.screen = 'title'; ui.nameInput = ''; ui.codeInput = ''; ui.customCode = ''; ui.useCustomCode = false; ui.expansionChoice = false; ui.joinError = null; ui.createError = null; ui.disconnected = false;
  setUIState({ ui, turnLocal: null, alibiLocal: { round: null, shown: false, values: null }, chatMessages: [], chatCollapsed: false });
  clearGameState();
  render(stage);
};

// ===== ゲーム開始 =====
window.hostStartGame = function() {
  const { room } = getNetworkState();
  if (room.players.length < 2) return;
  buildRoundState(room);
  hostBroadcast();
};

// ===== ラウンド進行 =====
window.hostAdvanceAfterReveal = function() {
  const { room } = getNetworkState();
  const result = advanceRound(room);
  if (result.changed) hostBroadcast();
};

// ===== もう一度 =====
window.hostPlayAgain = function() {
  const { room } = getNetworkState();
  room.round = 1; room.startIdx = 0;
  room.players.forEach(p => { p.faceUp = 5; p.faceDown = 0; });
  buildRoundState(room);
  hostBroadcast();
};

// ===== ゲーム復元 =====
window.restoreGame = function(savedRoom) {
  const code = savedRoom.code;
  let settled = false;
  const p = new Promise(resolve => {
    try {
      const peer = new PeerCtor('yabu-' + code);
      peer.on('open', () => { if (settled) return; settled = true; resolve(peer); });
      peer.on('error', (err) => { if (settled) return; settled = true; try { peer.destroy(); } catch (e) {} resolve(null); });
    } catch (e) { resolve(null); }
  });
  p.then(peer => {
    if (!peer) { alert(t('roomInUse')); return; }
    setNetworkState({ isHost: true, peer, room: savedRoom, myPlayerIndex: 0, roomView: redact(savedRoom, new Map()) });
    peer.on('connection', conn => {
      conn.on('data', msg => hostHandleRequest(conn, msg));
      conn.on('close', () => { hostBroadcast(); });
    });
    const { ui } = getUIState();
    ui.screen = null;
    render(stage);
  });
};

// ===== Issue #17: キックされた時の処理 =====
window.onKicked = function() {
  alert(t('kickedMessage'));
  window.leaveRoom();
};
// ===== Issue #4: ブラウザ通知 =====
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  const current = getNotificationPermission();
  if (current === true) return;
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationPermission(true);
      showNotificationBanner(t('notificationAllowed'));
    } else {
      setNotificationPermission(false);
    }
  } catch (e) {
    console.warn('Notification permission error:', e);
  }
}

function showNotificationBanner(message) {
  const banner = document.createElement('div');
  banner.className = 'notification-banner';
  banner.textContent = message;
  document.body.appendChild(banner);
  setTimeout(() => {
    banner.classList.add('fade-out');
    setTimeout(() => document.body.removeChild(banner), 300);
  }, 3000);
}

function sendTurnNotification(playerName) {
  if (getNotificationPermission() !== true) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  
  try {
    new Notification(t('notificationTitle'), {
      body: `${playerName} - ${t('notificationBody')}`,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔍</text></svg>'
    });
  } catch (e) {}
}

// ===== Issue #13: エモート表示 =====
window.showEmote = function(emote, playerName) {
  const display = document.createElement('div');
  display.className = 'emote-display';
  display.textContent = emote;
  display.setAttribute('aria-label', `${playerName}: ${emote}`);
  document.body.appendChild(display);
  
  setTimeout(() => {
    display.classList.add('fade-out');
    setTimeout(() => {
      if (display.parentNode) document.body.removeChild(display);
    }, 500);
  }, 2500);
};

// ===== Issue #12: チュートリアル =====
window.openTutorialModal = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  
  const steps = [
    t('tutorialStep1'),
    t('tutorialStep2'),
    t('tutorialStep3'),
    t('tutorialStep4')
  ];
  
  const renderStep = (stepIdx) => {
    overlay.innerHTML = `
      <div class="modal-box rules-box">
        <h3>${t('tutorial')} (${stepIdx + 1}/${steps.length})</h3>
        <p style="font-size:15px; line-height:1.8; margin:20px 0;">${steps[stepIdx]}</p>
        <div class="center" style="margin-top:20px; display:flex; gap:10px; justify-content:center;">
          ${stepIdx > 0 ? `<button class="btn small" id="tutPrev">${t('tutorialPrev')}</button>` : ''}
          ${stepIdx < steps.length - 1 ? `<button class="btn primary small" id="tutNext">${t('tutorialNext')}</button>` : `<button class="btn primary small" id="tutFinish">完了</button>`}
          <button class="btn small" id="tutSkip">${t('tutorialSkip')}</button>
        </div>
      </div>
    `;
    
    const prev = document.getElementById('tutPrev');
    const next = document.getElementById('tutNext');
    const finish = document.getElementById('tutFinish');
    const skip = document.getElementById('tutSkip');
    
    if (prev) prev.onclick = () => renderStep(stepIdx - 1);
    if (next) next.onclick = () => renderStep(stepIdx + 1);
    if (finish) finish.onclick = () => {
      setTutorialCompleted();
      document.body.removeChild(overlay);
    };
    if (skip) skip.onclick = () => {
      setTutorialCompleted();
      document.body.removeChild(overlay);
    };
  };
  
  renderStep(0);
  document.body.appendChild(overlay);
};
// ===== チャットメッセージ受信 =====
window.onChatMessage = function(chatMsg) {
  const { chatMessages } = getUIState();
  chatMessages.push(chatMsg);
  if (chatMessages.length > 50) chatMessages.shift();
  setUIState({ chatMessages });
  
  const messages = document.getElementById('chatMessages');
  if (messages) {
    const lang = getCurrentLang();
    messages.innerHTML = chatMessages.map(m => {
      const time = new Date(m.ts).toLocaleTimeString(lang === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      return `<div class="chat-message"><span class="chat-time">[${escapeHtml(time)}]</span><span class="chat-name">${escapeHtml(m.name)}:</span> <span class="chat-text">${escapeHtml(m.text)}</span></div>`;
    }).join('');
    messages.scrollTop = messages.scrollHeight;
  }
  
  const panel = document.getElementById('chatPanel');
  if (panel) panel.style.display = 'block';
};

// ===== ゲーム状態変更 =====
window.onGameStateChanged = function(view) {
  render(stage);
  
  // Issue #4: 手番通知
  if (view && view.phase === 'turns') {
    const { myPlayerIndex } = getNetworkState();
    const curIdx = view.turnOrder[view.currentPos];
    if (curIdx === myPlayerIndex) {
      sendTurnNotification(view.players[myPlayerIndex]?.name);
    }
  }
  
  // Issue #20: ボットターン処理
  if (view && view.phase === 'turns') {
    setTimeout(() => {
      const { isHost } = getNetworkState();
      if (isHost) {
        const { room } = getNetworkState();
        if (room && room.phase === 'turns') {
          const botIdx = room.turnOrder[room.currentPos];
          const bot = room.players[botIdx];
          if (bot && bot.isBot) {
            processBotTurnIfNeeded();
          }
        }
      }
    }, 800);
  }
};

// ===== Issue #14: PWAインストール =====
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.installPWA = async function() {
  if (!deferredPrompt) {
    showNotificationBanner(t('installPrompt'));
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
};

// ===== Issue #19: beforeunload警告 =====
window.addEventListener('beforeunload', (e) => {
  const { isHost, room } = getNetworkState();
  if (isHost && room && room.phase !== 'final' && room.phase !== 'lobby') {
    e.preventDefault();
    e.returnValue = t('tabCloseWarning');
  }
});

// ===== Issue #4: 初回アクセス時に通知許可を促す =====
if (getNotificationPermission() === null && 'Notification' in window) {
  setTimeout(() => {
    requestNotificationPermission();
  }, 3000);
}

// ===== 初期化 =====
initChat();
render(stage);
