import { computeCulprit, shuffle, freshDeckValues, PLAYER_COLORS } from './utils.js';
import { t, getCurrentLang } from './i18n.js';
import { saveMatchHistory, updatePlayerStats } from './storage.js';

// ===== ラウンド状態の構築 =====
export function buildRoundState(doc) {
  const n = doc.players.length;
  const deck = shuffle(freshDeckValues(n));
  const center = deck.slice(0, 4);
  const rest = deck.slice(4);
  const victimPos = Math.floor(Math.random() * 4);
  const victim = center[victimPos];
  const suspects = center.filter((_, i) => i !== victimPos);
  doc.center = { victim, suspects };
  doc.privateTiles = rest;
  doc.turnOrder = [...Array(n).keys()].map(i => (doc.startIdx + i) % n);
  doc.currentPos = 0;
  doc.guesses = new Array(n).fill(null);
  doc.chipsAt = [[], [], []];
  doc.unseenIdx = null;
  doc.swapInfo = null;
  doc.alibiAcked = new Array(n).fill(false);
  doc.resolutionLog = [];
  doc.culpritIndex = null;
  doc.phase = 'alibi';
}

// ===== チップの精算 =====
export function resolveChipsInto(doc) {
  const labels = getCurrentLang() === 'ja' ? ['容疑者 A', '容疑者 B', '容疑者 C'] : ['Suspect A', 'Suspect B', 'Suspect C'];
  const culprit = computeCulprit(doc.center.suspects);
  const log = [];
  for (let i = 0; i < 3; i++) {
    const chips = doc.chipsAt[i];
    if (chips.length === 0) continue;
    if (i === culprit) {
      const names = chips.map(pi => doc.players[pi].name);
      log.push({
        correct: true, icon: '✓',
        text: getCurrentLang() === 'ja'
          ? `${labels[i]}（正解）を指した ${names.join('・')} のチップは無事に戻った。`
          : `Chips from ${names.join(', ')} pointing to ${labels[i]} (correct) returned safely.`
      });
    } else {
      const collector = chips[chips.length - 1];
      const names = chips.map(pi => doc.players[pi].name);
      chips.forEach(pi => { doc.players[pi].faceUp = Math.max(0, doc.players[pi].faceUp - 1); });
      doc.players[collector].faceDown += chips.length;
      log.push({
        correct: false, icon: '✗',
        text: getCurrentLang() === 'ja'
          ? `${labels[i]}（外れ）——最後にチップを置いた ${doc.players[collector].name} が、${names.join('・')} のチップ計${chips.length}枚をまとめて失敗チップとして引き取った。`
          : `${labels[i]} (wrong) — ${doc.players[collector].name}, who placed the last chip, took all ${chips.length} chips from ${names.join(', ')} as failure chips.`
      });
    }
  }
  doc.culpritIndex = culprit;
  doc.resolutionLog = log;
}

// ===== 接続フラグの計算 =====
export function computeConnectedFlags(room, connections) {
  const flags = room.players.map((_, i) => i === 0);
  if (connections) {
    connections.forEach(({ conn, playerIndex }) => { if (conn && conn.open) flags[playerIndex] = true; });
  }
  return flags;
}

// ===== 情報の隠蔽（他プレイヤーに見せない） =====
export function redact(r, connections) {
  const clone = JSON.parse(JSON.stringify(r));
  const showCenter = clone.phase === 'reveal' || clone.phase === 'final';
  if (clone.center) {
    clone.center = showCenter ? clone.center : { victim: null, suspects: clone.center.suspects.map(() => null) };
  }
  delete clone.privateTiles;
  delete clone._pendingUnseen;
  const flags = computeConnectedFlags(r, connections);
  clone.players.forEach((p, i) => { p.connected = flags[i]; });
  return clone;
}

