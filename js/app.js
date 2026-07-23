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
      try { peer.destroy(); } catch (e) {}
      render(stage);
    });
  } catch (e) {
    ui.screen = 'join';
    ui.joinError = t('connectionError');
    render(stage);
  }
};

// ===== 退出（内部処理・確認なし） =====
function doLeaveRoom() {
  const { hostConn, peer, connections } = getNetworkState();
  try { if (hostConn) hostConn.close(); } catch (e) {}
  try { if (peer) peer.destroy(); } catch (e) {}

  setNetworkState({ isHost: false, peer: null, hostConn: null, connections: new Map(), room: null, roomView: null, myPlayerIndex: -1 });
  const { ui } = getUIState();
  ui.screen = 'title'; ui.nameInput = ''; ui.codeInput = ''; ui.customCode = ''; ui.useCustomCode = false; ui.expansionChoice = false; ui.joinError = null; ui.createError = null; ui.disconnected = false;
  setUIState({ ui, turnLocal: null, alibiLocal: { round: null, shown: false, values: null }, chatMessages: [], chatCollapsed: false });
  clearGameState();
  render(stage);
}

// ===== 退出（ユーザー操作・確認あり） =====
window.leaveRoom = function() {
  const confirmMsg = t('leaveConfirm');
  if (!confirm(confirmMsg)) return;
  doLeaveRoom();
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
  doLeaveRoom();
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
    setTimeout(() => banner.remove(), 300);
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
    setTimeout(() => display.remove(), 500);
  }, 2500);
};

