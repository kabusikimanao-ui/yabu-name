// js/views/game-view.js
import { escapeHtml, formatFlipValue, isFlipValue } from '../utils.js';
import { t, getCurrentLang } from '../i18n.js';
import { getNetworkState, Net } from '../network.js';
import { getUIState, setUIState, ensureTurnLocal } from '../ui-state.js';
import { render, buildGroveTable } from '../ui-render.js';
import { buildScoreboard, buildSeatTable } from './lobby-view.js';

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
      const current = getUIState();
      setUIState({ alibiLocal: { ...current.alibiLocal, values: result, shown: true } });
      render(stage);
    };
  } else if (!acked && alibiLocal.shown && ca) {
    ca.onclick = async () => { await Net.ackAlibi(); };
  }
}

export function renderTurns(stage) {
  const { roomView, myPlayerIndex } = getNetworkState();
  ensureTurnLocal(roomView);
  const curIdx = roomView.turnOrder[roomView.currentPos];
  const isMyTurn = curIdx === myPlayerIndex;
  const { turnLocal, alibiLocal } = getUIState();
  const tl = turnLocal;

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  wrap.innerHTML = `<div class="round-header"><span>${t('round')} ${roomView.round}</span><span>${t('turn')} ${roomView.currentPos + 1} / ${roomView.players.length}</span></div>`;
  wrap.appendChild(buildSeatTable({ mini: true, highlightSet: new Set([curIdx]), dim: true }));
  wrap.appendChild(buildScoreboard(curIdx));
  
  if (alibiLocal.shown) {
    // 簡易的なマイカードパネル表示
    const myAlibiPanel = document.createElement('div');
    myAlibiPanel.className = 'my-cards-panel';
    myAlibiPanel.innerHTML = `<h3>${getCurrentLang() === 'ja' ? '確認済みの人物（ターン中ずっと表示）' : 'Confirmed People (Displayed Throughout Turn)'}</h3><div class="cards-display">
      <div class="mini-card"><div class="mini-head${isFlipValue(alibiLocal.values.mine) ? ' is-flip' : ''}">${formatFlipValue(alibiLocal.values.mine)}</div><div class="mini-body">${getCurrentLang() === 'ja' ? '人' : 'P'}</div><div class="mini-label">${getCurrentLang() === 'ja' ? 'あなた' : 'You'}</div></div>
      <div class="mini-card"><div class="mini-head${isFlipValue(alibiLocal.values.neighbor) ? ' is-flip' : ''}">${formatFlipValue(alibiLocal.values.neighbor)}</div><div class="mini-body">${getCurrentLang() === 'ja' ? '人' : 'P'}</div><div class="mini-label">${escapeHtml(roomView.players[(myPlayerIndex + 1) % roomView.players.length].name)}</div></div>
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

  let clickableMode = null;
  if (isMyTurn) {
    if (!tl.evidenceSeen && roomView.currentPos === 0) {
      clickableMode = 'peek-select';
    } else if (tl.evidenceSeen) {
      clickableMode = 'guess';
    }
  }
  wrap.appendChild(buildGroveTable({ clickable: clickableMode }));

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
      const remaining = 2 - (tl.chosenTwo ? tl.chosenTwo.size : 0);
      actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);max-width:420px;margin:0 auto 14px;">${getCurrentLang() === 'ja' ? `あなたは第一発見者。<b>円卓上の容疑者カードをタッチして</b>、好きな2人の数字を確かめよ。<br><span style="color:var(--blood); font-weight:600;">残り ${remaining} 人選択可能</span>` : `You are the first detective. <b>Touch suspect cards on the table</b> to check 2 people's numbers.<br><span style="color:var(--blood); font-weight:600;">${remaining} more can be selected</span>`}</p>${(tl.chosenTwo && tl.chosenTwo.size === 2) ? `<button class="btn primary" id="confirmPeek">${t('confirm')}</button>` : ''}`;
      wrap.appendChild(actionArea);
      stage.appendChild(wrap);
      
      const cp = document.getElementById('confirmPeek');
      if (cp && tl.chosenTwo && tl.chosenTwo.size === 2) {
        cp.onclick = async () => {
          const { result, error } = await Net.peek([...tl.chosenTwo]);
          if (error) return;
          tl.peekedValues = result.values;
          tl.evidenceSeen = true;
          setUIState({ turnLocal: tl });
          render(stage);
        };
      }
      return;
    } else {
      actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);max-width:420px;margin:0 auto 14px;">${getCurrentLang() === 'ja' ? '前の人が犯人だと示した場所以外、残り2人の<b>容疑者カードをタッチして</b>数字を確認せよ。' : 'Except where the previous player indicated as culprit, <b>touch the remaining 2 suspect cards</b> to check numbers.'}</p><button class="btn primary" id="viewEvidence">${t('viewEvidence')}</button>`;
      wrap.appendChild(actionArea);
      stage.appendChild(wrap);
      const ve = document.getElementById('viewEvidence');
      if (ve) {
        ve.onclick = async () => {
          const { result, error } = await Net.peek([]);
          if (error) return;
          tl.peekedValues = result.values;
          tl.evidenceSeen = true;
          setUIState({ turnLocal: tl });
          render(stage);
        };
      }
      return;
    }
  }

  if (isStart && roomView.expansionEnabled && !tl.swapDecided) {
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);max-width:420px;margin:0 auto 14px;">${getCurrentLang() === 'ja' ? '拡張ルール：望むなら、容疑者1人と被害者のタイルを入れ替えられる（数字は公開されない）。' : 'Expansion Rule: If desired, you can swap 1 suspect tile with the victim tile (number not revealed).'}</p><div class="row" style="justify-content:center;" id="swapButtons"></div>`;
    wrap.appendChild(actionArea);
    stage.appendChild(wrap);
    const sb = document.getElementById('swapButtons');
    if (sb) {
      const { labels } = getUIState();
      for (let i = 0; i < 3; i++) {
        const b = document.createElement('button');
        b.className = 'btn small';
        b.textContent = `${labels[i]} ${t('swap')}`;
        b.onclick = async () => { 
          const { error } = await Net.swap(i); 
          if (error) return; 
          tl.swapDecided = true; 
          setUIState({ turnLocal: tl });
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
        setUIState({ turnLocal: tl });
        render(stage); 
      };
      sb.appendChild(skip);
    }
    return;
  }

  if (tl.guessChoice === null || tl.guessChoice === undefined) {
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);">${getCurrentLang() === 'ja' ? '誰が犯人だと思うか、円卓上の容疑者をタップしてチップを置け。<b>選択すると光って強調されます</b>。別の容疑者を選ぶ場合は、再度タップしてください。' : 'Tap a suspect on the table to place your chip on who you think is the culprit. <b>Selection will glow for emphasis</b>. Tap another suspect to change your choice.'}</p>`;
  } else {
    const { labels } = getUIState();
    actionArea.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);margin-bottom:12px;">${getCurrentLang() === 'ja' ? `現在 <strong style="color:var(--blood);">${labels[tl.guessChoice]}</strong> を選択中。別の容疑者を選ぶ場合は円卓上のカードを再度タップしてください。` : `Currently selected: <strong style="color:var(--blood);">${labels[tl.guessChoice]}</strong>. Tap another suspect to change your choice.`}</p>`;
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

