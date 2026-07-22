import { escapeHtml, formatFlipValue, isFlipValue } from '../utils.js';
import { t, getCurrentLang } from '../i18n.js';
import { getNetworkState, Net } from '../network.js';
import { getUIState, setUIState, ensureTurnLocal, render } from '../ui-render.js';

// ===== アリバイ確認 =====
export function renderAlibi(stage) {
  const { roomView, myPlayerIndex } = getNetworkState();
  const { alibiLocal } = getUIState();
  
  if (alibiLocal.round !== roomView.round) {
    setUIState({ alibiLocal: { round: roomView.round, shown: false, values: null } });
  }
  
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
    const myValue = alibiLocal.values.mine;
    const neighborValue = alibiLocal.values.neighbor;
    const myFlipClass = isFlipValue(myValue) ? ' is-flip' : '';
    const neighborFlipClass = isFlipValue(neighborValue) ? ' is-flip' : '';
    
    card.innerHTML = `
      <h2>${t('alibi')}</h2>
      <p><strong>${escapeHtml(roomView.players[neighbor].name)}</strong> ${t('alibiRevealed')}</p>
      <div style="display:flex; gap:20px; justify-content:center; margin:20px 0;">
        <div style="text-align:center;">
          <div style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">${t('you')}</div>
          <div style="width:70px; height:90px; background:var(--paper); border:2px solid var(--paper-deep); border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div class="head${myFlipClass}" style="width:40px; height:40px; border-radius:50%; background:${isFlipValue(myValue) ? 'var(--blood)' : 'var(--paper-deep)'}; color:${isFlipValue(myValue) ? '#fff' : 'var(--ink)'}; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700; margin-bottom:6px;">${formatFlipValue(myValue)}</div>
            <div style="font-size:10px; color:var(--ink-soft);">${t('person')}</div>
          </div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">${escapeHtml(roomView.players[neighbor].name)}</div>
          <div style="width:70px; height:90px; background:var(--paper); border:2px solid var(--paper-deep); border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div class="head${neighborFlipClass}" style="width:40px; height:40px; border-radius:50%; background:${isFlipValue(neighborValue) ? 'var(--blood)' : 'var(--paper-deep)'}; color:${isFlipValue(neighborValue) ? '#fff' : 'var(--ink)'}; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700; margin-bottom:6px;">${formatFlipValue(neighborValue)}</div>
            <div style="font-size:10px; color:var(--ink-soft);">${t('person')}</div>
          </div>
        </div>
      </div>
      <p style="font-size:12px; color:var(--ink-soft);">${t('waitingAlibi')}</p>
    `;
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
  
  const { buildScoreboard } = await import('./lobby-view.js');
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
      setUIState({ alibiLocal: { ...alibiLocal, values: result, shown: true } });
      render(stage);
    };
  } else if (!acked && alibiLocal.shown && ca) {
    ca.onclick = async () => { await Net.ackAlibi(); };
  }
}

