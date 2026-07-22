import { escapeHtml, formatFlipValue, isFlipValue, generateRoomURL } from './utils.js';
import { t, getCurrentLang, getSettings, updateSettings, isTutorialCompleted, setTutorialCompleted, loadGameState, clearGameState } from './storage.js';
import { getNetworkState, Net } from './network.js';

// ===== 状態管理 =====
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

// ===== メインrender関数 =====
export function render(stage) {
  try {
    stage.innerHTML = '';
    if (ui.disconnected) { renderDisconnected(stage); return; }
    if (ui.screen === 'title') { renderTitle(stage); return; }
    if (ui.screen === 'create') { renderCreate(stage); return; }
    if (ui.screen === 'join') { renderJoin(stage); return; }
    if (ui.screen === 'connecting' || !getNetworkState().roomView) { renderConnecting(stage); return; }
    
    const { roomView, myPlayerIndex, isHost } = getNetworkState();
    if (roomView.phase === 'lobby') { renderLobby(stage); return; }
    if (roomView.phase === 'alibi') { renderAlibi(stage); return; }
    if (roomView.phase === 'turns') { renderTurns(stage); return; }
    if (roomView.phase === 'reveal') { renderReveal(stage); return; }
    if (roomView.phase === 'final') { renderFinal(stage); return; }
  } catch (e) {
    console.error('Render error:', e);
    stage.innerHTML = `<div class="card"><h2>Error</h2><p>An error occurred. Please refresh the page.</p><button class="btn primary" onclick="location.reload()">Reload</button></div>`;
  }
}

// ===== 切断画面 =====
function renderDisconnected(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  wrap.innerHTML = `<div class="seal">切</div><p class="title-sub">${t('disconnected')}<br>${t('reconnect')}</p><button class="btn primary" id="backAfterDisconnect">${t('reconnect')}</button>`;
  stage.appendChild(wrap);
  document.getElementById('backAfterDisconnect').onclick = () => {
    const { roomView } = getNetworkState();
    const savedCode = roomView ? roomView.code : '';
    ui = { screen: 'join', nameInput: ui.nameInput, codeInput: savedCode, customCode: '', useCustomCode: false, expansionChoice: false, joinError: null, createError: null, disconnected: false };
    render(stage);
  };
}

// ===== タイトル画面 =====
function renderTitle(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  const savedGame = loadGameState();
  const hasSavedGame = savedGame && savedGame.phase !== 'final';
  const lang = getCurrentLang();
  const settings = getSettings();

  wrap.innerHTML = `
    <div class="title-eyebrow">P2P ${lang === 'ja' ? 'オンライン推理ゲーム' : 'Online Deduction Game'}</div>
    <div class="seal">${lang === 'ja' ? '検' : 'INV'}</div>
    <h1 class="title-main">${lang === 'ja' ? '藪の中' : 'In a Grove'}</h1>
    <p class="title-sub">${lang === 'ja' ? '竹林に横たわる一体の骸。容疑者は三人。<br>2〜5人で遊ぶ新版' : 'A corpse lies in the bamboo grove. Three suspects.<br>New version for 2-5 players'}</p>
    <div class="notice-box">
      ${lang === 'ja' ? 
        `このバージョンは<b>2〜5人</b>対応。ブラウザ同士が<b>WebRTCで直接通信</b>します。<b>部屋を作った人の端末がゲームの進行を管理</b>します。<br><br>
        <b>部屋番号は自分で決められます</b>（3〜6文字）。<br>
        <b>容疑者カードをタッチして</b>数字を確認します。<br>
        <b style="color:var(--blood);">「↓5↑」は特別な数字</b>（flip）です。` :
        `This version supports <b>2-5 players</b>. Browsers communicate directly via <b>WebRTC</b>. <b>The host's device manages game progression</b>.<br><br>
        <b>You can set your own room code</b> (3-6 characters).<br>
        <b>Touch suspect cards</b> to check numbers.<br>
        <b style="color:var(--blood);">"↓5↑" is a special number</b> (flip).`
      }
    </div>
    ${hasSavedGame ? `
      <div class="saved-game-card">
        <h3>${t('previousRoom')}</h3>
        <p>${lang === 'ja' ? `部屋番号: <span class="room-code">${escapeHtml(savedGame.code)}</span><br>フェーズ: ${escapeHtml(savedGame.phase)}<br>プレイヤー: ${savedGame.players.length}人` : `Code: <span class="room-code">${escapeHtml(savedGame.code)}</span><br>Phase: ${escapeHtml(savedGame.phase)}<br>Players: ${savedGame.players.length}`}</p>
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
}

// ===== 接続中画面 =====
function renderConnecting(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  wrap.innerHTML = `<div class="seal">…</div><p class="title-sub">${getCurrentLang() === 'ja' ? '接続しています' : 'Connecting'}<span class="wait-dots"></span></p>`;
  stage.appendChild(wrap);
}

