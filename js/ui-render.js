import { escapeHtml, formatFlipValue, isFlipValue, PLAYER_COLORS } from './utils.js';
import { t, getCurrentLang } from './i18n.js';
import { loadGameState, clearGameState } from './storage.js';
import { getNetworkState, setNetworkState, Net } from './network.js';

let ui = { screen: 'title', nameInput: '', codeInput: '', customCode: '', useCustomCode: false, expansionChoice: false, joinError: null, createError: null, disconnected: false };
let turnLocal = null;
let alibiLocal = { round: null, shown: false, values: null };
let chatMessages = [];
let chatCollapsed = false;
let labels = ['容疑者 A', '容疑者 B', '容疑者 C'];

export function getUIState() { return { ui, turnLocal, alibiLocal, chatMessages, chatCollapsed, labels }; }
export function setUIState(state) {
  ui = state.ui ?? ui; turnLocal = state.turnLocal ?? turnLocal;
  alibiLocal = state.alibiLocal ?? alibiLocal; chatMessages = state.chatMessages ?? chatMessages;
  chatCollapsed = state.chatCollapsed ?? chatCollapsed; labels = state.labels ?? labels;
}

export function ensureTurnLocal(roomView) {
  const key = roomView.round + '-' + roomView.currentPos + '-' + roomView.phase;
  if (!turnLocal || turnLocal.key !== key) {
    turnLocal = { key, evidenceSeen: false, chosenTwo: new Set(), swapChoice: null, swapDecided: false, guessChoice: null, peekedValues: null };
  }
}

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
  
  // チャットの表示制御
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) {
    // タイトル画面・作成画面・参加画面・接続中は非表示
    if (ui.screen === 'title' || ui.screen === 'create' || ui.screen === 'join' || ui.screen === 'connecting') {
      chatPanel.style.display = 'none';
    } else {
      // ロビー・ゲーム中は表示
      chatPanel.style.display = 'block';
    }
  }
}

function renderDisconnected(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  wrap.innerHTML = `
    <div class="seal">${t('disconnectedSeal')}</div>
    <p class="title-sub">${t('disconnected')}<br>${t('reconnect')}</p>
    <button class="btn primary" id="backAfterDisconnect">${t('reconnect')}</button>
  `;
  stage.appendChild(wrap);
  document.getElementById('backAfterDisconnect').onclick = () => {
    const { roomView } = getNetworkState();
    const savedCode = roomView ? roomView.code : '';
    ui = { screen: 'join', nameInput: ui.nameInput, codeInput: savedCode, customCode: '', useCustomCode: false, expansionChoice: false, joinError: null, createError: null, disconnected: false };
    render(stage);
  };
}

function renderTitle(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  const savedGame = loadGameState();
  const hasSavedGame = savedGame && savedGame.phase !== 'final';
  const lang = getCurrentLang();

  wrap.innerHTML = `
    <div class="title-eyebrow">P2P ${t('onlineGame')}</div>
    <div class="seal">${t('sealText')}</div>
    <h1 class="title-main">${lang === 'ja' ? '藪の中' : 'In a Grove'}</h1>
    <p class="title-sub">${t('titleDesc')}</p>
    <div class="notice-box">${t('noticeText')}</div>
    ${hasSavedGame ? `
      <div class="saved-game-card">
        <h3>${t('previousRoom')}</h3>
        <p>${lang === 'ja' ? `部屋番号: <span class="room-code">${escapeHtml(savedGame.code)}</span><br>フェーズ: ${escapeHtml(savedGame.phase)}<br>プレイヤー: ${savedGame.players.length}${t('personCount')}` : `Code: <span class="room-code">${escapeHtml(savedGame.code)}</span><br>Phase: ${escapeHtml(savedGame.phase)}<br>Players: ${savedGame.players.length}`}</p>
        <button class="btn primary small" id="restoreBtn">${t('restoreRoom')}</button>
        <button class="btn small" id="clearBtn" style="margin-left:8px;">${t('clear')}</button>
      </div>
    ` : ''}
    <div class="row" style="justify-content:center;">
      <button class="btn primary" id="toCreate">${t('createRoom')}</button>
      <button class="btn" id="toJoin">${t('joinRoom')}</button>
    </div>
    <div class="center" style="margin-top:16px;"><button class="rules-link" id="titleRulesBtn">${t('howToPlay')}</button></div>
  `;
  stage.appendChild(wrap);

  if (hasSavedGame) {
    document.getElementById('restoreBtn').onclick = () => window.restoreGame(savedGame);
    document.getElementById('clearBtn').onclick = () => { clearGameState(); render(stage); };
  }
  document.getElementById('toCreate').onclick = () => { ui.screen = 'create'; render(stage); };
  document.getElementById('toJoin').onclick = () => { ui.screen = 'join'; render(stage); };
  document.getElementById('titleRulesBtn').onclick = () => window.openRulesModal();
  
  // タイトル画面ではチャット非表示
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'none';
}

