import { escapeHtml, genCode, getURLParam, generateRoomURL } from './utils.js';
import { t, getCurrentLang, setCurrentLang, triggerLangChange, getSupportedLangs, getLangName } from './i18n.js';
import { saveGameState, loadGameState, clearGameState, getOrCreateToken, getMatchHistory, getPlayerStats, getAllPlayerStats, getSettings, updateSettings, isTutorialCompleted, setTutorialCompleted, getNotificationPermission, setNotificationPermission } from './storage.js';
import { buildRoundState, resolveChipsInto, actJoin, redact, finalizeGame, advanceRound, addBot } from './game-core.js';
import { getNetworkState, setNetworkState, hostBroadcast, sweepClosedConnections, hostHandleRequest, hostSelfAction, sendToHost, clientHandleMessage, startHeartbeat, Net, processBotTurnIfNeeded } from './network.js';
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
      icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ctext y=".9em" font-size="90"%3E🔍%3C/text%3E%3C/svg%3E'
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
  
  // 【修正点】overlay を先に DOM に追加
  document.body.appendChild(overlay);
  
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
    
    // 【修正点】overlay.querySelector を使用
    const prev = overlay.querySelector('#tutPrev');
    const next = overlay.querySelector('#tutNext');
    const finish = overlay.querySelector('#tutFinish');
    const skip = overlay.querySelector('#tutSkip');
    
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
};

// ===== Issue #9: 対戦履歴 =====
window.openHistoryModal = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  
  const history = getMatchHistory();
  let content = '';
  if (history.length === 0) {
    content = `<p style="text-align:center; color:var(--ink-soft);">${t('noHistory')}</p>`;
  } else {
    content = history.map(h => {
      const date = new Date(h.timestamp).toLocaleDateString(getCurrentLang() === 'ja' ? 'ja-JP' : 'en-US');
      const winners = (h.winners || []).join('・');
      return `
        <div style="padding:12px; background:#f4ecd6; border-left:4px solid var(--gold); margin-bottom:8px; border-radius:0 8px 8px 0;">
          <div style="font-size:12px; color:var(--ink-soft);">${date} · ${t('round')} ${h.round || 1}</div>
          <div style="font-size:13px; margin-top:4px;">${t('winner')}: <strong style="color:var(--blood);">${escapeHtml(winners)}</strong></div>
          <div style="font-size:11px; color:var(--ink-soft); margin-top:4px;">${(h.players || []).join('・')}</div>
        </div>
      `;
    }).join('');
  }
  
  overlay.innerHTML = `
    <div class="modal-box rules-box">
      <h3>${t('history')}</h3>
      ${content}
      <div class="center" style="margin-top:20px;"><button class="btn primary small" id="closeHistory">${getCurrentLang() === 'ja' ? '閉じる' : 'Close'}</button></div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.getElementById('closeHistory').onclick = () => document.body.removeChild(overlay);
};

// ===== Issue #10: 統計 =====
window.openStatsModal = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  
  const allStats = getAllPlayerStats();
  const playerNames = Object.keys(allStats);
  let content = '';
  if (playerNames.length === 0) {
    content = `<p style="text-align:center; color:var(--ink-soft);">${t('noHistory')}</p>`;
  } else {
    content = playerNames.map(name => {
      const s = allStats[name];
      const winRate = s.totalGames > 0 ? ((s.wins / s.totalGames) * 100).toFixed(1) : '0.0';
      const avgFail = s.totalGames > 0 ? (s.totalFailChips / s.totalGames).toFixed(1) : '0.0';
      const correctRate = s.totalGuesses > 0 ? ((s.totalCorrectGuesses / s.totalGuesses) * 100).toFixed(1) : '0.0';
      return `
        <div style="padding:12px; background:#f4ecd6; border-left:4px solid var(--bamboo); margin-bottom:8px; border-radius:0 8px 8px 0;">
          <div style="font-size:14px; font-weight:600; color:var(--ink);">${escapeHtml(name)}</div>
          <div style="font-size:12px; color:var(--ink-soft); margin-top:4px;">
            ${t('totalGames')}: ${s.totalGames} · 
            ${t('winRate')}: ${winRate}% · 
            ${t('avgFailChips')}: ${avgFail} · 
            ${t('correctRate')}: ${correctRate}%
          </div>
        </div>
      `;
    }).join('');
  }
  
  overlay.innerHTML = `
    <div class="modal-box rules-box">
      <h3>${t('stats')}</h3>
      ${content}
      <div class="center" style="margin-top:20px;"><button class="btn primary small" id="closeStats">${getCurrentLang() === 'ja' ? '閉じる' : 'Close'}</button></div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.getElementById('closeStats').onclick = () => document.body.removeChild(overlay);
};