// ===== 部屋作成画面 =====
function renderCreate(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `
    <div class="card">
      <h2>${getCurrentLang() === 'ja' ? '部屋を作る' : 'Create Room'}</h2>
      <p>${getCurrentLang() === 'ja' ? 'あなたの端末がこの部屋の進行役になります。2〜5人集まったら、あなたが開始ボタンを押してゲームを始めます。<b>ゲームが終わるまで、このタブを閉じないでください。</b>' : 'Your device will host this room. When 2-5 players gather, press the start button to begin. <b>Do not close this tab until the game ends.</b>'}</p>
      <label style="font-size:12px;color:var(--ink-soft);">${t('enterName')}</label>
      <input class="form-input" id="nameInput" placeholder="${getCurrentLang() === 'ja' ? '例：探偵1' : 'Ex: Detective1'}" value="${escapeHtml(ui.nameInput)}">
      <label style="font-size:12px;color:var(--ink-soft);">${t('customRoomCode')}</label>
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
        <label style="font-size:13px; display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="useCustomCode" ${ui.useCustomCode ? 'checked' : ''} style="width:18px; height:18px;">
          ${getCurrentLang() === 'ja' ? '自分で部屋番号を決める' : 'Set custom room code'}
        </label>
      </div>
      ${ui.useCustomCode ? `<input class="form-input code-input" id="customCodeInput" maxlength="6" placeholder="${getCurrentLang() === 'ja' ? '例：MYROOM' : 'Ex: MYROOM'}" value="${escapeHtml(ui.customCode)}" style="text-transform:uppercase;">` : ''}
      <label style="font-size:12px;color:var(--ink-soft);">${t('expansionRule')}</label>
      <div class="count-row" id="expRow"></div>
      <div class="center">
        <button class="btn primary" id="doCreate">${t('create')}</button>
      </div>
      ${ui.createError ? `<div class="err-text center">${escapeHtml(ui.createError)}</div>` : ''}
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="createRulesBtn">${t('howToPlay')}</button> · <button class="btn small" id="back1">${t('back')}</button></div>
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
}

// ===== 部屋参加画面 =====
function renderJoin(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `
    <div class="card">
      <h2>${getCurrentLang() === 'ja' ? '部屋に入る' : 'Join Room'}</h2>
      <p>${getCurrentLang() === 'ja' ? 'ホストから伝えられた部屋番号を入力してください。' : 'Enter the room code provided by the host.'}</p>
      <label style="font-size:12px;color:var(--ink-soft);">${t('enterName')}</label>
      <input class="form-input" id="nameInput2" placeholder="${getCurrentLang() === 'ja' ? '例：探偵2' : 'Ex: Detective2'}" value="${escapeHtml(ui.nameInput)}">
      <label style="font-size:12px;color:var(--ink-soft);">${t('roomCode')}</label>
      <input class="form-input code-input" id="codeInput" maxlength="6" placeholder="${getCurrentLang() === 'ja' ? '部屋番号' : 'Room Code'}" value="${escapeHtml(ui.codeInput)}">
      <div class="center">
        <button class="btn primary" id="doJoin">${t('join')}</button>
      </div>
      ${ui.joinError ? `<div class="err-text center">${escapeHtml(ui.joinError)}</div>` : ''}
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="joinRulesBtn">${t('howToPlay')}</button> · <button class="btn small" id="back2">${t('back')}</button></div>
    </div>
  `;
  stage.appendChild(wrap);

  document.getElementById('nameInput2').oninput = e => { ui.nameInput = e.target.value; };
  document.getElementById('codeInput').oninput = e => { ui.codeInput = e.target.value.toUpperCase(); };
  document.getElementById('doJoin').onclick = () => window.joinRoom();
  document.getElementById('back2').onclick = () => { ui.screen = 'title'; render(stage); };
  document.getElementById('joinRulesBtn').onclick = () => window.openRulesModal();
  
  if (ui.codeInput) {
    const copyArea = document.createElement('div');
    copyArea.className = 'center';
    copyArea.style.marginTop = '10px';
    copyArea.innerHTML = `<p style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">友達を招待するURL:</p>`;
    const urlBox = document.createElement('div');
    urlBox.style.cssText = 'background:#f4ecd6; border:1px solid var(--paper-deep); padding:8px 12px; border-radius:4px; font-size:12px; word-break:break-all; margin-bottom:8px; max-width:400px; margin-left:auto; margin-right:auto;';
    urlBox.textContent = generateRoomURL(ui.codeInput);
    copyArea.appendChild(urlBox);
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn small';
    copyBtn.textContent = 'URLをコピー';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(generateRoomURL(ui.codeInput)).then(() => {
        copyBtn.textContent = 'コピーしました！';
        setTimeout(() => { copyBtn.textContent = 'URLをコピー'; }, 2000);
      }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = generateRoomURL(ui.codeInput);
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copyBtn.textContent = 'コピーしました！';
        setTimeout(() => { copyBtn.textContent = 'URLをコピー'; }, 2000);
      });
    };
    copyArea.appendChild(copyBtn);
    stage.appendChild(copyArea);
  }
}