function renderConnecting(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  wrap.innerHTML = `<div class="seal">${t('connectingSeal')}</div><p class="title-sub">${t('connecting')}<span class="wait-dots"></span></p>`;
  stage.appendChild(wrap);
  
  // 接続中はチャット非表示
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'none';
}

function renderCreate(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `
    <div class="card">
      <h2>${t('createRoomTitle')}</h2>
      <p>${t('hostDesc')}</p>
      <label style="font-size:12px;color:var(--ink-soft);">${t('enterName')}</label>
      <input class="form-input" id="nameInput" placeholder="${t('nameExample')}" value="${escapeHtml(ui.nameInput)}">
      <label style="font-size:12px;color:var(--ink-soft);">${t('customRoomCode')}</label>
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
        <label style="font-size:13px; display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="useCustomCode" ${ui.useCustomCode ? 'checked' : ''} style="width:18px; height:18px;">
          ${t('customRoomCode')}
        </label>
      </div>
      ${ui.useCustomCode ? `<input class="form-input code-input" id="customCodeInput" maxlength="6" placeholder="${t('customCodeExample')}" value="${escapeHtml(ui.customCode)}" style="text-transform:uppercase;">` : ''}
      <label style="font-size:12px;color:var(--ink-soft);">${t('expansionRule')}</label>
      <div class="count-row" id="expRow"></div>
      <div class="center">
        <button class="btn primary" id="doCreate">${t('create')}</button>
      </div>
      ${ui.createError ? `<div class="err-text center">${escapeHtml(ui.createError)}</div>` : ''}
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="createRulesBtn">${t('howToPlay')}</button> ・ <button class="btn small" id="back1">${t('back')}</button></div>
    </div>
  `;
  stage.appendChild(wrap);

  document.getElementById('nameInput').oninput = e => { ui.nameInput = e.target.value; };
  document.getElementById('useCustomCode').onchange = e => { ui.useCustomCode = e.target.checked; render(stage); };
  const cci = document.getElementById('customCodeInput');
  if (cci) cci.oninput = e => { ui.customCode = e.target.value.toUpperCase(); };

  const expRow = document.getElementById('expRow');
  [{ v: false, label: t('dontUse') }, { v: true, label: t('use') }].forEach(opt => {
    const b = document.createElement('button');
    b.className = 'count-btn' + (ui.expansionChoice === opt.v ? ' active' : '');
    b.textContent = opt.label;
    b.onclick = () => { ui.expansionChoice = opt.v; render(stage); };
    expRow.appendChild(b);
  });

  document.getElementById('doCreate').onclick = () => window.createRoom();
  document.getElementById('back1').onclick = () => { ui.screen = 'title'; render(stage); };
  document.getElementById('createRulesBtn').onclick = () => window.openRulesModal();
  
  // 作成画面ではチャット非表示
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'none';
}