// ===== Issue #1: 参加アクション =====
export function actJoin(doc, name, connId, token, connections) {
  if (token) {
    const existingIdx = doc.players.findIndex(p => p.token && p.token === token);
    if (existingIdx >= 0) {
      if (name) doc.players[existingIdx].name = name;
      return { result: { playerIndex: existingIdx, reconnected: true }, changed: true };
    }
  }
  if (name) {
    const flags = computeConnectedFlags(doc, connections);
    const candidateIdx = doc.players.findIndex((p, i) => p.name === name && !flags[i]);
    if (candidateIdx >= 0) {
      if (token) doc.players[candidateIdx].token = token;
      return { result: { playerIndex: candidateIdx, reconnected: true }, changed: true };
    }
  }
  if (doc.phase !== 'lobby') return { error: t('gameStartedError') };
  if (doc.players.length >= 5) return { error: t('roomFullError') };
  const idx = doc.players.length;
  doc.players.push({
    id: connId || 'HOST', token: token || null,
    name: name || (getCurrentLang() === 'ja' ? `探偵${idx + 1}` : `Detective${idx + 1}`),
    color: PLAYER_COLORS[idx],
    faceUp: 5, faceDown: 0,
    isBot: false
  });
  return { result: { playerIndex: idx, reconnected: false }, changed: true };
}

// ===== Issue #20: ボットの追加 =====
export function addBot(doc, botName) {
  if (doc.players.length >= 5) return { error: t('roomFullError') };
  const idx = doc.players.length;
  doc.players.push({
    id: 'BOT_' + idx,
    token: null,
    name: botName || (getCurrentLang() === 'ja' ? `ボット${idx}` : `Bot${idx}`),
    color: PLAYER_COLORS[idx],
    faceUp: 5, faceDown: 0,
    isBot: true
  });
  return { result: { playerIndex: idx }, changed: true };
}

// ===== Issue #20: ボットの自動アクション =====
export function actBotMove(doc, botIndex) {
  if (doc.phase !== 'turns' || doc.turnOrder[doc.currentPos] !== botIndex) {
    return { error: 'Not bot turn' };
  }
  // 簡易AI：ランダムに選択（後で改善可能）
  const available = [0, 1, 2];
  const guessIdx = available[Math.floor(Math.random() * available.length)];
  return actGuess(doc, botIndex, guessIdx);
}

// ===== 証拠確認（peek） =====
export function actPeek(doc, senderIdx, indices) {
  if (doc.phase !== 'turns' || doc.turnOrder[doc.currentPos] !== senderIdx)
    return { error: t('notYourTurn') };
  const isStart = doc.currentPos === 0;
  let use;
  if (isStart) {
    const req = Array.isArray(indices) ? [...new Set(indices)] : [];
    if (req.length !== 2 || req.some(i => ![0, 1, 2].includes(i)))
      return { error: t('invalidRequest') };
    use = req;
    doc._pendingUnseen = [0, 1, 2].find(x => !use.includes(x));
  } else {
    const prevPlayer = doc.turnOrder[doc.currentPos - 1];
    const excluded = doc.guesses[prevPlayer];
    use = [0, 1, 2].filter(x => x !== excluded);
  }
  const values = {};
  use.forEach(i => { values[i] = doc.center.suspects[i]; });
  return { result: { values }, changed: false };
}

// ===== アリバイ確認 =====
export function actAlibi(doc, senderIdx) {
  if (doc.phase !== 'alibi') return { error: t('wrongPhase') };
  const n = doc.players.length;
  const neighbor = (senderIdx + 1) % n;
  return {
    result: {
      mine: doc.privateTiles[senderIdx],
      neighbor: doc.privateTiles[neighbor],
      neighborName: doc.players[neighbor].name
    }, changed: false
  };
}

export function actAckAlibi(doc, senderIdx) {
  if (doc.phase !== 'alibi') return { error: t('wrongPhase') };
  doc.alibiAcked[senderIdx] = true;
  if (doc.alibiAcked.every(Boolean)) { doc.phase = 'turns'; doc.currentPos = 0; }
  return { result: { ok: true }, changed: true };
}

// ===== 拡張ルール：入れ替え =====
export function actSwap(doc, senderIdx, choice) {
  if (doc.phase !== 'turns' || doc.currentPos !== 0 || doc.turnOrder[0] !== senderIdx || !doc.expansionEnabled)
    return { error: t('invalidRequest') };
  if (choice !== 'skip') {
    if (![0, 1, 2].includes(choice)) return { error: t('invalidRequest') };
    const tmp = doc.center.suspects[choice];
    doc.center.suspects[choice] = doc.center.victim;
    doc.center.victim = tmp;
    doc.swapInfo = { index: choice };
  }
  return { result: { ok: true }, changed: true };
}