// ===== ロビー画面 =====
function renderLobby(stage) {
  const { roomView, isHost, myPlayerIndex } = getNetworkState();
  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `
    <div class="card">
      <h2>${getCurrentLang() === 'ja' ? '捜査本部 — 集合待ち' : 'Investigation HQ — Waiting'}</h2>
      <p>${getCurrentLang() === 'ja' ? 'この番号を仲間に伝えて、参加してもらいましょう。' : 'Share this code with your friends to join.'}</p>
      <div class="room-code-display">${escapeHtml(roomView.code)}</div>
      <p style="font-size:12px;color:var(--ink-soft);">${t('expansionRule')}：${roomView.expansionEnabled ? t('use') : t('dontUse')}</p>
      <div id="lobbySeats"></div>
      <div class="player-list" id="pList"></div>
      <div class="center" style="margin-top:20px;">
        ${isHost ? `<button class="btn primary" id="startBtn" ${roomView.players.length < 2 ? 'disabled' : ''}>${t('start')}（${roomView.players.length}/${t('maxPlayers')}）</button>` : `<div class="wait-panel"><div>${t('waiting')}<span class="wait-dots"></span></div></div>`}
      </div>
      ${isHost && roomView.players.length < 2 ? `<p class="err-text center">${t('minimumPlayers')}</p>` : ''}
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="lobbyRulesBtn">${t('howToPlay')}</button> · <button class="btn small" id="leaveBtn">${t('leave')}</button></div>
    </div>
    <div class="conn-note live">${getCurrentLang() === 'ja' ? '直接接続中（P2P・リアルタイム反映）' : 'Direct Connection (P2P・Real-time)'}</div>
  `;
  stage.appendChild(wrap);

  document.getElementById('lobbySeats').appendChild(buildLobbySeatTable());
  const pl = document.getElementById('pList');
  roomView.players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.style.borderLeftColor = p.color;
    row.innerHTML = `<span class="dot" style="background:${p.color}"></span><span>${escapeHtml(p.name)}</span>${isHost && i === 0 ? '<span class="tag">' + (getCurrentLang() === 'ja' ? 'ホスト' : 'Host') + '</span>' : ''}${i === myPlayerIndex ? '<span class="tag">' + (getCurrentLang() === 'ja' ? 'あなた' : 'You') + '</span>' : ''}${p.connected === false ? '<span class="tag" style="color:var(--blood);">' + (getCurrentLang() === 'ja' ? '切断中' : 'Disconnected') + '</span>' : ''}`;
    pl.appendChild(row);
  });

  if (isHost) document.getElementById('startBtn').onclick = () => window.hostStartGame();
  document.getElementById('leaveBtn').onclick = () => window.leaveRoom();
  document.getElementById('lobbyRulesBtn').onclick = () => window.openRulesModal();
  
  if (isHost) {
    const copyArea = document.createElement('div');
    copyArea.className = 'center';
    copyArea.style.marginTop = '10px';
    copyArea.innerHTML = `<p style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">友達を招待するURL:</p>`;
    const urlBox = document.createElement('div');
    urlBox.style.cssText = 'background:#f4ecd6; border:1px solid var(--paper-deep); padding:8px 12px; border-radius:4px; font-size:12px; word-break:break-all; margin-bottom:8px; max-width:400px; margin-left:auto; margin-right:auto;';
    urlBox.textContent = generateRoomURL(roomView.code);
    copyArea.appendChild(urlBox);
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn small';
    copyBtn.textContent = 'URLをコピー';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(generateRoomURL(roomView.code)).then(() => {
        copyBtn.textContent = 'コピーしました！';
        setTimeout(() => { copyBtn.textContent = 'URLをコピー'; }, 2000);
      }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = generateRoomURL(roomView.code);
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copyBtn.textContent = 'コピーしました！';
        setTimeout(() => { copyBtn.textContent = 'URLをコピー'; }, 2000);
      });
    };
    copyArea.appendChild(copyBtn);
    stage.appendChild(copyArea);
  }
}

function seatPositions(n) {
  if (n === 2) return [{ x: 50, y: 86 }, { x: 50, y: 14 }];
  if (n === 3) return [{ x: 50, y: 86 }, { x: 88, y: 30 }, { x: 12, y: 30 }];
  if (n === 4) return [{ x: 50, y: 86 }, { x: 88, y: 50 }, { x: 50, y: 14 }, { x: 12, y: 50 }];
  if (n === 5) return [{ x: 50, y: 88 }, { x: 88, y: 62 }, { x: 82, y: 18 }, { x: 18, y: 18 }, { x: 12, y: 62 }];
  const arr = []; for (let i = 0; i < n; i++) { const a = (Math.PI / 2) + (2 * Math.PI * i / n); arr.push({ x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) }); }
  return arr;
}

function buildLobbySeatTable() {
  const { roomView, myPlayerIndex } = getNetworkState();
  const n = 5;
  const positions = seatPositions(n);
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const surface = document.createElement('div');
  surface.className = 'table-surface';
  wrap.appendChild(surface);
  const ordered = [];
  if (myPlayerIndex >= 0) {
    for (let i = 0; i < roomView.players.length; i++) ordered.push(roomView.players[(myPlayerIndex + i) % roomView.players.length]);
  } else {
    ordered.push(...roomView.players);
  }
  for (let offset = 0; offset < n; offset++) {
    const p = ordered[offset];
    const pos = positions[offset];
    const seat = document.createElement('div');
    if (p) {
      seat.className = 'seat' + (offset === 0 ? ' me' : '');
      seat.innerHTML = `<div class="avatar" style="background:${p.color}">${escapeHtml(p.name.slice(0, 1))}</div><div class="seat-name">${escapeHtml(p.name)}${offset === 0 ? (getCurrentLang() === 'ja' ? '（あなた）' : ' (You)') : ''}</div>`;
    } else {
      seat.className = 'seat empty';
      seat.innerHTML = `<div class="avatar">−</div><div class="seat-name">${getCurrentLang() === 'ja' ? '空席' : 'Empty'}</div>`;
    }
    seat.style.left = pos.x + '%'; seat.style.top = pos.y + '%';
    wrap.appendChild(seat);
  }
  return wrap;
}