function renderJoin(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `
    <div class="card">
      <h2>${t('joinRoomTitle')}</h2>
      <p>${t('joinDesc')}</p>
      <label style="font-size:12px;color:var(--ink-soft);">${t('enterName')}</label>
      <input class="form-input" id="nameInput2" placeholder="${t('nameExample2')}" value="${escapeHtml(ui.nameInput)}">
      <label style="font-size:12px;color:var(--ink-soft);">${t('roomCode')}</label>
      <input class="form-input code-input" id="codeInput" maxlength="6" placeholder="${t('roomCode')}" value="${escapeHtml(ui.codeInput)}">
      <div class="center">
        <button class="btn primary" id="doJoin">${t('join')}</button>
      </div>
      ${ui.joinError ? `<div class="err-text center">${escapeHtml(ui.joinError)}</div>` : ''}
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="joinRulesBtn">${t('howToPlay')}</button> ・ <button class="btn small" id="back2">${t('back')}</button></div>
    </div>
  `;
  stage.appendChild(wrap);

  document.getElementById('nameInput2').oninput = e => { ui.nameInput = e.target.value; };
  document.getElementById('codeInput').oninput = e => { ui.codeInput = e.target.value.toUpperCase(); };
  document.getElementById('doJoin').onclick = () => window.joinRoom();
  document.getElementById('back2').onclick = () => { ui.screen = 'title'; render(stage); };
  document.getElementById('joinRulesBtn').onclick = () => window.openRulesModal();
  
  // 参加画面ではチャット非表示
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'none';
}

function renderLobby(stage) {
  const { roomView, isHost, myPlayerIndex } = getNetworkState();
  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `
    <div class="card">
      <h2>${t('lobbyTitle')}</h2>
      <p>${t('lobbyDesc')}</p>
      <div class="room-code-display">${escapeHtml(roomView.code)}</div>
      <p style="font-size:12px;color:var(--ink-soft);">${t('expansionRule')}：${roomView.expansionEnabled ? t('use') : t('dontUse')}</p>
      <div class="player-list" id="pList"></div>
      <div class="center" style="margin-top:20px;">
        ${isHost ? `<button class="btn primary" id="startBtn" ${roomView.players.length < 2 ? 'disabled' : ''}>${t('start')}（${roomView.players.length}/${t('maxPlayers')}）</button>` : `<div class="wait-panel"><div>${t('waiting')}<span class="wait-dots"></span></div></div>`}
      </div>
      ${isHost && roomView.players.length < 2 ? `<p class="err-text center">${t('minimumPlayers')}</p>` : ''}
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="lobbyRulesBtn">${t('howToPlay')}</button> ・ <button class="btn small" id="leaveBtn">${t('leave')}</button></div>
    </div>
    <div class="conn-note live">${t('directConnect')}</div>
  `;
  stage.appendChild(wrap);

  const pl = document.getElementById('pList');
  roomView.players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.style.borderLeftColor = p.color;
    row.innerHTML = `<span class="dot" style="background:${p.color}"></span><span>${escapeHtml(p.name)}</span>${isHost && i === 0 ? '<span class="tag">' + t('host') + '</span>' : ''}${i === myPlayerIndex ? '<span class="tag">' + t('you') + '</span>' : ''}${p.connected === false ? '<span class="tag" style="color:var(--blood);">' + t('disconnectedTag') + '</span>' : ''}`;
    pl.appendChild(row);
  });

  if (isHost) document.getElementById('startBtn').onclick = () => window.hostStartGame();
  document.getElementById('leaveBtn').onclick = () => window.leaveRoom();
  document.getElementById('lobbyRulesBtn').onclick = () => window.openRulesModal();
  
  // ロビーではチャット表示
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'block';
}

function buildScoreboard(highlightIdx) {
  const { roomView, myPlayerIndex } = getNetworkState();
  const sb = document.createElement('div');
  sb.className = 'scoreboard';
  roomView.players.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'score-chip' + (i === highlightIdx ? ' turn' : '');
    el.style.setProperty('--pc', p.color);
    el.innerHTML = `<span class="sc-name" style="color:${p.color}">${escapeHtml(p.name)}${i === myPlayerIndex ? '（' + t('you') + '）' : ''}${p.connected === false ? ' <span style="color:var(--blood);">⚠︎' + t('disconnectedTag') + '</span>' : ''}</span>
      <span class="sc-nums"><span>${t('hand')} ${p.faceUp}</span><span>${t('fail')} ${p.faceDown}</span></span>`;
    sb.appendChild(el);
  });
  return sb;
}

