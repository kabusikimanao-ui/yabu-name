// js/ui-render.js
import { getNetworkState } from './network.js';
import { getUIState } from './ui-state.js';
import { renderDisconnected, renderTitle, renderCreate, renderJoin, renderConnecting } from './views/auth-view.js';
import { renderLobby } from './views/lobby-view.js';
import { renderAlibi, renderTurns, renderReveal, renderFinal } from './views/game-view.js';

// メインの render 関数（描画ディスパッチャ）
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