// ===== 犯人推測 =====
export function actGuess(doc, senderIdx, suspectIdx) {
  if (doc.phase !== 'turns' || doc.turnOrder[doc.currentPos] !== senderIdx)
    return { error: t('notYourTurn') };
  if (![0, 1, 2].includes(suspectIdx)) return { error: t('invalidRequest') };
  if (doc.currentPos === 0 && doc._pendingUnseen !== undefined) {
    doc.unseenIdx = doc._pendingUnseen;
    delete doc._pendingUnseen;
  }
  doc.guesses[senderIdx] = suspectIdx;
  doc.chipsAt[suspectIdx].push(senderIdx);
  if (doc.currentPos === doc.players.length - 1) {
    resolveChipsInto(doc);
    doc.phase = 'reveal';
  } else {
    doc.currentPos += 1;
  }
  return { result: { ok: true }, changed: true };
}

// ===== Issue #16: 名前変更 =====
export function actChangeName(doc, playerIdx, newName) {
  if (!newName || newName.trim().length === 0) {
    return { error: 'Invalid name' };
  }
  if (playerIdx < 0 || playerIdx >= doc.players.length) {
    return { error: 'Invalid player' };
  }
  const oldName = doc.players[playerIdx].name;
  doc.players[playerIdx].name = newName.trim();
  return { result: { oldName, newName: doc.players[playerIdx].name }, changed: true };
}

// ===== Issue #17: キック =====
export function actKick(doc, hostIdx, targetIdx) {
  if (hostIdx !== 0) return { error: 'Only host can kick' };
  if (targetIdx <= 0 || targetIdx >= doc.players.length) return { error: 'Invalid target' };
  const kicked = doc.players[targetIdx];
  doc.players.splice(targetIdx, 1);
  // インデックスの再調整
  if (doc.turnOrder) {
    doc.turnOrder = doc.turnOrder.map(i => {
      if (i === targetIdx) return -1;
      return i > targetIdx ? i - 1 : i;
    }).filter(i => i >= 0);
  }
  return { result: { kicked: kicked.name }, changed: true };
}

// ===== Issue #9: 対戦終了時の履歴保存 =====
export function finalizeGame(doc) {
  const minFaceDown = Math.min(...doc.players.map(p => p.faceDown));
  const winners = doc.players.filter(p => p.faceDown === minFaceDown).map(p => p.name);
  
  // 対戦履歴を保存
  saveMatchHistory({
    code: doc.code,
    round: doc.round,
    players: doc.players.map(p => p.name),
    winners,
    expansionEnabled: doc.expansionEnabled,
    playerStats: doc.players.map(p => ({
      name: p.name,
      faceUp: p.faceUp,
      faceDown: p.faceDown,
      correctGuesses: 0,
      totalGuesses: 1
    }))
  });
  
  // 各プレイヤーの統計を更新
  doc.players.forEach(p => {
    updatePlayerStats(p.name, {
      isWinner: winners.includes(p.name),
      faceDown: p.faceDown,
      correctGuesses: 0,
      totalGuesses: 1
    });
  });
  
  doc.phase = 'final';
  return { result: { winners }, changed: true };
}

// ===== ラウンド進行 =====
export function advanceRound(doc) {
  const anyOver = doc.players.some(p => p.faceDown >= 8 || p.faceUp <= 0);
  if (anyOver) {
    return finalizeGame(doc);
  }
  doc.round += 1;
  doc.startIdx = (doc.startIdx + 1) % doc.players.length;
  buildRoundState(doc);
  return { result: { ok: true }, changed: true };
}

// ===== Issue #20: ボットターン処理 =====
export function processBotTurn(doc) {
  const botIdx = doc.turnOrder[doc.currentPos];
  const bot = doc.players[botIdx];
  if (!bot || !bot.isBot) return { result: { isBot: false } };
  
  // ボットのアクション
  const result = actBotMove(doc, botIdx);
  return { result: { isBot: true, botName: bot.name, action: result } };
}
