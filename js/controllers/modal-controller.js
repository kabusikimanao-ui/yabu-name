// js/controllers/modal-controller.js
import { t, getCurrentLang } from '../i18n.js';
import { setTutorialCompleted, getMatchHistory, getAllPlayerStats } from '../storage.js';
import { escapeHtml } from '../utils.js';

// ===== Issue #13: エモート表示 =====
export function showEmote(emote, playerName) {
  const display = document.createElement('div');
  display.className = 'emote-display';
  display.textContent = emote;
  display.setAttribute('aria-label', `${playerName}: ${emote}`);
  document.body.appendChild(display);

  setTimeout(() => {
    display.classList.add('fade-out');
    setTimeout(() => {
      if (display.parentNode) display.parentNode.removeChild(display);
    }, 500);
  }, 2500);
}

// ===== Issue #12: チュートリアル =====
export function openTutorialModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const steps = [
    t('tutorialStep1'),
    t('tutorialStep2'),
    t('tutorialStep3'),
    t('tutorialStep4')
  ];

  document.body.appendChild(overlay);

  const renderStep = (stepIdx) => {
    overlay.innerHTML = `
      <div class="modal-box rules-box" role="document">
        <h3>${t('tutorial')} (${stepIdx + 1}/${steps.length})</h3>
        <p style="font-size:15px; line-height:1.8; margin:20px 0;">${steps[stepIdx]}</p>
        <div class="center" style="margin-top:20px; display:flex; gap:10px; justify-content:center;">
          ${stepIdx > 0 ? `<button class="btn small" id="tutPrev">${t('tutorialPrev')}</button>` : ''}
          ${stepIdx < steps.length - 1 ? `<button class="btn primary small" id="tutNext">${t('tutorialNext')}</button>` : `<button class="btn primary small" id="tutFinish">完了</button>`}
          <button class="btn small" id="tutSkip">${t('tutorialSkip')}</button>
        </div>
      </div>
    `;

    const prev = overlay.querySelector('#tutPrev');
    const next = overlay.querySelector('#tutNext');
    const finish = overlay.querySelector('#tutFinish');
    const skip = overlay.querySelector('#tutSkip');

    if (prev) prev.onclick = () => renderStep(stepIdx - 1);
    if (next) next.onclick = () => renderStep(stepIdx + 1);
    if (finish) finish.onclick = () => {
      setTutorialCompleted();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
    if (skip) skip.onclick = () => {
      setTutorialCompleted();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    const firstButton = prev || next || finish || skip;
    if (firstButton) firstButton.focus();
  };

  renderStep(0);
}

// ===== Issue #9: 対戦履歴 =====
export function openHistoryModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const history = getMatchHistory();

  let content = '';
  if (!history || history.length === 0) {
    content = `<p style="text-align:center; color:var(--ink-soft);">${t('noHistory')}</p>`;
  } else {
    content = history.map(h => {
      const date = new Date(h.timestamp).toLocaleDateString(getCurrentLang() === 'ja' ? 'ja-JP' : 'en-US');
      const winners = (h.winners || []).join('・');
      return `
        <div style="padding:12px; background:#f4ecd6; border-left:4px solid var(--gold); margin-bottom:8px; border-radius:0 8px 8px 0;">
          <div style="font-size:12px; color:var(--ink-soft);">${date} · ${t('round')} ${h.round || 1}</div>
          <div style="font-size:13px; margin-top:4px;">${t('winner')}: <strong style="color:var(--blood);">${escapeHtml(winners)}</strong></div>
          <div style="font-size:11px; color:var(--ink-soft); margin-top:4px;">${(h.players || []).map(escapeHtml).join('・')}</div>
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
  const closeBtn = overlay.querySelector('#closeHistory');
  if (closeBtn) {
    closeBtn.onclick = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    closeBtn.focus();
  }
}

// ===== Issue #10: 統計 =====
export function openStatsModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const allStats = getAllPlayerStats();
  const playerNames = Object.keys(allStats || {});

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
  const closeBtn = overlay.querySelector('#closeStats');
  if (closeBtn) {
    closeBtn.onclick = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    closeBtn.focus();
  }
}

// ===== ルールモーダル =====
export function openRulesModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const lang = getCurrentLang();
  overlay.innerHTML = `
    <div class="modal-box rules-box">
      <h3>${lang === 'ja' ? '遊び方 — 藪の中' : 'How to Play — In a Grove'}</h3>
      <h4>${lang === 'ja' ? '概要' : 'Overview'}</h4>
      <p>${lang === 'ja' ? '竹林で一体の骸が見つかった。現場には「被害者」1枚と「容疑者」3枚の数字タイルが伏せられている。プレイヤーは2〜5人。全員が少しずつ違う手がかりを持ち寄り、証言を重ねながら「本当の犯人」を推理する。' : 'A corpse was found in a bamboo grove. At the scene are 1 "Victim" tile and 3 "Suspect" tiles placed face down. 2-5 players work together to deduce the "true culprit".'}</p>
      <h4>${lang === 'ja' ? '① アリバイ確認フェーズ' : '① Alibi Check Phase'}</h4>
      <p>${lang === 'ja' ? '各ラウンドの最初に、現場の4枚とは別の「事件と無関係な人物」のタイルが、自分と隣の人にそれぞれ配られる。両方を確認すると、除外情報が手に入る。' : 'At the start of each round, tiles of "people unrelated to the case" are dealt to you and your neighbor.'}</p>
      <h4>${lang === 'ja' ? '② 証言フェーズ' : '② Testimony Phase'}</h4>
      <ul>
        <li><b>${lang === 'ja' ? '第一発見者' : 'First Detective'}</b>：${lang === 'ja' ? '容疑者カードをタッチして、好きな2人の数字を覗く。最後に犯人だと思う容疑者にチップを置く。' : "Touch suspect cards to peek at 2 people's numbers. Finally, place your chip on the suspect you believe is the culprit."}</li>
        <li><b>${lang === 'ja' ? '2番手以降' : '2nd Player Onwards'}</b>：${lang === 'ja' ? '直前の人がチップを置いた容疑者を除く、残り2人の数字を確認できる。' : "Excluding the suspect where the previous player placed their chip, check the numbers of the remaining 2."}</li>
      </ul>
      <h4>${lang === 'ja' ? '③ 真犯人の見分け方' : '③ Identifying the True Culprit'}</h4>
      <ul>
        <li>${lang === 'ja' ? '「↓5↑」がいる場合 → 最も小さい数字の容疑者が真犯人。' : 'If "↓5↑" is among the suspects → The suspect with the smallest number is the true culprit.'}</li>
        <li>${lang === 'ja' ? '「↓5↑」がいない場合 → 最も大きい数字の容疑者が真犯人。' : 'If "↓5↑" is not present → The suspect with the largest number is the true culprit.'}</li>
      </ul>
      <h4>${lang === 'ja' ? '④ チップの精算' : '④ Chip Settlement'}</h4>
      <ul>
        <li>${lang === 'ja' ? '真犯人にチップを置いていた人は、チップが無事に戻ってくる。' : 'Players who placed chips on the true culprit get their chips back safely.'}</li>
        <li>${lang === 'ja' ? '外れた容疑者にチップを置いていた人たちは、全員「手持ち」を1枚失う。さらに、その山に最後にチップを置いた人が、山にあったチップ全部を「失敗チップ」としてまとめて引き取る。' : 'Players who placed chips on wrong suspects each lose 1 "hand" chip. Furthermore, the person who placed the last chip on that pile takes all chips from that pile as "failure chips".'}</li>
      </ul>
      <h4>${lang === 'ja' ? '⑤ 終了と勝敗' : '⑤ End Game & Victory'}</h4>
      <p>${lang === 'ja' ? 'ラウンド終了時に、誰かの「失敗チップ」が8枚以上、または「手持ち」が0枚になっていたら、そこで捜査終了。「失敗チップ」が最も少ない人が勝者。' : 'At round end, if anyone has 8 or more "failure chips" or 0 "hand" chips, the investigation ends. The player with the fewest "failure chips" wins.'}</p>
      <div class="rule-note">${t('flip5')}</div>
      <div class="center" style="margin-top:20px;"><button class="btn primary small" id="closeRules">${lang === 'ja' ? '閉じる' : 'Close'}</button></div>
    </div>
  `;

  document.body.appendChild(overlay);
  const closeBtn = overlay.querySelector('#closeRules');
  if (closeBtn) {
    closeBtn.onclick = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    closeBtn.focus();
  }
}