function renderAlibi(stage) {
  const { roomView, myPlayerIndex } = getNetworkState();
  if (alibiLocal.round !== roomView.round) { alibiLocal = { round: roomView.round, shown: false, values: null }; }
  const n = roomView.players.length;
  const neighbor = (myPlayerIndex + 1) % n;
  const acked = roomView.alibiAcked[myPlayerIndex];

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `<div class="round-header"><span>${t('round')} ${roomView.round} ${t('alibi')}</span><span>${t('confirmedCount')} ${roomView.alibiAcked.filter(Boolean).length} / ${n}</span></div>`;

  const card = document.createElement('div');
  card.className = 'card';
  if (acked) {
    card.innerHTML = `<h2>${t('alibiComplete')}</h2><p>${t('waitingOthers')}</p>`;
  } else if (!alibiLocal.shown) {
    card.innerHTML = `<h2>${t('alibi')}</h2><p>${t('alibiDesc')} <strong>${escapeHtml(roomView.players[neighbor].name)}</strong> ${t('alibiDesc2')}</p>`;
  } else {
    card.innerHTML = `<h2>${t('alibi')}</h2><p><strong>${escapeHtml(roomView.players[neighbor].name)}</strong> ${t('alibiRevealed')}</p>`;
  }
  wrap.appendChild(card);

  const actionArea = document.createElement('div');
  actionArea.className = 'center';
  if (!acked) {
    if (!alibiLocal.shown) {
      actionArea.innerHTML = `<button class="btn" id="viewAlibi">${t('checkTiles')}</button>`;
    } else {
      actionArea.innerHTML = `<button class="btn primary" id="closeAlibi">${t('hideNext')}</button>`;
    }
  }
  wrap.appendChild(actionArea);
  wrap.appendChild(buildScoreboard(-1));
  
  const p = document.createElement('p');
  p.className = 'center';
  p.style.cssText = 'margin-top:18px;';
  const rulesBtn = document.createElement('button');
  rulesBtn.className = 'rules-link';
  rulesBtn.textContent = t('howToPlay');
  rulesBtn.onclick = () => window.openRulesModal();
  const sep = document.createTextNode(' ・ ');
  const leaveBtn = document.createElement('button');
  leaveBtn.className = 'btn small';
  leaveBtn.style.opacity = '.6';
  leaveBtn.textContent = t('leave');
  leaveBtn.onclick = () => window.leaveRoom();
  p.appendChild(rulesBtn);
  p.appendChild(sep);
  p.appendChild(leaveBtn);
  wrap.appendChild(p);
  
  stage.appendChild(wrap);

  const va = document.getElementById('viewAlibi');
  const ca = document.getElementById('closeAlibi');
  if (!acked && !alibiLocal.shown && va) {
    va.onclick = async () => {
      const { result, error } = await Net.alibi();
      if (error) return;
      alibiLocal.values = result;
      alibiLocal.shown = true;
      render(stage);
    };
  } else if (!acked && alibiLocal.shown && ca) {
    ca.onclick = async () => { await Net.ackAlibi(); };
  }
}