// ===== ルールモーダル =====
window.openRulesModal = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  
  const lang = getCurrentLang();
  overlay.innerHTML = `
    <div class="modal-box rules-box">
      <h3>${lang === 'ja' ? '遊び方 — 藪の中' : 'How to Play — In a Grove'}</h3>
      <h4>${lang === 'ja' ? '概要' : 'Overview'}</h4>
      <p>${lang === 'ja' ? '竹林で一体の骸が見つかった。現場には「被害者」1枚と「容疑者」3枚の数字タイルが伏せられている。プレイヤーは2〜5人。全員が少しずつ違う手がかりを持ち寄り、証言を重ねながら「本当の犯人」を推理する。' : 'A corpse was found in a bamboo grove. At the scene are 1 "Victim" tile and 3 "Suspect" tiles placed face down. 2-5 players work together to deduce the "true culprit".'}</p>
      <h4>${lang === 'ja' ? '① アリバイ確認フェーズ' : '① Alibi Check Phase'}</h4>
      <p>${lang === 'ja' ? '各ラウンドの最初に、現場の4枚とは別の「事件と無関係な人物」のタイルが、自分と隣の人にそれぞれ配られる。両方を確認すると、除外情報が手に入る。' : 'At the start of each round, tiles of "people unrelated to the case" are dealt to you and your neighbor.'}</p>
      <h4>${lang === 'ja' ? '② 証言フェーズ' : '② Testimony Phase'}</h4>
      <ul>
        <li><b>${lang === 'ja' ? '第一発見者' : 'First Detective'}</b>：${lang === 'ja' ? '容疑者カードをタッチして、好きな2人の数字を覗く。最後に犯人だと思う容疑者にチップを置く。' : "Touch suspect cards to peek at 2 people's numbers. Finally, place your chip on the suspect you believe is the culprit."}</li>
        <li><b>${lang === 'ja' ? '2番手以降' : '2nd Player Onwards'}</b>：${lang === 'ja' ? '直前の人がチップを置いた容疑者を除く、残り2人の数字を確認できる。' : "Excluding the suspect where the previous player placed their chip, check the numbers of the remaining 2."}</li>
      </ul>
      <h4>${lang === 'ja' ? '③ 真犯人の見分け方' : '③ Identifying the True Culprit'}</h4>
      <ul>
        <li>${lang === 'ja' ? '「↓5↑」がいる場合 → 最も小さい数字の容疑者が真犯人。' : 'If "↓5↑" is among the suspects → The suspect with the smallest number is the true culprit.'}</li>
        <li>${lang === 'ja' ? '「↓5↑」がいない場合 → 最も大きい数字の容疑者が真犯人。' : 'If "↓5↑" is not present → The suspect with the largest number is the true culprit.'}</li>
      </ul>
      <h4>${lang === 'ja' ? '④ チップの精算' : '④ Chip Settlement'}</h4>
      <ul>
        <li>${lang === 'ja' ? '真犯人にチップを置いていた人は、チップが無事に戻ってくる。' : 'Players who placed chips on the true culprit get their chips back safely.'}</li>
        <li>${lang === 'ja' ? '外れた容疑者にチップを置いていた人たちは、全員「手持ち」を1枚失う。さらに、その山に最後にチップを置いた人が、山にあったチップ全部を「失敗チップ」としてまとめて引き取る。' : 'Players who placed chips on wrong suspects each lose 1 "hand" chip. Furthermore, the person who placed the last chip on that pile takes all chips from that pile as "failure chips".'}</li>
      </ul>
      <h4>${lang === 'ja' ? '⑤ 終了と勝敗' : '⑤ End Game & Victory'}</h4>
      <p>${lang === 'ja' ? 'ラウンド終了時に、誰かの「失敗チップ」が8枚以上、または「手持ち」が0枚になっていたら、そこで捜査終了。「失敗チップ」が最も少ない人が勝者。' : 'At round end, if anyone has 8 or more "failure chips" or 0 "hand" chips, the investigation ends. The player with the fewest "failure chips" wins.'}</p>
      <div class="rule-note">${t('flip5')}</div>
      <div class="center" style="margin-top:20px;"><button class="btn primary small" id="closeRules">${lang === 'ja' ? '閉じる' : 'Close'}</button></div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.getElementById('closeRules').onclick = () => document.body.removeChild(overlay);
};

// ===== 言語切り替え =====
document.getElementById('langBtn').onclick = function() {
  const newLang = getCurrentLang() === 'ja' ? 'en' : 'ja';
  triggerLangChange(newLang);
  this.textContent = getLangName(newLang === 'ja' ? 'en' : 'ja');
  const { labels } = getUIState();
  setUIState({ labels: newLang === 'ja' ? ['容疑者 A', '容疑者 B', '容疑者 C'] : ['Suspect A', 'Suspect B', 'Suspect C'] });
  render(stage);
};

// ===== チャット初期化 =====
function initChat() {
  const input = document.getElementById('chatInput');
  const send = document.getElementById('chatSend');
  const header = document.getElementById('chatHeader');
  const panel = document.getElementById('chatPanel');

  if (panel) panel.style.display = 'none';

  if (header) {
    header.onclick = function() {
      const { chatCollapsed } = getUIState();
      const newCollapsed = !chatCollapsed;
      setUIState({ chatCollapsed: newCollapsed });
      if (panel) {
        if (newCollapsed) panel.classList.add('collapsed');
        else panel.classList.remove('collapsed');
      }
    };
  }

  if (!input || !send) return;
  send.onclick = () => {
    const text = input.value.trim();
    if (!text) return;
    Net.chat(text);
    input.value = '';
  };
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send.click();
  });
}

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