function buildScoreboard(highlightIdx) {
  const { roomView, myPlayerIndex } = getNetworkState();
  const sb = document.createElement('div');
  sb.className = 'scoreboard';
  roomView.players.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'score-chip' + (i === highlightIdx ? ' turn' : '');
    el.style.setProperty('--pc', p.color);
    el.innerHTML = `<span class="sc-name" style="color:${p.color}">${escapeHtml(p.name)}${i === myPlayerIndex ? (getCurrentLang() === 'ja' ? '（あなた）' : ' (You)') : ''}${p.connected === false ? ' <span style="color:var(--blood);">⚠︎' + (getCurrentLang() === 'ja' ? '切断中' : 'Disconnected') + '</span>' : ''}</span>
      <span class="sc-nums"><span>${getCurrentLang() === 'ja' ? '手持ち' : 'Hand'} ${p.faceUp}</span><span>${getCurrentLang() === 'ja' ? '失敗' : 'Fail'} ${p.faceDown}</span></span>`;
    sb.appendChild(el);
  });
  return sb;
}

function buildSeatTable(opts) {
  opts = opts || {};
  const { roomView, myPlayerIndex } = getNetworkState();
  const n = roomView.players.length;
  const positions = seatPositions(n);
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap' + (opts.mini ? ' mini' : '');
  const surface = document.createElement('div');
  surface.className = 'table-surface';
  wrap.appendChild(surface);
  if (opts.linkLabel) {
    const lb = document.createElement('div');
    lb.className = 'link-badge';
    lb.textContent = opts.linkLabel;
    wrap.appendChild(lb);
  }
  for (let offset = 0; offset < n; offset++) {
    const idx = myPlayerIndex >= 0 ? (myPlayerIndex + offset) % n : offset;
    const p = roomView.players[idx];
    const pos = positions[offset];
    const isHighlight = opts.highlightSet && opts.highlightSet.has(idx);
    const seat = document.createElement('div');
    seat.className = 'seat' + (offset === 0 && myPlayerIndex >= 0 ? ' me' : '') + (isHighlight ? ' highlight' : '') + (opts.dim && !isHighlight && offset !== 0 ? ' dim' : '');
    seat.style.left = pos.x + '%';
    seat.style.top = pos.y + '%';
    let cardHtml = '';
    if (opts.cardFor && Object.prototype.hasOwnProperty.call(opts.cardFor, idx)) {
      const val = opts.cardFor[idx];
      const flipped = val !== null && val !== undefined;
      cardHtml = `<div class="seat-card${flipped ? ' flipped' : ''}">${flipped ? formatFlipValue(val) : '？'}</div>`;
    }
    seat.innerHTML = `<div class="avatar" style="background:${p.color}">${escapeHtml(p.name.slice(0, 1))}</div><div class="seat-name">${escapeHtml(p.name)}${offset === 0 && myPlayerIndex >= 0 ? (getCurrentLang() === 'ja' ? '（あなた）' : ' (You)') : ''}</div>${cardHtml}`;
    wrap.appendChild(seat);
  }
  return wrap;
}

function buildMyCardsPanel() {
  const { roomView, myPlayerIndex } = getNetworkState();
  const n = roomView.players.length;
  const neighbor = (myPlayerIndex + 1) % n;
  const myCard = alibiLocal.shown ? alibiLocal.values.mine : null;
  const neighborCard = alibiLocal.shown ? alibiLocal.values.neighbor : null;
  
  const panel = document.createElement('div');
  panel.className = 'my-cards-panel';
  panel.innerHTML = `<h3>${getCurrentLang() === 'ja' ? '確認済みの人物（ターン中ずっと表示）' : 'Confirmed People (Displayed Throughout Turn)'}</h3>`;
  
  const display = document.createElement('div');
  display.className = 'cards-display';
  
  if (myCard !== null) {
    const flipClass = isFlipValue(myCard) ? ' is-flip' : '';
    display.innerHTML += `
      <div class="mini-card">
        <div class="mini-head${flipClass}">${formatFlipValue(myCard)}</div>
        <div class="mini-body">${getCurrentLang() === 'ja' ? '人' : 'P'}</div>
        <div class="mini-label">${getCurrentLang() === 'ja' ? 'あなた' : 'You'}</div>
      </div>
    `;
  }
  if (neighborCard !== null) {
    const flipClass = isFlipValue(neighborCard) ? ' is-flip' : '';
    display.innerHTML += `
      <div class="mini-card">
        <div class="mini-head${flipClass}">${formatFlipValue(neighborCard)}</div>
        <div class="mini-body">${getCurrentLang() === 'ja' ? '人' : 'P'}</div>
        <div class="mini-label">${escapeHtml(roomView.players[neighbor].name)}</div>
      </div>
    `;
  }
  if (myCard === null && neighborCard === null) {
    display.innerHTML = `<p style="color:var(--ink-soft); font-size:12px;">${getCurrentLang() === 'ja' ? 'アリバイ確認で表示されます' : 'Will be displayed after alibi check'}</p>`;
  }
  
  panel.appendChild(display);
  return panel;
}