// ===== 証言フェーズ =====
export function renderTurns(stage) {
  const { roomView, myPlayerIndex } = getNetworkState();
  ensureTurnLocal(roomView);
  const curIdx = roomView.turnOrder[roomView.currentPos];
  const isMyTurn = curIdx === myPlayerIndex;
  const { turnLocal, alibiLocal, labels } = getUIState();
  const tl = turnLocal;

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `<div class="round-header"><span>${t('round')} ${roomView.round}</span><span>${t('turn')} ${roomView.currentPos + 1} / ${roomView.players.length}</span></div>`;
  
  const { buildScoreboard } = await import('./lobby-view.js');
  wrap.appendChild(buildScoreboard(curIdx));
  
  if (alibiLocal.shown && alibiLocal.values) {
    const myAlibiPanel = document.createElement('div');
    myAlibiPanel.className = 'my-cards-panel';
    myAlibiPanel.innerHTML = `<h3>${t('confirmedPeople')}</h3><div class="cards-display">
      <div class="mini-card">
        <div class="mini-head${isFlipValue(alibiLocal.values.mine) ? ' is-flip' : ''}">${formatFlipValue(alibiLocal.values.mine)}</div>
        <div class="mini-body">${t('person')}</div>
        <div class="mini-label">${t('you')}</div>
      </div>
      <div class="mini-card">
        <div class="mini-head${isFlipValue(alibiLocal.values.neighbor) ? ' is-flip' : ''}">${formatFlipValue(alibiLocal.values.neighbor)}</div>
        <div class="mini-body">${t('person')}</div>
        <div class="mini-label">${escapeHtml(roomView.players[(myPlayerIndex + 1) % roomView.players.length].name)}</div>
      </div>
    </div>`;
    wrap.appendChild(myAlibiPanel);
  }

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

  const tableWrap = document.createElement('div');
  tableWrap.className = 'grove-table';
  tableWrap.innerHTML = '<div class="table-surface"></div>';
  
  const victimSpot = document.createElement('div');
  victimSpot.className = 'victim-spot';
  victimSpot.innerHTML = `
    <div class="victim-tile">
      <div class="v-kanji">${t('victimKanji')}</div>
      <div style="font-size:8px;letter-spacing:.1em;">${t('hidden')}</div>
    </div>
  `;
  tableWrap.appendChild(victimSpot);
  
  for (let i = 0; i < 3; i++) {
    const spot = document.createElement('div');
    spot.className = 'suspect-spot';
    spot.setAttribute('data-idx', i);
    
    const peekedValue = tl.peekedValues && tl.peekedValues[i] !== undefined ? tl.peekedValues[i] : null;
    const isPeeked = peekedValue !== null;
    const isChosen = tl.guessChoice === i;
    const isSelectedForPeek = tl.chosenTwo && tl.chosenTwo.has(i);
    
    const flipContainer = document.createElement('div');
    flipContainer.className = 'card-flip-container';
    
    const flipper = document.createElement('div');
    flipper.className = 'card-flipper' + (isPeeked ? ' flipped' : '');
    
    const front = document.createElement('div');
    front.className = 'card-front';
    front.innerHTML = `
      <div class="g-label">${labels[i]}</div>
      <div class="g-head">？</div>
      <div class="g-body">伏せ</div>
    `;
    
    const back = document.createElement('div');
    back.className = 'card-back';
    const headClass = isPeeked && isFlipValue(peekedValue) ? ' is-flip' : '';
    back.innerHTML = `
      <div class="g-label">${labels[i]}</div>
      <div class="g-head${headClass}">${isPeeked ? formatFlipValue(peekedValue) : ''}</div>
      <div class="g-body">${isPeeked ? t('confirmed') : '？'}</div>
    `;
    
    flipper.appendChild(front);
    flipper.appendChild(back);
    flipContainer.appendChild(flipper);
    
    if (isMyTurn && !tl.evidenceSeen && roomView.currentPos === 0 && !isPeeked) {
      flipContainer.classList.add('clickable');
      flipContainer.style.cursor = 'pointer';
      flipContainer.onclick = () => {
        if (tl.chosenTwo.has(i)) {
          tl.chosenTwo.delete(i);
          flipper.classList.remove('flipped');
        } else if (tl.chosenTwo.size < 2) {
          flipper.classList.add('flipped');
          setTimeout(() => {
            tl.chosenTwo.add(i);
            render(stage);
          }, 300);
        }
      };
    } else if (isMyTurn && tl.evidenceSeen) {
      flipContainer.classList.add('clickable');
      flipContainer.style.cursor = 'pointer';
      flipContainer.onclick = () => {
        tl.guessChoice = i;
        flipper.classList.add('flipped');
        render(stage);
      };
    }
    
    spot.appendChild(flipContainer);
    tableWrap.appendChild(spot);
  }
  wrap.appendChild(tableWrap);

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
    if (roomView.currentPos === 0) {
      const remaining = 2 - (tl.chosenTwo ? tl.chosenTwo.size : 0);
      actionArea.innerHTML = `
        <p style="font-size:13px;color:var(--ink-soft);max-width:420px;margin:0 auto 14px;">
          ${t('firstDetective')} ${t('tapSuspect')}${t('checkNumbers')}<br>
          <span style="color:var(--blood); font-weight:600;">${remaining} ${t('remainingSelect')}</span>
        </p>
        ${(tl.chosenTwo && tl.chosenTwo.size === 2) ? `<button class="btn primary" id="confirmPeek">${t('confirm')}</button>` : ''}
      `;
      wrap.appendChild(actionArea);
      stage.appendChild(wrap);
      
      const cp = document.getElementById('confirmPeek');
      if (cp && tl.chosenTwo && tl.chosenTwo.size === 2) {
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
          ${t('exceptPrevious')} ${t('touchRemaining')}
        </p>
        <button class="btn primary" id="viewEvidence">${t('viewEvidence')}</button>
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

  if (roomView.currentPos === 0 && roomView.expansionEnabled && !tl.swapDecided) {
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);max-width:420px;margin:0 auto 14px;">${t('expansionDesc')}</p>
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
      setUIState({ turnLocal: null });
    };
    actionArea.appendChild(b);
  }
  wrap.appendChild(actionArea);
  stage.appendChild(wrap);
}

// ===== 真相解明 =====
export function renderReveal(stage) {
  const { roomView, isHost } = getNetworkState();
  const { labels } = getUIState();
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
  
  const { buildScoreboard } = await import('./lobby-view.js');
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

// ===== 最終結果 =====
export function renderFinal(stage) {
  const { roomView, isHost } = getNetworkState();
  const minFaceDown = Math.min(...roomView.players.map(p => p.faceDown));
  const winners = roomView.players.filter(p => p.faceDown === minFaceDown);

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  
  let winnerBanner = '';
  if (winners.length > 0) {
    const winnerNames = winners.map(w => escapeHtml(w.name)).join('·');
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
