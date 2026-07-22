// js/views/auth-view.js
import { escapeHtml, generateRoomURL } from '../utils.js';
import { t, getCurrentLang } from '../i18n.js';
import { loadGameState, clearGameState, getSettings, updateSettings, isTutorialCompleted } from '../storage.js';
import { getNetworkState } from '../network.js';
import { getUIState, setUIState } from '../ui-state.js';
import { render } from '../ui-render.js';

export function renderDisconnected(stage) {
  const { ui } = getUIState();
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  wrap.innerHTML = `<div class="seal">${t('disconnectedSeal')}</div><p class="title-sub">${t('disconnected')}<br>${t('reconnect')}</p><button class="btn primary" id="backAfterDisconnect">${t('reconnect')}</button>`;
  stage.appendChild(wrap);
  document.getElementById('backAfterDisconnect').onclick = () => {
    const { roomView } = getNetworkState();
    const savedCode = roomView ? roomView.code : '';
    setUIState({ ui: { ...ui, screen: 'join', codeInput: savedCode, disconnected: false } });
    render(stage);
  };
}

export function renderTitle(stage) {
  const { ui } = getUIState();
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  const savedGame = loadGameState();
  const hasSavedGame = savedGame && savedGame.phase !== 'final';
  const lang = getCurrentLang();
  const settings = getSettings();

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
    <div class="center" style="margin-top:16px;">
      <button class="rules-link" id="titleRulesBtn">${t('howToPlay')}</button>
      ${!isTutorialCompleted() ? ` · <button class="rules-link" id="tutorialBtn">${t('tutorial')}</button>` : ''}
      · <button class="rules-link" id="historyBtn">${t('history')}</button>
      · <button class="rules-link" id="statsBtn">${t('stats')}</button>
    </div>
    <div class="center" style="margin-top:10px;">
      <button class="btn small" id="themeToggle">${settings.darkMode ? t('lightMode') : t('darkMode')}</button>
    </div>
  `;
  stage.appendChild(wrap);

  if (hasSavedGame) {
    document.getElementById('restoreBtn').onclick = () => window.restoreGame(savedGame);
    document.getElementById('clearBtn').onclick = () => { clearGameState(); render(stage); };
  }
  document.getElementById('toCreate').onclick = () => { setUIState({ ui: { ...ui, screen: 'create' } }); render(stage); };
  document.getElementById('toJoin').onclick = () => { setUIState({ ui: { ...ui, screen: 'join' } }); render(stage); };
  document.getElementById('titleRulesBtn').onclick = () => window.openRulesModal();
  if (!isTutorialCompleted()) {
    document.getElementById('tutorialBtn').onclick = () => window.openTutorialModal();
  }
  document.getElementById('historyBtn').onclick = () => window.openHistoryModal();
  document.getElementById('statsBtn').onclick = () => window.openStatsModal();
  document.getElementById('themeToggle').onclick = () => {
    const newDark = !settings.darkMode;
    updateSettings({ darkMode: newDark });
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : 'light');
    render(stage);
  };
  
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'none';
}

export function renderConnecting(stage) {
  const wrap = document.createElement('div');
  wrap.className = 'title-screen fade';
  wrap.innerHTML = `<div class="seal">${t('connectingSeal')}</div><p class="title-sub">${t('connecting')}<span class="wait-dots"></span></p>`;
  stage.appendChild(wrap);
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'none';
}

export function renderCreate(stage) {
  const { ui } = getUIState();
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
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="createRulesBtn">${t('howToPlay')}</button> · <button class="btn small" id="back1">${t('back')}</button></div>
    </div>
  `;
  stage.appendChild(wrap);

  document.getElementById('nameInput').oninput = e => { setUIState({ ui: { ...ui, nameInput: e.target.value } }); };
  document.getElementById('useCustomCode').onchange = e => { setUIState({ ui: { ...ui, useCustomCode: e.target.checked } }); render(stage); };
  const cci = document.getElementById('customCodeInput');
  if (cci) cci.oninput = e => { setUIState({ ui: { ...ui, customCode: e.target.value.toUpperCase() } }); };

  const expRow = document.getElementById('expRow');
  [{ v: false, label: t('dontUse') }, { v: true, label: t('use') }].forEach(opt => {
    const b = document.createElement('button');
    b.className = 'count-btn' + (ui.expansionChoice === opt.v ? ' active' : '');
    b.textContent = opt.label;
    b.onclick = () => { setUIState({ ui: { ...ui, expansionChoice: opt.v } }); render(stage); };
    expRow.appendChild(b);
  });

  document.getElementById('doCreate').onclick = () => window.createRoom();
  document.getElementById('back1').onclick = () => { setUIState({ ui: { ...ui, screen: 'title' } }); render(stage); };
  document.getElementById('createRulesBtn').onclick = () => window.openRulesModal();
  
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'none';
}

export function renderJoin(stage) {
  const { ui } = getUIState();
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
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="joinRulesBtn">${t('howToPlay')}</button> · <button class="btn small" id="back2">${t('back')}</button></div>
    </div>
  `;
  stage.appendChild(wrap);

  document.getElementById('nameInput2').oninput = e => { setUIState({ ui: { ...ui, nameInput: e.target.value } }); };
  document.getElementById('codeInput').oninput = e => { setUIState({ ui: { ...ui, codeInput: e.target.value.toUpperCase() } }); };
  document.getElementById('doJoin').onclick = () => window.joinRoom();
  document.getElementById('back2').onclick = () => { setUIState({ ui: { ...ui, screen: 'title' } }); render(stage); };
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
  
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'none';
}