function buildPeekedSuspectsPanel() {
  const panel = document.createElement('div');
  panel.className = 'peeked-suspects-panel';
  panel.innerHTML = `<h3>${getCurrentLang() === 'ja' ? '確認した容疑者（ターン中ずっと表示）' : 'Confirmed Suspects (Displayed Throughout Turn)'}</h3>`;
  
  const display = document.createElement('div');
  display.className = 'peeked-display';
  
  if (turnLocal && turnLocal.peekedValues) {
    Object.entries(turnLocal.peekedValues).forEach(([idx, val]) => {
      const label = labels[parseInt(idx)];
      const valueText = formatFlipValue(val);
      const flipClass = isFlipValue(val) ? ' is-flip' : '';
      display.innerHTML += `
        <div class="peeked-card">
          <div class="p-head${flipClass}">${valueText}</div>
          <div class="p-body">${getCurrentLang() === 'ja' ? '人' : 'P'}</div>
          <div class="p-label">${label}</div>
        </div>
      `;
    });
  } else {
    display.innerHTML = `<p style="color:var(--ink-soft); font-size:12px;">${getCurrentLang() === 'ja' ? '容疑者カードをタッチして確認してください' : 'Touch suspect cards to confirm'}</p>`;
  }
  
  panel.appendChild(display);
  return panel;
}

function buildGroveTable(opts) {
  opts = opts || {};
  const showValues = opts.showValues || false;
  const { roomView, myPlayerIndex } = getNetworkState();
  const center = roomView.center;
  const tl = turnLocal;
  
  const wrap = document.createElement('div');
  wrap.className = 'grove-table';
  const surface = document.createElement('div');
  surface.className = 'table-surface';
  wrap.appendChild(surface);
  
  const victimSpot = document.createElement('div');
  victimSpot.className = 'victim-spot';
  const victimTile = document.createElement('div');
  victimTile.className = 'victim-tile' + (showValues ? ' revealed' : '');
  if (showValues && center.victim !== null) {
    const vFlipClass = isFlipValue(center.victim) ? ' is-flip' : '';
    victimTile.innerHTML = `<div class="v-kanji">${t('victim')}</div><div class="v-value${vFlipClass}">${formatFlipValue(center.victim)}</div>`;
  } else {
    victimTile.innerHTML = `<div class="v-kanji">${getCurrentLang() === 'ja' ? '被' : 'V'}</div><div style="font-size:8px;letter-spacing:.1em;">${getCurrentLang() === 'ja' ? '害者' : 'ICTIM'}</div>`;
  }
  victimSpot.appendChild(victimTile);
  wrap.appendChild(victimSpot);
  
  for (let i = 0; i < 3; i++) {
    const spot = document.createElement('div');
    spot.className = 'suspect-spot';
    spot.setAttribute('data-idx', i);
    const card = document.createElement('div');
    
    const peekedValue = tl && tl.peekedValues && tl.peekedValues[i] !== undefined ? tl.peekedValues[i] : null;
    const isPeeked = peekedValue !== null;
    const isChosen = tl && tl.guessChoice === i;
    const isSelectedForPeek = tl && tl.chosenTwo && tl.chosenTwo.has(i);
    const isCulprit = showValues && i === roomView.culpritIndex;
    
    let classes = 'grove-card';
    if (isPeeked) classes += ' peeked';
    if (isChosen) classes += ' chosen';
    if (isSelectedForPeek) classes += ' selected-for-peek';
    if (isCulprit) classes += ' culprit';
    card.className = classes;
    
    let headContent = '';
    let bodyContent = '？';
    let headClass = '';
    
    if (showValues && center.suspects[i] !== null) {
      const val = center.suspects[i];
      headContent = formatFlipValue(val);
      bodyContent = getCurrentLang() === 'ja' ? '人' : 'P';
      if (isFlipValue(val)) headClass = ' is-flip';
    } else if (isPeeked) {
      headContent = formatFlipValue(peekedValue);
      bodyContent = getCurrentLang() === 'ja' ? '確認済' : 'Confirmed';
      if (isFlipValue(peekedValue)) headClass = ' is-flip';
    }
    
    card.innerHTML = `
      <div class="g-label">${labels[i]}</div>
      <div class="g-head${headClass}">${headContent}</div>
      <div class="g-body">${bodyContent}</div>
      ${roomView.unseenIdx === i ? '<div class="unseen-badge">' + t('unseen') + '</div>' : ''}
      <div class="chip-stack">${roomView.chipsAt[i].map(pi => `<span class="chip-dot" style="background:${roomView.players[pi].color}">${escapeHtml(roomView.players[pi].name.slice(0, 1))}</span>`).join('')}</div>
    `;
    
    if (opts.clickable) {
      const curIdx = roomView.turnOrder[roomView.currentPos];
      const isMyTurn = curIdx === myPlayerIndex;
      if (opts.clickable === 'peek-select' && isMyTurn && roomView.currentPos === 0 && tl && !tl.evidenceSeen && !isPeeked) {
        card.classList.add('clickable');
        card.onclick = () => {
          if (tl.chosenTwo.has(i)) {
            tl.chosenTwo.delete(i);
          } else if (tl.chosenTwo.size < 2) {
            tl.chosenTwo.add(i);
          }
          render(stage);
        };
      } else if (opts.clickable === 'guess' && isMyTurn && tl && tl.evidenceSeen) {
        card.classList.add('clickable');
        card.onclick = () => {
          tl.guessChoice = i;
          render(stage);
        };
      }
    }
    spot.appendChild(card);
    wrap.appendChild(spot);
  }
  return wrap;
}

