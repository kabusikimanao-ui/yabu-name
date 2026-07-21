import { redact, actJoin, actPeek, actAlibi, actAckAlibi, actSwap, actGuess } from './game-core.js';
import { saveGameState } from './storage.js';
import { t, getCurrentLang } from './i18n.js';

let isHost = false;
let peer = null;
let hostConn = null;
let connections = new Map();
let room = null;
let roomView = null;
let myPlayerIndex = -1;
let reqCounter = 0;
let pending = new Map();

export function getNetworkState() {
  return { isHost, peer, hostConn, connections, room, roomView, myPlayerIndex };
}

export function setNetworkState(state) {
  isHost = state.isHost ?? isHost;
  peer = state.peer ?? peer;
  hostConn = state.hostConn ?? hostConn;
  connections = state.connections ?? connections;
  room = state.room ?? room;
  roomView = state.roomView ?? roomView;
  myPlayerIndex = state.myPlayerIndex ?? myPlayerIndex;
}

export function sweepClosedConnections() {
  connections.forEach((v, k) => {
    if (!v.conn.open) connections.delete(k);
  });
}

// ホスト側: 状態をブロードキャスト
export function hostBroadcast() {
  if (!room) return;
  const view = redact(room, connections);
  roomView = view;
  connections.forEach(({ conn }) => {
    if (conn && conn.open) conn.send({ type: 'state', payload: view });
  });
  saveGameState(room);
  // UI更新は app.js 側でイベントリスナー経由で行うか、コールバックで処理する
  if (window.onGameStateChanged) window.onGameStateChanged(view);
}

// ホスト側: クライアントからの要求を処理
export function hostHandleRequest(conn, msg) {
  const liveEntry = connections.get(conn.peer);
  if (liveEntry) liveEntry.lastPong = Date.now();

  if (msg.type === 'pong') return;
  
  if (msg.type === 'chat') {
    const entry = connections.get(conn.peer);
    const senderName = entry ? room.players[entry.playerIndex]?.name : t('unknown');
    const chatMsg = { name: senderName, text: msg.payload.text, ts: Date.now() };
    broadcastChat(chatMsg);
    return;
  }

  let out;
  if (msg.type === 'join') {
    out = actJoin(room, msg.payload.name, conn.peer, msg.payload.token, connections);
    if (!out.error) {
      sweepClosedConnections();
      connections.set(conn.peer, { conn, playerIndex: out.result.playerIndex, lastPong: Date.now() });
    }
  } else {
    const entry = connections.get(conn.peer);
    const senderIdx = entry ? entry.playerIndex : -1;
    if (msg.type === 'peek') out = actPeek(room, senderIdx, msg.payload.indices);
    else if (msg.type === 'alibi') out = actAlibi(room, senderIdx);
    else if (msg.type === 'ackAlibi') out = actAckAlibi(room, senderIdx);
    else if (msg.type === 'swap') out = actSwap(room, senderIdx, msg.payload.choice);
    else if (msg.type === 'guess') out = actGuess(room, senderIdx, msg.payload.suspectIdx);
    else out = { error: t('unknownRequest') };
  }

  try {
    conn.send({ type: 'response', id: msg.id, payload: out.result || null, error: out.error || null });
  } catch (e) {}

  if (out.changed) hostBroadcast();
}

// ホスト側: 自分自身のアクションを処理
export function hostSelfAction(type, payload) {
  let out;
  if (type === 'peek') out = actPeek(room, myPlayerIndex, payload.indices);
  else if (type === 'alibi') out = actAlibi(room, myPlayerIndex);
  else if (type === 'ackAlibi') out = actAckAlibi(room, myPlayerIndex);
  else if (type === 'swap') out = actSwap(room, myPlayerIndex, payload.choice);
  else if (type === 'guess') out = actGuess(room, myPlayerIndex, payload.suspectIdx);
  
  if (out.changed) hostBroadcast();
  return Promise.resolve({ result: out.result || null, error: out.error || null });
}

// クライアント側: ホストへ要求を送信
export function sendToHost(type, payload) {
  return new Promise((resolve) => {
    const id = ++reqCounter;
    pending.set(id, resolve);
    if (hostConn && hostConn.open) {
      hostConn.send({ type, id, payload });
    } else {
      resolve({ error: t('notConnected') });
    }
  });
}

// ネットワーク操作の統一インターフェース
export const Net = {
  peek(indices) {
    return isHost ? hostSelfAction('peek', { indices }) : sendToHost('peek', { indices });
  },
  alibi() {
    return isHost ? hostSelfAction('alibi', {}) : sendToHost('alibi', {});
  },
  ackAlibi() {
    return isHost ? hostSelfAction('ackAlibi', {}) : sendToHost('ackAlibi', {});
  },
  swap(choice) {
    return isHost ? hostSelfAction('swap', { choice }) : sendToHost('swap', { choice });
  },
  guess(suspectIdx) {
    return isHost ? hostSelfAction('guess', { suspectIdx }) : sendToHost('guess', { suspectIdx });
  },
  chat(text) {
    if (isHost) {
      const chatMsg = { name: room.players[myPlayerIndex]?.name || t('youChat'), text, ts: Date.now() };
      broadcastChat(chatMsg);
    } else {
      hostConn.send({ type: 'chat', payload: { text } });
    }
  }
};

// チャットブロードキャスト
export function broadcastChat(chatMsg) {
  if (window.onChatMessage) window.onChatMessage(chatMsg);
  connections.forEach(({ conn }) => {
    if (conn && conn.open) conn.send({ type: 'chat', payload: chatMsg });
  });
}

// クライアント側: ホストからのメッセージを処理
export function clientHandleMessage(msg) {
  if (msg.type === 'ping') {
    try { hostConn.send({ type: 'pong', ts: msg.ts }); } catch (e) {}
    return;
  }
  if (msg.type === 'state') {
    roomView = msg.payload;
    if (window.onGameStateChanged) window.onGameStateChanged(msg.payload);
    return;
  }
  if (msg.type === 'chat') {
    if (window.onChatMessage) window.onChatMessage(msg.payload);
    return;
  }
  if (msg.type === 'response') {
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve({ result: msg.payload, error: msg.error });
    }
  }
}

// ハートビート管理（ホスト側）
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_STALE_MS = 30000;

export function startHeartbeat() {
  setInterval(() => {
    if (!isHost || !room) return;
    const now = Date.now();
    connections.forEach(entry => {
      const { conn } = entry;
      if (!conn || !conn.open) return;
      if (entry.lastPong && (now - entry.lastPong) > HEARTBEAT_STALE_MS) {
        try { conn.close(); } catch (e) {}
        return;
      }
      try { conn.send({ type: 'ping', ts: now }); } catch (e) {}
    });
  }, HEARTBEAT_INTERVAL_MS);
}

// グローバルに公開（簡易イベントハンドラ用）
window.Net = Net;