function renderTurns(stage) {
  const { roomView, myPlayerIndex } = getNetworkState();
  ensureTurnLocal(roomView);
  const curIdx = roomView.turnOrder[roomView.currentPos];
  const isMyTurn = curIdx === myPlayerIndex;
  const tl = turnLocal;

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `<div class="round-header"><span>${t('round')} ${roomView.round}</span><span>${t('turn')} ${roomView.currentPos + 1} / ${roomView.players.length}</span></div>`;
  wrap.appendChild(buildScoreboard(curIdx));

  const p = document.createElement('p');
  p.className = 'center';
  p.style.cssText = 'margin-top:18px;';
  const rulesBtn = document.createElement('button');
  rulesBtn.className = 'rules-link';
  rulesBtn.textContent = t('howToPlay');
  rulesBtn.onclick = () => window.openRulesModal();
  const sep = document.createTextNode(' ・ ');
  const leaveBtn = document.createElement('button');
  leaveBtn.className = 'btn small';
  leaveBtn.style.opacity = '.6';
  leaveBtn.textContent = t('leave');
  leaveBtn.onclick = () => window.leaveRoom();
  p.appendChild(rulesBtn);
  p.appendChild(sep);
  p.appendChild(leaveBtn);
  wrap.appendChild(p);

  // 簡易的な容疑者カード表示
  const suspectsRow = document.createElement('div');
  suspectsRow.className = 'suspects-row';
  for (let i = 0; i < 3; i++) {
    const card = document.createElement('div');
    card.className = 'suspect-card' + (tl.guessChoice === i ? ' chosen' : '');
    card.innerHTML = `
      <div class="s-label">${labels[i]}</div>
      <div class="head">${tl.peekedValues && tl.peekedValues[i] !== undefined ? formatFlipValue(tl.peekedValues[i]) : ''}</div>
      <div class="body">${tl.peekedValues && tl.peekedValues[i] !== undefined ? t('confirmed') : '？'}</div>
    `;
    if (isMyTurn && tl.evidenceSeen) {
      card.classList.add('clickable');
      card.onclick = () => { tl.guessChoice = i; render(stage); };
    }
    suspectsRow.appendChild(card);
  }
  wrap.appendChild(suspectsRow);

  if (!isMyTurn) {
    const wp = document.createElement('div');
    wp.className = 'wait-panel';
    wp.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);">${t('currentTurn')}</p><div class="who" style="color:${roomView.players[curIdx].color}">${escapeHtml(roomView.players[curIdx].name)}</div><p style="font-size:12.5px;color:var(--ink-soft);">${t('listeningTestimony')}<span class="wait-dots"></span></p>`;
    wrap.appendChild(wp);
    stage.appendChild(wrap);
    return;
  }

  const actionArea = document.createElement('div');
  actionArea.className = 'center';
  actionArea.style.marginTop = '18px';

  if (!tl.evidenceSeen) {
    actionArea.innerHTML = `<button class="btn primary" id="viewEvidence">${t('viewEvidence')}</button>`;
    wrap.appendChild(actionArea);
    stage.appendChild(wrap);
    const ve = document.getElementById('viewEvidence');
    if (ve) {
      ve.onclick = async () => {
        const { result, error } = await Net.peek([]);
        if (error) return;
        tl.peekedValues = result.values;
        tl.evidenceSeen = true;
        render(stage);
      };
    }
    return;
  }

  if (tl.guessChoice === null || tl.guessChoice === undefined) {
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);">${t('tapCulprit')}</p>`;
  } else {
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);margin-bottom:12px;">${t('currentlySelected')} <strong style="color:var(--blood);">${labels[tl.guessChoice]}</strong> ${t('selected')}</p>`;
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = (roomView.currentPos === roomView.players.length - 1) ? t('finalTruth') : t('next');
    b.onclick = async () => {
      const guessChoice = tl.guessChoice;
      const { error } = await Net.guess(guessChoice);
      if (error) return;
      turnLocal = null;
    };
    actionArea.appendChild(b);
  }
  wrap.appendChild(actionArea);
  stage.appendChild(wrap);
}

