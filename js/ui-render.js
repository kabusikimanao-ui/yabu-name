import { escapeHtml, genCode, getURLParam, generateRoomURL } from './utils.js';
import { t, getCurrentLang, setCurrentLang, triggerLangChange, getSupportedLangs, getLangName } from './i18n.js';
import { saveGameState, loadGameState, clearGameState, getOrCreateToken, getMatchHistory, getPlayerStats, getAllPlayerStats, getSettings, updateSettings, isTutorialCompleted, setTutorialCompleted, getNotificationPermission, setNotificationPermission } from './storage.js';
import { buildRoundState, resolveChipsInto, actJoin, redact, finalizeGame, advanceRound, addBot } from './game-core.js';
import { getNetworkState, setNetworkState, hostBroadcast, sweepClosedConnections, hostHandleRequest, hostSelfAction, sendToHost, clientHandleMessage, startHeartbeat, Net, processBotTurnIfNeeded } from './network.js';
import { render, getUIState, setUIState, ensureTurnLocal } from './ui-render.js';

// ... (以降、app.js の残りのコードは変更なし。以前お渡しした完全版をそのまま使用してください)