// ===== Issue #12: 体験型チュートリアル =====
window.openTutorialModal = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  
  // 修正: まずDOMツリーに追加してからレンダリングする
  document.body.appendChild(overlay);

  let step = 0;
  let alibiClicked = [false, false];
  let peekedCount = 0;
  let peekedState = [false, false, false];
  let guessIdx = -1;

  const closeModal = () => {
    setTutorialCompleted();
    overlay.remove();
  };

  const renderStep = () => {
    let content = '';
    
    if (step === 0) {
      content = `
        <div class="modal-box rules-box">
          <h3>${t('tutorial')} (1/5)</h3>
          <p style="font-size:15px; line-height:1.8; margin:20px 0;">${t('tutorialStep1')}<br><br>このチュートリアルでは、実際に手を動かしてゲームの流れを体験します。</p>
          <div class="center" style="margin-top:20px; display:flex; gap:10px; justify-content:center;">
            <button class="btn primary small" id="tutNext">${t('tutorialNext')}</button>
            <button class="btn small" id="tutSkip">${t('tutorialSkip')}</button>
          </div>
        </div>
      `;
    } else if (step === 1) {
      content = `
        <div class="modal-box rules-box">
          <h3>${t('tutorial')} (2/5) — ${t('alibi')}</h3>
          <p style="font-size:14px; line-height:1.8; margin-bottom:16px;">${t('tutorialStep2')}<br>下の2枚のタイルをタップして、自分と隣人の数字を確認してください。</p>
          <div style="display:flex; gap:20px; justify-content:center; margin:20px 0;">
            <div class="tut-tile" data-idx="0" style="cursor:pointer; width:70px; height:90px; background:var(--paper); border:2px solid var(--paper-deep); border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; font-size:24px; box-shadow:0 4px 10px rgba(0,0,0,.1);">
              ${alibiClicked[0] ? '<span style="font-size:22px; color:var(--blood);">3</span><span style="font-size:10px; color:var(--ink-soft); margin-top:4px;">' + t('you') + '</span>' : '？'}
            </div>
            <div class="tut-tile" data-idx="1" style="cursor:pointer; width:70px; height:90px; background:var(--paper); border:2px solid var(--paper-deep); border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; font-size:24px; box-shadow:0 4px 10px rgba(0,0,0,.1);">
              ${alibiClicked[1] ? '<span style="font-size:22px; color:var(--bamboo);">4</span><span style="font-size:10px; color:var(--ink-soft); margin-top:4px;">隣人</span>' : '？'}
            </div>
          </div>
          <p id="tutHint" style="font-size:13px; color:var(--blood); text-align:center; min-height:1.5em; font-weight:600;">${alibiClicked[0] && alibiClicked[1] ? '✓ 確認完了！' : '2枚ともタップしてください'}</p>
          <div class="center" style="margin-top:10px; display:flex; gap:10px; justify-content:center;">
            <button class="btn small" id="tutPrev">${t('tutorialPrev')}</button>
            <button class="btn primary small" id="tutNext" ${alibiClicked[0] && alibiClicked[1] ? '' : 'disabled'}>${t('tutorialNext')}</button>
            <button class="btn small" id="tutSkip">${t('tutorialSkip')}</button>
          </div>
        </div>
      `;
    } else if (step === 2) {
      content = `
        <div class="modal-box rules-box">
          <h3>${t('tutorial')} (3/5) — ${t('viewEvidence')}</h3>
          <p style="font-size:14px; line-height:1.8; margin-bottom:16px;">${t('tutorialStep3')}<br>容疑者カードを2枚タップして数字を覗きます。</p>
          <div style="display:flex; gap:15px; justify-content:center; margin:20px 0;">
            <div class="tut-suspect" data-idx="0" style="cursor:pointer; width:60px; height:80px; background:${peekedState[0] ? '#f0f5e8' : 'var(--paper)'}; border:2px solid ${peekedState[0] ? 'var(--bamboo)' : 'var(--paper-deep)'}; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:24px; box-shadow:0 4px 10px rgba(0,0,0,.1);">A</div>
            <div class="tut-suspect" data-idx="1" style="cursor:pointer; width:60px; height:80px; background:${peekedState[1] ? '#f0f5e8' : 'var(--paper)'}; border:2px solid ${peekedState[1] ? 'var(--bamboo)' : 'var(--paper-deep)'}; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:24px; box-shadow:0 4px 10px rgba(0,0,0,.1);">B</div>
            <div class="tut-suspect" data-idx="2" style="cursor:pointer; width:60px; height:80px; background:${peekedState[2] ? '#f0f5e8' : 'var(--paper)'}; border:2px solid ${peekedState[2] ? 'var(--bamboo)' : 'var(--paper-deep)'}; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:24px; box-shadow:0 4px 10px rgba(0,0,0,.1);">C</div>
          </div>
          <div style="display:flex; gap:15px; justify-content:center; margin-bottom:10px;">
            <div style="width:60px; text-align:center; font-size:22px; font-weight:700; color:var(--bamboo);">${peekedState[0] ? '6' : ''}</div>
            <div style="width:60px; text-align:center; font-size:22px; font-weight:700; color:var(--bamboo);">${peekedState[1] ? '↓5↑' : ''}</div>
            <div style="width:60px; text-align:center; font-size:22px; font-weight:700; color:var(--bamboo);">${peekedState[2] ? '7' : ''}</div>
          </div>
          <p id="tutHint" style="font-size:13px; color:var(--blood); text-align:center; min-height:1.5em; font-weight:600;">${peekedCount >= 2 ? '✓ 確認完了！' : `あと ${2 - peekedCount} 人選択可能`}</p>
          <div class="center" style="margin-top:10px; display:flex; gap:10px; justify-content:center;">
            <button class="btn small" id="tutPrev">${t('tutorialPrev')}</button>
            <button class="btn primary small" id="tutNext" ${peekedCount >= 2 ? '' : 'disabled'}>${t('tutorialNext')}</button>
            <button class="btn small" id="tutSkip">${t('tutorialSkip')}</button>
          </div>
        </div>
      `;
    } else if (step === 3) {
      content = `
        <div class="modal-box rules-box">
          <h3>${t('tutorial')} (4/5) — ${t('culprit')}</h3>
          <p style="font-size:14px; line-height:1.8; margin-bottom:16px;">${t('tutorialStep4')}<br>「↓5↑」がいる場合、最も小さい数字が真犯人です。犯人だと思う容疑者をタップしてチップを置いてください。</p>
          <div style="display:flex; gap:15px; justify-content:center; margin:20px 0;">
            <div class="tut-guess" data-idx="0" style="cursor:pointer; width:60px; height:80px; background:var(--paper); border:2px solid ${guessIdx === 0 ? 'var(--blood)' : 'var(--paper-deep)'}; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; font-size:24px; position:relative; box-shadow:0 4px 10px rgba(0,0,0,.1);">
              <span style="color:var(--bamboo);">6</span>
              <span style="font-size:10px; color:var(--ink-soft); margin-top:4px;">A</span>
              ${guessIdx === 0 ? '<div style="position:absolute; bottom:-12px; width:24px; height:24px; background:var(--blood); border-radius:50%; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,.3);"></div>' : ''}
            </div>
            <div class="tut-guess" data-idx="1" style="cursor:pointer; width:60px; height:80px; background:var(--paper); border:2px solid ${guessIdx === 1 ? 'var(--blood)' : 'var(--paper-deep)'}; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; font-size:24px; position:relative; box-shadow:0 4px 10px rgba(0,0,0,.1);">
              <span style="color:var(--bamboo);">↓5↑</span>
              <span style="font-size:10px; color:var(--ink-soft); margin-top:4px;">B</span>
              ${guessIdx === 1 ? '<div style="position:absolute; bottom:-12px; width:24px; height:24px; background:var(--blood); border-radius:50%; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,.3);"></div>' : ''}
            </div>
            <div class="tut-guess" data-idx="2" style="cursor:pointer; width:60px; height:80px; background:var(--paper); border:2px solid ${guessIdx === 2 ? 'var(--blood)' : 'var(--paper-deep)'}; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; font-size:24px; position:relative; box-shadow:0 4px 10px rgba(0,0,0,.1);">
              <span style="color:var(--bamboo);">7</span>
              <span style="font-size:10px; color:var(--ink-soft); margin-top:4px;">C</span>
              ${guessIdx === 2 ? '<div style="position:absolute; bottom:-12px; width:24px; height:24px; background:var(--blood); border-radius:50%; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,.3);"></div>' : ''}
            </div>
          </div>
          <p id="tutHint" style="font-size:13px; color:var(--blood); text-align:center; min-height:1.5em; font-weight:600;">${guessIdx !== -1 ? '✓ チップを置きました！' : 'タップして選択してください'}</p>
          <div class="center" style="margin-top:10px; display:flex; gap:10px; justify-content:center;">
            <button class="btn small" id="tutPrev">${t('tutorialPrev')}</button>
            <button class="btn primary small" id="tutNext" ${guessIdx !== -1 ? '' : 'disabled'}>${t('tutorialNext')}</button>
            <button class="btn small" id="tutSkip">${t('tutorialSkip')}</button>
          </div>
        </div>
      `;
    } else if (step === 4) {
      const isCorrect = guessIdx === 0;
      content = `
        <div class="modal-box rules-box">
          <h3>${t('tutorialFinish')}</h3>
          <p style="font-size:15px; line-height:1.8; margin:20px 0;">${isCorrect ? '正解です！' : '残念！'}<br>「↓5↑」が含まれているため、最も小さい数字の <strong style="color:var(--blood);">A（6）</strong> が真犯人でした！</p>
          <div style="display:flex; gap:15px; justify-content:center; margin:20px 0;">
            <div style="width:60px; height:80px; background:${isCorrect ? '#fff0f0' : 'var(--paper)'}; border:3px solid var(--blood); border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; font-size:24px; box-shadow:0 0 12px rgba(140,47,38,.4);">
              <span style="color:var(--bamboo);">6</span>
              <span style="font-size:10px; color:var(--blood); margin-top:4px;">真犯人</span>
            </div>
            <div style="width:60px; height:80px; background:var(--paper); border:2px solid var(--paper-deep); border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; font-size:24px; opacity:0.5;">
              <span style="color:var(--bamboo);">↓5↑</span>
              <span style="font-size:10px; color:var(--ink-soft); margin-top:4px;">B</span>
            </div>
            <div style="width:60px; height:80px; background:var(--paper); border:2px solid var(--paper-deep); border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:700; font-size:24px; opacity:0.5;">
              <span style="color:var(--bamboo);">7</span>
              <span style="font-size:10px; color:var(--ink-soft); margin-top:4px;">C</span>
            </div>
          </div>
          <p style="font-size:13px; color:var(--ink-soft); text-align:center;">これでチュートリアルは終了です。実際のゲームで推理を楽しんでください！</p>
          <div class="center" style="margin-top:20px;">
            <button class="btn primary small" id="tutFinish">${t('tutorialFinish')}</button>
          </div>
        </div>
      `;
    }

    overlay.innerHTML = content;

    // ボタンのイベントリスナー登録
    const nextBtn = overlay.querySelector('#tutNext');
    const prevBtn = overlay.querySelector('#tutPrev');
    const skipBtn = overlay.querySelector('#tutSkip');
    const finishBtn = overlay.querySelector('#tutFinish');

    if (nextBtn) nextBtn.onclick = () => { step++; renderStep(); };
    if (prevBtn) prevBtn.onclick = () => { step--; renderStep(); };
    if (skipBtn) skipBtn.onclick = closeModal;
    if (finishBtn) finishBtn.onclick = closeModal;

    // インタラクションのイベント登録
    if (step === 1) {
      overlay.querySelectorAll('.tut-tile').forEach(el => {
        el.onclick = () => {
          const idx = parseInt(el.dataset.idx);
          alibiClicked[idx] = true;
          renderStep();
        };
      });
    } else if (step === 2) {
      overlay.querySelectorAll('.tut-suspect').forEach(el => {
        el.onclick = () => {
          const idx = parseInt(el.dataset.idx);
          if (!peekedState[idx] && peekedCount < 2) {
            peekedState[idx] = true;
            peekedCount++;
            renderStep();
          }
        };
      });
    } else if (step === 3) {
      overlay.querySelectorAll('.tut-guess').forEach(el => {
        el.onclick = () => {
          guessIdx = parseInt(el.dataset.idx);
          renderStep();
        };
      });
    }
  };

  renderStep(); // DOM追加後にレンダリング
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
  document.getElementById('closeHistory').onclick = () => overlay.remove();
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
  document.getElementById('closeStats').onclick = () => overlay.remove();
};