function renderReveal(stage) {
  const { roomView, isHost } = getNetworkState();
  const culprit = roomView.culpritIndex;
  const s = roomView.center.suspects;
  const hasFive = s.includes(5);
  let explain;
  if (culprit === null || culprit === undefined) { explain = t('impossible'); }
  else if (hasFive) { explain = `${t('hasFiveExplain')} ${labels[culprit]} ${t('wasCulprit')}`; }
  else { explain = `${t('noFiveExplain')} ${labels[culprit]} ${t('wasCulprit')}`; }

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `<div class="round-header"><span>${t('round')} ${roomView.round} ${t('reveal')}</span></div>`;

  const suspectsRow = document.createElement('div');
  suspectsRow.className = 'suspects-row';
  for (let i = 0; i < 3; i++) {
    const card = document.createElement('div');
    card.className = 'suspect-card' + (i === culprit ? ' culprit' : '');
    card.innerHTML = `
      <div class="s-label">${labels[i]}</div>
      <div class="head ${isFlipValue(s[i]) ? 'is-flip' : ''}">${formatFlipValue(s[i])}</div>
      <div class="body">${t('person')}</div>
    `;
    suspectsRow.appendChild(card);
  }
  wrap.appendChild(suspectsRow);

  const explainBox = document.createElement('div');
  explainBox.className = 'reveal-explain';
  explainBox.textContent = explain;
  wrap.appendChild(explainBox);

  const resList = document.createElement('div');
  resList.className = 'resolution-list';
  (roomView.resolutionLog || []).forEach(r => {
    const row = document.createElement('div');
    row.className = 'resolution-row ' + (r.correct ? 'correct' : 'wrong');
    row.innerHTML = `<span class="res-icon">${r.icon || ''}</span>${escapeHtml(r.text)}`;
    resList.appendChild(row);
  });
  wrap.appendChild(resList);
  wrap.appendChild(buildScoreboard(-1));
  
  const btnArea = document.createElement('div');
  btnArea.className = 'center';
  btnArea.style.marginTop = '22px';
  const anyOver = roomView.players.some(p => p.faceDown >= 8 || p.faceUp <= 0);
  if (isHost) {
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = anyOver ? t('viewFinal') : t('nextRound');
    b.onclick = () => window.hostAdvanceAfterReveal();
    btnArea.appendChild(b);
  } else {
    btnArea.innerHTML = `<p style="font-size:12.5px;color:var(--ink-soft);">${t('waitingHost')}<span class="wait-dots"></span></p>`;
  }
  wrap.appendChild(btnArea);
  stage.appendChild(wrap);
}

function renderFinal(stage) {
  const { roomView, isHost } = getNetworkState();
  const minFaceDown = Math.min(...roomView.players.map(p => p.faceDown));
  const winners = roomView.players.filter(p => p.faceDown === minFaceDown);

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  
  let winnerBanner = '';
  if (winners.length > 0) {
    const winnerNames = winners.map(w => escapeHtml(w.name)).join('・');
    winnerBanner = `
      <div class="winner-banner">
        <h2>🏆 ${t('winner')}</h2>
        <div class="winner-name">${winnerNames}</div>
      </div>
    `;
  }
  
  wrap.innerHTML = `
    <div class="card"><h2>${t('gameEnd')}</h2><p>${roomView.round} ${t('allRoundsEnd')}</p></div>
    ${winnerBanner}
    <div class="card">
      <h2>${getCurrentLang() === 'ja' ? '最終成績' : 'Final Results'}</h2>
      ${roomView.players.slice().sort((a, b) => a.faceDown - b.faceDown).map(p => `
        <div class="score-chip" style="width:100%;margin-bottom:8px;border-left:4px solid ${p.color};">
          <span class="sc-name" style="color:${p.color}">${escapeHtml(p.name)}${winners.includes(p) ? ' ★' + t('winner') : ''}</span>
          <span class="sc-nums"><span>${t('hand')} ${p.faceUp}</span><span>${t('fail')} ${p.faceDown}</span></span>
        </div>`).join('')}
    </div>
    <div class="center" style="margin-top:24px;">
      ${isHost ? `<button class="btn primary" id="playAgain">${t('playAgain')}</button>` : `<p style="font-size:12.5px;color:var(--ink-soft);">${t('waitingHostFinal')}</p>`}
      <button class="btn" id="leaveFinal" style="margin-left:10px;">${t('leave')}</button>
    </div>
  `;
  stage.appendChild(wrap);
  
  const pa = document.getElementById('playAgain');
  const lf = document.getElementById('leaveFinal');
  if (isHost && pa) pa.onclick = () => window.hostPlayAgain();
  if (lf) lf.onclick = () => window.leaveRoom();
}
