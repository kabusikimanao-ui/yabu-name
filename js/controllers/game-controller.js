// js/controllers/game-controller.js
import { genCode } from '../utils.js';
import { t, getCurrentLang } from '../i18n.js';
import { getOrCreateToken, clearGameState } from '../storage.js';
import { buildRoundState, actJoin, redact, advanceRound } from '../game-core.js';
import { getNetworkState, setNetworkState, hostBroadcast, hostHandleRequest, sendToHost, clientHandleMessage, startHeartbeat } from '../network.js';
import { getUIState, setUIState } from '../ui-state.js';
import { render } from '../ui-render.js';

const PeerCtor = (typeof window !== 'undefined' && window.Peer) ? window.Peer : (typeof Peer !== 'undefined' ? Peer : null);
const stage = document.getElementById('stage');

export function createRoom() {
  return async function() {
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
}

export function joinRoom() {
  return function() {
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
}

export function leaveRoom() {
  return function() {
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
}

export function hostStartGame() {
  return function() {
    const { room } = getNetworkState();
    if (room.players.length < 2) return;
    buildRoundState(room);
    hostBroadcast();
  };
}

export function hostAdvanceAfterReveal() {
  return function() {
    const { room } = getNetworkState();
    const result = advanceRound(room);
    if (result.changed) hostBroadcast();
  };
}

export function hostPlayAgain() {
  return function() {
    const { room } = getNetworkState();
    room.round = 1; room.startIdx = 0;
    room.players.forEach(p => { p.faceUp = 5; p.faceDown = 0; });
    buildRoundState(room);
    hostBroadcast();
  };
}

export function restoreGame(savedRoom) {
  return function() {
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
}

export function onKicked() {
  return function() {
    alert(t('kickedMessage'));
    leaveRoom()();
  };
}
