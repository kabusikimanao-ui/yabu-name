// js/ui-render.js
import { getNetworkState } from './network.js';
import { getUIState, setUIState, ensureTurnLocal, setLabels } from './ui-state.js';
import { renderDisconnected, renderTitle, renderCreate, renderJoin, renderConnecting } from './views/auth-view.js';
import { renderLobby, buildScoreboard, buildSeatTable } from './views/lobby-view.js';
import { renderAlibi, renderTurns, renderReveal, renderFinal } from './views/game-view.js';

export function render(stage) {
  stage.innerHTML = '';
  const { ui } = getUIState();
  
  if (ui.disconnected) { renderDisconnected(stage); return; }
  if (ui.screen === 'title') { renderTitle(stage); return; }
  if (ui.screen === 'create') { renderCreate(stage); return; }
  if (ui.screen === 'join') { renderJoin(stage); return; }
  if (ui.screen === 'connecting') { renderConnecting(stage); return; }

  const { roomView } = getNetworkState();
  if (!roomView) { renderConnecting(stage); return; }

  if (roomView.phase === 'lobby') { renderLobby(stage); return; }
  if (roomView.phase === 'alibi') { renderAlibi(stage); return; }
  if (roomView.phase === 'turns') { renderTurns(stage); return; }
  if (roomView.phase === 'reveal') { renderReveal(stage); return; }
  if (roomView.phase === 'final') { renderFinal(stage); return; }
}

// 以下の関数は game-view.js からインポートされて使用されますが、
// 循環参照を避けるため、ここで定義してエクスポートします。
import { escapeHtml, formatFlipValue, isFlipValue } from './utils.js';
import { t, getCurrentLang } from './i18n.js';

export function buildGroveTable(opts) {
  opts = opts || {};
  const showValues = opts.showValues || false;
  const { roomView } = getNetworkState();
  const { labels } = getUIState();
  const tl = getUIState().turnLocal;
  
  const wrap = document.createElement('div');
  wrap.className = 'grove-table';
  
  const surface = document.createElement('div');
  surface.className = 'table-surface';
  wrap.appendChild(surface);
  
  const victimSpot = document.createElement('div');
  victimSpot.className = 'victim-spot';
  const victimTile = document.createElement('div');
  victimTile.className = 'victim-tile' + (showValues ? ' revealed' : '');
  if (showValues && roomView.center.victim !== null) {
    const vFlipClass = isFlipValue(roomView.center.victim) ? ' is-flip' : '';
    victimTile.innerHTML = `<div class="v-kanji">${t('victim')}</div><div class="v-value${vFlipClass}">${formatFlipValue(roomView.center.victim)}</div>`;
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
    
    if (showValues && roomView.center.suspects[i] !== null) {
      const val = roomView.center.suspects[i];
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
      const isMyTurn = curIdx === getNetworkState().myPlayerIndex;
      
      if (opts.clickable === 'peek-select' && isMyTurn && roomView.currentPos === 0 && tl && !tl.evidenceSeen && !isPeeked) {
        card.classList.add('clickable');
        card.onclick = () => {
          if (tl.chosenTwo.has(i)) {
            tl.chosenTwo.delete(i);
          } else if (tl.chosenTwo.size < 2) {
            tl.chosenTwo.add(i);
          }
          // 状態を更新して再描画
          setUIState({ turnLocal: tl });
          const stage = document.getElementById('stage');
          render(stage);
        };
      } else if (opts.clickable === 'guess' && isMyTurn && tl && tl.evidenceSeen) {
        card.classList.add('clickable');
        card.onclick = () => {
          tl.guessChoice = i;
          setUIState({ turnLocal: tl });
          const stage = document.getElementById('stage');
          render(stage);
        };
      }
    }
    
    spot.appendChild(card);
    wrap.appendChild(spot);
  }
  return wrap;
}