export function renderReveal(stage) {
  const { roomView, isHost } = getNetworkState();
  const { labels } = getUIState();
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

export function renderFinal(stage) {
  const { roomView, isHost } = getNetworkState();
  const minFaceDown = Math.min(...roomView.players.map(p => p.faceDown));
  const winners = roomView.players.filter(p => p.faceDown === minFaceDown);

  const wrap = document.createElement('div');
  wrap.className = 'fade';
  
  let winnerBanner = '';
  if (winners.length > 0) {
    const winnerNames = winners.map(w => escapeHtml(w.name)).join('·');
    winnerBanner = `<div class="winner-banner"><h2>🏆 ${t('winner')}</h2><div class="winner-name">${winnerNames}</div></div>`;
  }
  
  wrap.innerHTML = `<div class="card"><h2>${t('gameEnd')}</h2><p>${getCurrentLang() === 'ja' ? `全 ${roomView.round} ラウンドを終え、事件簿は閉じられた。` : `All ${roomView.round} rounds completed. The case is closed.`}</p></div>${winnerBanner}<div class="card"><h2>${getCurrentLang() === 'ja' ? '最終成績' : 'Final Results'}</h2>${roomView.players.slice().sort((a, b) => a.faceDown - b.faceDown).map(p => `<div class="score-chip" style="width:100%;margin-bottom:8px;border-left:4px solid ${p.color};"><span class="sc-name" style="color:${p.color}">${escapeHtml(p.name)}${winners.includes(p) ? ' ★' + t('winner') : ''}</span><span class="sc-nums"><span>${getCurrentLang() === 'ja' ? '手持ち' : 'Hand'} ${p.faceUp}</span><span>${getCurrentLang() === 'ja' ? '失敗' : 'Fail'} ${p.faceDown}</span></span></div>`).join('')}</div><div class="center" style="margin-top:24px;">${isHost ? `<button class="btn primary" id="playAgain">${t('playAgain')}</button>` : `<p style="font-size:12.5px;color:var(--ink-soft);">${getCurrentLang() === 'ja' ? 'ホストの操作を待っています…' : 'Waiting for host…'}</p>`}<button class="btn" id="leaveFinal" style="margin-left:10px;">${t('leave')}</button></div>`;
  stage.appendChild(wrap);
  
  const pa = document.getElementById('playAgain');
  const lf = document.getElementById('leaveFinal');
  if (isHost && pa) pa.onclick = () => window.hostPlayAgain();
  if (lf) lf.onclick = () => window.leaveRoom();
}