// ===== ルールモーダル =====
window.openRulesModal = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const lang = getCurrentLang();
  
  // インラインSVG挿絵
  const svgAlibi = `<svg width="80" height="40" viewBox="0 0 80 40" style="display:block; margin:0 auto 10px;"><rect x="5" y="5" width="30" height="30" rx="4" fill="#c7b586" stroke="#4a4137" stroke-width="2"/><rect x="15" y="5" width="30" height="30" rx="4" fill="#d8caa2" stroke="#4a4137" stroke-width="2"/><text x="30" y="25" font-size="12" text-anchor="middle" fill="#211c16">?</text></svg>`;
  const svgPeek = `<svg width="60" height="40" viewBox="0 0 60 40" style="display:block; margin:0 auto 10px;"><rect x="10" y="5" width="15" height="30" rx="2" fill="#fff" stroke="#8c2f26" stroke-width="2"/><rect x="30" y="5" width="15" height="30" rx="2" fill="#fff" stroke="#8c2f26" stroke-width="2"/><circle cx="37" cy="20" r="8" fill="none" stroke="#a9813f" stroke-width="2" stroke-dasharray="2 2"/><line x1="43" y1="26" x2="50" y2="33" stroke="#a9813f" stroke-width="3" stroke-linecap="round"/></svg>`;
  const svgCulprit = `<svg width="60" height="40" viewBox="0 0 60 40" style="display:block; margin:0 auto 10px;"><rect x="20" y="5" width="20" height="30" rx="3" fill="#fff" stroke="#8c2f26" stroke-width="3"/><circle cx="30" cy="20" r="5" fill="#8c2f26"/></svg>`;
  const svgChips = `<svg width="80" height="40" viewBox="0 0 80 40" style="display:block; margin:0 auto 10px;"><circle cx="25" cy="20" r="12" fill="#8c2f26" stroke="#fff" stroke-width="2"/><circle cx="45" cy="20" r="12" fill="#2c4a6b" stroke="#fff" stroke-width="2"/><circle cx="65" cy="20" r="12" fill="#4f6b3f" stroke="#fff" stroke-width="2"/></svg>`;
  const svgEnd = `<svg width="60" height="40" viewBox="0 0 60 40" style="display:block; margin:0 auto 10px;"><path d="M20 10 L40 10 L35 30 L25 30 Z" fill="#a9813f" stroke="#8c2f26" stroke-width="2"/><circle cx="30" cy="20" r="4" fill="#fff"/></svg>`;

  overlay.innerHTML = `
    <div class="modal-box rules-box">
      <h3>${lang === 'ja' ? '遊び方 — 藪の中' : 'How to Play — In a Grove'}</h3>
      <h4>${lang === 'ja' ? '概要' : 'Overview'}</h4>
      <p>${lang === 'ja' ? '竹林で一体の骸が見つかった。現場には「被害者」1枚と「容疑者」3枚の数字タイルが伏せられている。プレイヤーは2〜5人。全員が少しずつ違う手がかりを持ち寄り、証言を重ねながら「本当の犯人」を推理する。' : 'A corpse was found in a bamboo grove. At the scene are 1 "Victim" tile and 3 "Suspect" tiles placed face down. 2-5 players work together to deduce the "true culprit".'}</p>
      
      <h4>${lang === 'ja' ? '① アリバイ確認フェーズ' : '① Alibi Check Phase'}</h4>
      ${svgAlibi}
      <p>${lang === 'ja' ? '各ラウンドの最初に、現場の4枚とは別の「事件と無関係な人物」のタイルが、自分と隣の人にそれぞれ配られる。両方を確認すると、除外情報が手に入る。' : 'At the start of each round, tiles of "people unrelated to the case" are dealt to you and your neighbor.'}</p>
      
      <h4>${lang === 'ja' ? '② 証言フェーズ' : '② Testimony Phase'}</h4>
      ${svgPeek}
      <ul>
        <li><b>${lang === 'ja' ? '第一発見者' : 'First Detective'}</b>：${lang === 'ja' ? '容疑者カードをタッチして、好きな2人の数字を覗く。最後に犯人だと思う容疑者にチップを置く。' : "Touch suspect cards to peek at 2 people's numbers. Finally, place your chip on the suspect you believe is the culprit."}</li>
        <li><b>${lang === 'ja' ? '2番手以降' : '2nd Player Onwards'}</b>：${lang === 'ja' ? '直前の人がチップを置いた容疑者を除く、残り2人の数字を確認できる。' : "Excluding the suspect where the previous player placed their chip, check the numbers of the remaining 2."}</li>
      </ul>
      
      <h4>${lang === 'ja' ? '③ 真犯人の見分け方' : '③ Identifying the True Culprit'}</h4>
      ${svgCulprit}
      <ul>
        <li>${lang === 'ja' ? '「↓5↑」がいる場合 → 最も小さい数字の容疑者が真犯人。' : 'If "↓5↑" is among the suspects → The suspect with the smallest number is the true culprit.'}</li>
        <li>${lang === 'ja' ? '「↓5↑」がいない場合 → 最も大きい数字の容疑者が真犯人。' : 'If "↓5↑" is not present → The suspect with the largest number is the true culprit.'}</li>
      </ul>
      
      <h4>${lang === 'ja' ? '④ チップの精算' : '④ Chip Settlement'}</h4>
      ${svgChips}
      <ul>
        <li>${lang === 'ja' ? '真犯人にチップを置いていた人は、チップが無事に戻ってくる。' : 'Players who placed chips on the true culprit get their chips back safely.'}</li>
        <li>${lang === 'ja' ? '外れた容疑者にチップを置いていた人たちは、全員「手持ち」を1枚失う。さらに、その山に最後にチップを置いた人が、山にあったチップ全部を「失敗チップ」としてまとめて引き取る。' : 'Players who placed chips on wrong suspects each lose 1 "hand" chip. Furthermore, the person who placed the last chip on that pile takes all chips from that pile as "failure chips."'}<
      </ul>
      
      <h4>${lang === 'ja' ? '⑤ 終了と勝敗' : '⑤ End Game & Victory'}</h4>
      ${svgEnd}
      <p>${lang === 'ja' ? 'ラウンド終了時に、誰かの「失敗チップ」が8枚以上、または「手持ち」が0枚になっていたら、そこで捜査終了。「失敗チップ」が最も少ない人が勝者。' : 'At round end, if anyone has 8 or more "failure chips" or 0 "hand" chips, the investigation ends. The player with the fewest "failure chips" wins.'}</p>
      <div class="rule-note">${t('flip5')}</div>
      <div class="center" style="margin-top:20px;"><button class="btn primary small" id="closeRules">${lang === 'ja' ? '閉じる' : 'Close'}</button></div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('closeRules').onclick = () => overlay.remove();
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
