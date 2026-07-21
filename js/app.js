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
  ui.screen = 'title'; ui.nameInput = ''; ui.codeInput = ''; ui.customCode = ''; ui.useCustomCode = false; ui.expansionChoice = false; ui.joinError = null
