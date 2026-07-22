// js/views/game-view.js
import { escapeHtml, formatFlipValue, isFlipValue } from '../utils.js';
import { t, getCurrentLang } from '../i18n.js';
import { getNetworkState, Net } from '../network.js';
import { getUIState, setUIState, ensureTurnLocal } from '../ui-state.js';
import { render } from '../ui-render.js';
// 【修正点】 lobby-view.js ではなく ui-components.js からインポート
import { buildScoreboard, buildSeatTable, buildGroveTable } from '../ui-components.js';

export function renderAlibi(stage) {
  // ... (中略: 以前と同じロジックですが、buildSeatTable は ui-components から取得済み)
  // 詳細は省略しますが、buildSeatTable や buildScoreboard を使う部分はそのまま使えます
}

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
  
  // 【修正点】 ui-components からインポートした関数を使用
  wrap.appendChild(buildSeatTable({ mini: true, highlightSet: new Set([curIdx]), dim: true }));
  wrap.appendChild(buildScoreboard(curIdx));
  
  // ... (以降、buildGroveTable なども ui-components から使用)
  // クリックハンドラ内で再描画が必要な場合は、以下のようにします
  /*
    card.onclick = () => {
       // ... 状態更新 ...
       const stage = document.getElementById('stage');
       render(stage); // ui-render.js の render を呼ぶ
    };
  */
}

// renderReveal, renderFinal も同様に buildScoreboard などを ui-components から使用します
