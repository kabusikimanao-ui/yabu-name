import { escapeHtml, genCode, shuffle, freshDeckValues, PLAYER_COLORS } from './utils.js';
import { t, getCurrentLang, setCurrentLang } from './i18n.js';
import { saveGameState, loadGameState, clearGameState, getOrCreateToken } from './storage.js';
import { buildRoundState, resolveChipsInto, actJoin, redact } from './game-core.js';
import { getNetworkState, setNetworkState, hostBroadcast, sweepClosedConnections, hostHandleRequest, hostSelfAction, sendToHost, clientHandleMessage, startHeartbeat, Net } from './network.js';
import { render, getUIState, setUIState, ensureTurnLocal } from './ui-render.js';

const PeerCtor = (typeof window !== 'undefined' && window.Peer) ? window.Peer : (typeof Peer !== 'undefined' ? Peer : null);
const stage = document.getElementById('stage');

// グローバルに関数を公開 (HTML内のonclick用)
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

window.hostStartGame = function() {
  const { room } = getNetworkState();
  if (room.players.length < 2) return;
  buildRoundState(room);
  hostBroadcast();
};

window.hostAdvanceAfterReveal = function() {
  const { room } = getNetworkState();
  const anyOver = room.players.some(p => p.faceDown >= 8 || p.faceUp <= 0);
  if (anyOver) { room.phase = 'final'; }
  else {
    room.round += 1;
    room.startIdx = (room.startIdx + 1) % room.players.length;
    buildRoundState(room);
  }
  hostBroadcast();
};

window.hostPlayAgain = function() {
  const { room } = getNetworkState();
  room.round = 1; room.startIdx = 0;
  room.players.forEach(p => { p.faceUp = 5; p.faceDown = 0; });
  buildRoundState(room);
  hostBroadcast();
};

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

window.openRulesModal = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box rules-box">
      <h3>${getCurrentLang() === 'ja' ? '遊び方 — 藪の中' : 'How to Play — In a Grove'}</h3>
      <h4>${getCurrentLang() === 'ja' ? '概要' : 'Overview'}</h4>
      <p>${getCurrentLang() === 'ja' ? '竹林で一体の骸が見つかった。現場には「被害者」1枚と「容疑者」3枚の数字タイルが伏せられている。プレイヤーは2〜5人。全員が少しずつ違う手がかりを持ち寄り、証言を重ねながら「本当の犯人」を推理する。' : 'A corpse was found in a bamboo grove. At the scene are 1 "Victim" tile and 3 "Suspect" tiles placed face down. 2-5 players work together to deduce the "true culprit".'}</p>
      <h4>${getCurrentLang() === 'ja' ? '① アリバイ確認フェーズ' : '① Alibi Check Phase'}</h4>
      <p>${getCurrentLang() === 'ja' ? '各ラウンドの最初に、現場の4枚とは別の「事件と無関係な人物」のタイルが、自分と隣の人にそれぞれ配られる。両方を確認すると、除外情報が手に入る。' : 'At the start of each round, tiles of "people unrelated to the case" are dealt to you and your neighbor.'}</p>
      <h4>${getCurrentLang() === 'ja' ? '② 証言フェーズ' : ' Testimony Phase'}</h4>
      <ul>
        <li><b>${getCurrentLang() === 'ja' ? '第一発見者' : 'First Detective'}</b>：${getCurrentLang() === 'ja' ? '容疑者カードをタッチして、好きな2人の数字を覗く。最後に犯人だと思う容疑者にチップを置く。' : 'Touch suspect cards to peek at 2 people\'s numbers. Finally, place your chip on the suspect you believe is the culprit.'}</li>
        <li><b>${getCurrentLang() === 'ja' ? '2番手以降' : '2nd Player Onwards'}</b>：${getCurrentLang() === 'ja' ? '直前の人がチップを置いた容疑者を除く、残り2人の数字を確認できる。' : 'Excluding the suspect where the previous player placed their chip, check the numbers of the remaining 2.'}</li>
      </ul>
      <h4>${getCurrentLang() === 'ja' ? ' 真犯人の見分け方' : '③ Identifying the True Culprit'}</h4>
      <ul>
        <li>${getCurrentLang() === 'ja' ? '「↓5↑」がいる場合 → 最も小さい数字の容疑者が真犯人。' : 'If "↓5↑" is among the suspects → The suspect with the smallest number is the true culprit.'}</li>
        <li>${getCurrentLang() === 'ja' ? '「↓5↑」がいない場合 → 最も大きい数字の容疑者が真犯人。' : 'If "↓5↑" is not present → The suspect with the largest number is the true culprit.'}</li>
      </ul>
      <div class="center" style="margin-top:20px;"><button class="btn primary small" id="closeRules">${getCurrentLang() === 'ja' ? '閉じる' : 'Close'}</button></div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('closeRules').onclick = () => { document.body.removeChild(overlay); };
};

// 言語切り替え
document.getElementById('langBtn').onclick = function() {
  const newLang = getCurrentLang() === 'ja' ? 'en' : 'ja';
  setCurrentLang(newLang);
  this.textContent = newLang === 'ja' ? 'English' : '日本語';
  const { labels } = getUIState();
  setUIState({ labels: newLang === 'ja' ? ['容疑者 A', '容疑者 B', '容疑者 C'] : ['Suspect A', 'Suspect B', 'Suspect C'] });
  render(stage);
};

// チャット初期化
function initChat() {
  const input = document.getElementById('chatInput');
  const send = document.getElementById('chatSend');
  const header = document.getElementById('chatHeader');
  const panel = document.getElementById('chatPanel');

  // 初期状態では非表示
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

// チャットメッセージ受信時の処理
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

// ゲーム状態変更時の処理
window.onGameStateChanged = function(view) {
  render(stage);
  
  // チャットの表示制御
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel && view) {
    // ロビー・ゲーム中はチャットを表示
    chatPanel.style.display = 'block';
  }
};

// ホストのbeforeunload警告
window.addEventListener('beforeunload', (e) => {
  const { isHost, room } = getNetworkState();
  if (isHost && room && room.phase !== 'final' && room.phase !== 'lobby') {
    e.preventDefault();
    e.returnValue = t('tabCloseWarning');
  }
});
// URLパラメータの解析（部屋番号自動入力）
const urlParams = new URLSearchParams(window.location.search);
const roomCodeFromUrl = urlParams.get('room');
if (roomCodeFromUrl) {
  const { ui } = getUIState();
  ui.codeInput = roomCodeFromUrl.toUpperCase();
  ui.screen = 'join';
}
// 初期化
initChat();
render(stage);
