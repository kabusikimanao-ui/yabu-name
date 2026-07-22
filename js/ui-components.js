// js/ui-components.js
import { escapeHtml, formatFlipValue, isFlipValue } from './utils.js';
import { t, getCurrentLang } from './i18n.js';
import { getNetworkState } from './network.js';
import { getUIState } from './ui-state.js';

// ===== スコアボード =====
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

// ===== 円卓（座席配置） =====
export function seatPositions(n) {
  if (n === 2) return [{ x: 50, y: 86 }, { x: 50, y: 14 }];
  if (n === 3) return [{ x: 50, y: 86 }, { x: 88, y: 30 }, { x: 12, y: 30 }];
  if (n === 4) return [{ x: 50, y: 86 }, { x: 88, y: 50 }, { x: 50, y: 14 }, { x: 12, y: 50 }];
  if (n === 5) return [{ x: 50, y: 88 }, { x: 88, y: 62 }, { x: 82, y: 18 }, { x: 18, y: 18 }, { x: 12, y: 62 }];
  const arr = []; for (let i = 0; i < n; i++) { const a = (Math.PI / 2) + (2 * Math.PI * i / n); arr.push({ x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) }); }
  return arr;
}

export function buildSeatTable(opts) {
  opts = opts || {};
  const { roomView, myPlayerIndex } = getNetworkState();
  const n = roomView.players.length;
  const positions = seatPositions(n);
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap' + (opts.mini ? ' mini' : '');
  const surface = document.createElement('div');
  surface.className = 'table-surface';
  wrap.appendChild(surface);
  
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

// ===== 藪の盤面（ゲーム中） =====
export function buildGroveTable(opts) {
  opts = opts || {};
  const showValues = opts.showValues || false;
  const { roomView } = getNetworkState();
  const { labels, turnLocal: tl } = getUIState();
  
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
          if (tl.chosenTwo.has(i)) tl.chosenTwo.delete(i);
          else if (tl.chosenTwo.size < 2) tl.chosenTwo.add(i);
          const stage = document.getElementById('stage');
          // 再描画は ui-render.js の render を呼ぶ必要があるため、window.renderApp などを介するか、
          // ここでは簡易的に状態を更新するだけにとどめ、呼び出し元で render を呼ぶ前提とします。
          // 実際には app.js 側で管理する render 関数を呼ぶ必要があります。
        };
      } else if (opts.clickable === 'guess' && isMyTurn && tl && tl.evidenceSeen) {
        card.classList.add('clickable');
        card.onclick = () => {
          tl.guessChoice = i;
        };
      }
    }
    spot.appendChild(card);
    wrap.appendChild(spot);
  }
  return wrap;
}
