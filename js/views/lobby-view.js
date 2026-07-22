// js/views/lobby-view.js
import { escapeHtml, generateRoomURL } from '../utils.js';
import { t } from '../i18n.js';
import { getNetworkState } from '../network.js';
import { getUIState, setUIState } from '../ui-state.js';
import { render } from '../ui-render.js';

export function renderLobby(stage) {
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
      <div class="center" style="margin-top:14px;"><button class="rules-link" id="lobbyRulesBtn">${t('howToPlay')}</button> · <button class="btn small" id="leaveBtn">${t('leave')}</button></div>
    </div>
    <div class="conn-note live">${t('directConnect')}</div>
  `;
  stage.appendChild(wrap);

  const pl = document.getElementById('pList');
  roomView.players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.style.borderLeftColor = p.color;
    row.innerHTML = `<span class="dot" style="background:${p.color}"></span><span>${escapeHtml(p.name)}</span>${isHost && i === 0 ? '<span class="tag">' + t('host') + '</span>' : ''}${i === myPlayerIndex ? '<span class="tag">' + t('you') + '</span>' : ''}${p.connected === false ? '<span class="tag" style="color:var(--blood);">' + t('disconnectedTag') + '</span>' : ''}${p.isBot ? '<span class="tag">🤖</span>' : ''}`;
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
  
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) chatPanel.style.display = 'block';
}

export function buildScoreboard(highlightIdx) {
  const { roomView, myPlayerIndex } = getNetworkState();
  const sb = document.createElement('div');
  sb.className = 'scoreboard';
  roomView.players.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'score-chip' + (i === highlightIdx ? ' turn' : '');
    el.style.setProperty('--pc', p.color);
    el.innerHTML = `<span class="sc-name" style="color:${p.color}">${escapeHtml(p.name)}${i === myPlayerIndex ? '（' + t('you') + '）' : ''}${p.connected === false ? ' <span style="color:var(--blood);">⚠︎' + t('disconnectedTag') + '</span>' : ''}${p.isBot ? ' 🤖' : ''}</span>
      <span class="sc-nums"><span>${t('hand')} ${p.faceUp}</span><span>${t('fail')} ${p.faceDown}</span></span>`;
    sb.appendChild(el);
  });
  return sb;
}