// ===== アリバイ確認 =====
function renderAlibi(stage) {
  const { roomView, myPlayerIndex } = getNetworkState();
  if (alibiLocal.round !== roomView.round) { alibiLocal = { round: roomView.round, shown: false, values: null }; }
  const n = roomView.players.length;
  const neighbor = (myPlayerIndex + 1) % n;
  const acked = roomView.alibiAcked[myPlayerIndex];

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `<div class="round-header"><span>${t('round')} ${roomView.round} ${t('alibi')}</span><span>${getCurrentLang() === 'ja' ? '確認済み' : 'Confirmed'} ${roomView.alibiAcked.filter(Boolean).length} / ${n}</span></div>`;

  const card = document.createElement('div');
  card.className = 'card';
  if (acked) {
    card.innerHTML = `<h2>${getCurrentLang() === 'ja' ? 'アリバイ確認 — 完了' : 'Alibi Check — Complete'}</h2><p>${getCurrentLang() === 'ja' ? '他のプレイヤーの確認が終わるのを待っています…' : 'Waiting for other players to finish checking…'}</p>`;
  } else if (!alibiLocal.shown) {
    card.innerHTML = `<h2>${getCurrentLang() === 'ja' ? 'アリバイ確認' : 'Alibi Check'}</h2><p>${getCurrentLang() === 'ja' ? `この事件とは無関係な人物のタイルが、あなたと隣に座る <strong>${escapeHtml(roomView.players[neighbor].name)}</strong> にそれぞれ配られている。両方を確かめよう。容疑者の数字を推理する除外情報になる。` : `Tiles of "people unrelated to this case" are dealt to you and <strong>${escapeHtml(roomView.players[neighbor].name)}</strong> sitting next to you. Check both. This becomes exclusion information for deducing suspect numbers.`}</p>`;
  } else {
    card.innerHTML = `<h2>${getCurrentLang() === 'ja' ? 'アリバイ確認' : 'Alibi Check'}</h2><p>${getCurrentLang() === 'ja' ? `<strong>${escapeHtml(roomView.players[neighbor].name)}</strong> の手元がめくれた。これで2人分の「無関係な人物」が分かった——場の4体の中には含まれない数字だ。` : `<strong>${escapeHtml(roomView.players[neighbor].name)}</strong>'s tiles revealed. Now you know 2 "unrelated people" — numbers not among the 4 at the scene.`}</p>`;
  }
  wrap.appendChild(card);

  const cardFor = {};
  if (!acked) {
    cardFor[myPlayerIndex] = alibiLocal.shown ? alibiLocal.values.mine : null;
    cardFor[neighbor] = alibiLocal.shown ? alibiLocal.values.neighbor : null;
  }
  wrap.appendChild(buildSeatTable({
    highlightSet: acked ? new Set() : new Set([myPlayerIndex, neighbor]),
    dim: !acked,
    cardFor: acked ? null : cardFor,
    linkLabel: !acked ? (getCurrentLang() === 'ja' ? '隣のアリバイ' : 'Neighbor\'s Alibi') : ''
  }));

  const actionArea = document.createElement('div');
  actionArea.className = 'center';
  if (!acked) {
    if (!alibiLocal.shown) {
      actionArea.innerHTML = `<button class="btn" id="viewAlibi">${getCurrentLang() === 'ja' ? '手元の人物を確認する' : 'Check Your Tiles'}</button>`;
    } else {
      actionArea.innerHTML = `<button class="btn primary" id="closeAlibi">${getCurrentLang() === 'ja' ? '伏せて次へ' : 'Hide & Next'}</button>`;
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
  const sep = document.createTextNode(' · ');
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

// ===== 証言フェーズ =====
function renderTurns(stage) {
  const { roomView, myPlayerIndex } = getNetworkState();
  ensureTurnLocal(roomView);
  const curIdx = roomView.turnOrder[roomView.currentPos];
  const isMyTurn = curIdx === myPlayerIndex;
  const tl = turnLocal;

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `<div class="round-header"><span>${t('round')} ${roomView.round}</span><span>${t('turn')} ${roomView.currentPos + 1} / ${roomView.players.length}</span></div>`;
  wrap.appendChild(buildSeatTable({ mini: true, highlightSet: new Set([curIdx]), dim: true }));
  wrap.appendChild(buildScoreboard(curIdx));
  
  if (alibiLocal.shown) {
    wrap.appendChild(buildMyCardsPanel());
  }
  
  if (tl.peekedValues && Object.keys(tl.peekedValues).length > 0) {
    wrap.appendChild(buildPeekedSuspectsPanel());
  }
  
  let clickableMode = null;
  if (isMyTurn) {
    if (!tl.evidenceSeen && roomView.currentPos === 0) {
      clickableMode = 'peek-select';
    } else if (tl.evidenceSeen) {
      clickableMode = 'guess';
    }
  }
  wrap.appendChild(buildGroveTable({ clickable: clickableMode }));

  const p = document.createElement('p');
  p.className = 'center';
  p.style.cssText = 'margin-top:18px;';
  const rulesBtn = document.createElement('button');
  rulesBtn.className = 'rules-link';
  rulesBtn.textContent = t('howToPlay');
  rulesBtn.onclick = () => window.openRulesModal();
  const sep = document.createTextNode(' · ');
  const leaveBtn = document.createElement('button');
  leaveBtn.className = 'btn small';
  leaveBtn.style.opacity = '.6';
  leaveBtn.textContent = t('leave');
  leaveBtn.onclick = () => window.leaveRoom();
  p.appendChild(rulesBtn);
  p.appendChild(sep);
  p.appendChild(leaveBtn);
  wrap.appendChild(p);

  if (!isMyTurn) {
    const wp = document.createElement('div');
    wp.className = 'wait-panel';
    wp.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);">${getCurrentLang() === 'ja' ? '今の手番' : 'Current Turn'}</p><div class="who" style="color:${roomView.players[curIdx].color}">${escapeHtml(roomView.players[curIdx].name)}</div><p style="font-size:12.5px;color:var(--ink-soft);">${getCurrentLang() === 'ja' ? '証言を聞いています' : 'Listening to testimony'}<span class="wait-dots"></span></p>`;
    wrap.appendChild(wp);
    stage.appendChild(wrap);
    return;
  }

  const isStart = roomView.currentPos === 0;
  const actionArea = document.createElement('div');
  actionArea.className = 'center';
  actionArea.style.marginTop = '18px';

  if (!tl.evidenceSeen) {
    if (isStart) {
      const remaining = 2 - tl.chosenTwo.size;
      actionArea.innerHTML = `
        <p style="font-size:13px;color:var(--ink-soft);max-width:420px;margin:0 auto 14px;">
          ${getCurrentLang() === 'ja' ? 
            `あなたは第一発見者。<b>円卓上の容疑者カードをタッチして</b>、好きな2人の数字を確かめよ。<br>
            <span style="color:var(--blood); font-weight:600;">残り ${remaining} 人選択可能</span>` :
            `You are the first detective. <b>Touch suspect cards on the table</b> to check 2 people's numbers.<br>
            <span style="color:var(--blood); font-weight:600;">${remaining} more can be selected</span>`
          }
        </p>
        ${tl.chosenTwo.size === 2 ? `<button class="btn primary" id="confirmPeek">${t('confirm')}</button>` : ''}
      `;
      wrap.appendChild(actionArea);
      stage.appendChild(wrap);
      
      const cp = document.getElementById('confirmPeek');
      if (cp && tl.chosenTwo.size === 2) {
        cp.onclick = async () => {
          const { result, error } = await Net.peek([...tl.chosenTwo]);
          if (error) return;
          tl.peekedValues = result.values;
          tl.evidenceSeen = true;
          render(stage);
        };
      }
      return;
    } else {
      actionArea.innerHTML = `
        <p style="font-size:13px;color:var(--ink-soft);max-width:420px;margin:0 auto 14px;">
          ${getCurrentLang() === 'ja' ? 
            '前の人が犯人だと示した場所以外、残り2人の<b>容疑者カードをタッチして</b>数字を確認せよ。' :
            'Except where the previous player indicated as culprit, <b>touch the remaining 2 suspect cards</b> to check numbers.'
          }
        </p>
        <button class="btn small" id="viewEvidence">${t('viewEvidence')}</button>
      `;
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
  }

  if (isStart && roomView.expansionEnabled && !tl.swapDecided) {
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);max-width:420px;margin:0 auto 14px;">${getCurrentLang() === 'ja' ? '拡張ルール：望むなら、容疑者1人と被害者のタイルを入れ替えられる（数字は公開されない）。' : 'Expansion Rule: If desired, you can swap 1 suspect tile with the victim tile (number not revealed).'}</p>
      <div class="row" style="justify-content:center;" id="swapButtons"></div>`;
    wrap.appendChild(actionArea);
    stage.appendChild(wrap);
    const sb = document.getElementById('swapButtons');
    if (sb) {
      for (let i = 0; i < 3; i++) {
        const b = document.createElement('button');
        b.className = 'btn small';
        b.textContent = `${labels[i]} ${t('swap')}`;
        b.onclick = async () => { 
          const { error } = await Net.swap(i); 
          if (error) return; 
          tl.swapDecided = true; 
          render(stage); 
        };
        sb.appendChild(b);
      }
      const skip = document.createElement('button');
      skip.className = 'btn small'; 
      skip.textContent = t('noSwap');
      skip.onclick = async () => { 
        const { error } = await Net.swap('skip'); 
        if (error) return; 
        tl.swapDecided = true; 
        render(stage); 
      };
      sb.appendChild(skip);
    }
    return;
  }

  if (tl.guessChoice === null || tl.guessChoice === undefined) {
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);">${getCurrentLang() === 'ja' ? '誰が犯人だと思うか、円卓上の容疑者をタップしてチップを置け。<b>選択すると光って強調されます</b>。別の容疑者を選ぶ場合は、再度タップしてください。' : 'Tap a suspect on the table to place your chip on who you think is the culprit. <b>Selection will glow for emphasis</b>. Tap another suspect to change your choice.'}</p>`;
  } else {
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);margin-bottom:12px;">${getCurrentLang() === 'ja' ? `現在 <strong style="color:var(--blood);">${labels[tl.guessChoice]}</strong> を選択中。別の容疑者を選ぶ場合は円卓上のカードを再度タップしてください。` : `Currently selected: <strong style="color:var(--blood);">${labels[tl.guessChoice]}</strong>. Tap another suspect to change your choice.`}</p>`;
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

// ===== 真相解明 =====
function renderReveal(stage) {
  const { roomView, isHost } = getNetworkState();
  const culprit = roomView.culpritIndex;
  const s = roomView.center.suspects;
  const hasFive = s.includes(5);
  let explain;
  if (culprit === null || culprit === undefined) { explain = getCurrentLang() === 'ja' ? 'ありえない組み合わせだった。' : 'Impossible combination.'; }
  else if (hasFive) { explain = getCurrentLang() === 'ja' ? `容疑者の中に「↓5↑」が含まれているため、最も小さい数字を持つ ${labels[culprit]} が真犯人だった。` : `${labels[culprit]} with the smallest number is the true culprit because "↓5↑" is among the suspects.`; }
  else { explain = getCurrentLang() === 'ja' ? `最も大きい数字を持つ ${labels[culprit]} が真犯人だった。` : `${labels[culprit]} with the largest number is the true culprit.`; }

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `<div class="round-header"><span>${t('round')} ${roomView.round} ${t('reveal')}</span></div>`;

  wrap.appendChild(buildGroveTable({ showValues: true }));

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
  
  const p = document.createElement('p');
  p.className = 'center';
  p.style.cssText = 'margin-top:18px;';
  const rulesBtn = document.createElement('button');
  rulesBtn.className = 'rules-link';
  rulesBtn.textContent = t('howToPlay');
  rulesBtn.onclick = () => window.openRulesModal();
  const sep = document.createTextNode(' · ');
  const leaveBtn = document.createElement('button');
  leaveBtn.className = 'btn small';
  leaveBtn.style.opacity = '.6';
  leaveBtn.textContent = t('leave');
  leaveBtn.onclick = () => window.leaveRoom();
  p.appendChild(rulesBtn);
  p.appendChild(sep);
  p.appendChild(leaveBtn);
  wrap.appendChild(p);

  const btnArea = document.createElement('div');
  btnArea.className = 'center';
  btnArea.style.marginTop = '22px';
  const anyOver = roomView.players.some(p => p.faceDown >= 8 || p.faceUp <= 0);
  if (isHost) {
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = anyOver ? (getCurrentLang() === 'ja' ? '最終結果を見る' : 'View Final Results') : (getCurrentLang() === 'ja' ? '次のラウンドへ' : 'Next Round');
    b.onclick = () => window.hostAdvanceAfterReveal();
    btnArea.appendChild(b);
  } else {
    btnArea.innerHTML = `<p style="font-size:12.5px;color:var(--ink-soft);">${getCurrentLang() === 'ja' ? 'ホストが次に進めるのを待っています' : 'Waiting for host to proceed'}<span class="wait-dots"></span></p>`;
  }
  wrap.appendChild(btnArea);
  stage.appendChild(wrap);
}

// ===== 最終結果 =====
function renderFinal(stage) {
  const { roomView, isHost } = getNetworkState();
  const minFaceDown = Math.min(...roomView.players.map(p => p.faceDown));
  const winners = roomView.players.filter(p => p.faceDown === minFaceDown);
  const mostDeceived = roomView.players.filter(p => p.faceDown >= 8);
  const worstGuess = roomView.players.filter(p => p.faceUp <= 0);

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
    <div class="card"><h2>${t('gameEnd')}</h2><p>${getCurrentLang() === 'ja' ? `全 ${roomView.round} ラウンドを終え、事件簿は閉じられた。` : `All ${roomView.round} rounds completed. The case is closed.`}</p></div>
    ${winnerBanner}
    <div class="card">
      <h2>${getCurrentLang() === 'ja' ? '最終成績' : 'Final Results'}</h2>
      ${roomView.players.slice().sort((a, b) => a.faceDown - b.faceDown).map(p => `
        <div class="score-chip" style="width:100%;margin-bottom:8px;border-left:4px solid ${p.color};">
          <span class="sc-name" style="color:${p.color}">${escapeHtml(p.name)}${winners.includes(p) ? (getCurrentLang() === 'ja' ? ' ★勝者' : ' ★Winner') : ''}</span>
          <span class="sc-nums"><span>${getCurrentLang() === 'ja' ? '手持ち' : 'Hand'} ${p.faceUp}</span><span>${getCurrentLang() === 'ja' ? '失敗' : 'Fail'} ${p.faceDown}</span></span>
        </div>`).join('')}
      ${mostDeceived.length ? `<p style="margin-top:14px;">${t('mostDeceived')}：${mostDeceived.map(p => escapeHtml(p.name)).join('・')}</p>` : ''}
      ${worstGuess.length ? `<p>${t('worstGuesser')}：${worstGuess.map(p => escapeHtml(p.name)).join('・')}</p>` : ''}
    </div>
    <div class="center" style="margin-top:24px;">
      ${isHost ? `<button class="btn primary" id="playAgain">${t('playAgain')}</button>` : `<p style="font-size:12.5px;color:var(--ink-soft);">${getCurrentLang() === 'ja' ? 'ホストの操作を待っています…' : 'Waiting for host…'}</p>`}
      <button class="btn" id="leaveFinal" style="margin-left:10px;">${t('leave')}</button>
      <div style="margin-top:10px;"><button class="rules-link" id="finalRulesBtn">${t('howToPlay')}</button></div>
    </div>
  `;
  stage.appendChild(wrap);
  const pa = document.getElementById('playAgain');
  const lf = document.getElementById('leaveFinal');
  const frb = document.getElementById('finalRulesBtn');
  if (isHost && pa) pa.onclick = () => window.hostPlayAgain();
  if (lf) lf.onclick = () => window.leaveRoom();
  if (frb) frb.onclick = () => window.openRulesModal();
}
