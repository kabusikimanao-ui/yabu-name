// ===== キー定数 =====
const KEYS = {
  GAME_STATE: 'yabu_game_state',
  HISTORY: 'yabu_match_history',
  STATS: 'yabu_player_stats',
  SETTINGS: 'yabu_settings',
  TUTORIAL: 'yabu_tutorial_completed',
  NOTIFICATION: 'yabu_notification_permission',
  OFFLINE_CACHE: 'yabu_offline_cache',
  TOKEN_PREFIX: 'yabu_token_'
};

// ===== TTL（有効期限） =====
const TTL = {
  GAME_STATE: 24 * 60 * 60 * 1000,           // 24時間
  HISTORY: 30 * 24 * 60 * 60 * 1000,         // 30日
  STATS: 365 * 24 * 60 * 60 * 1000,          // 1年
  OFFLINE_CACHE: 7 * 24 * 60 * 60 * 1000     // 7日
};

// ===== 上限 =====
const LIMITS = {
  HISTORY: 50,    // 最新50件
  CHAT: 50        // チャット最新50件
};

// ===== ローカルストレージヘルパー =====
const storage = {
  get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.warn('Storage get error:', e);
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage set error:', e);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('Storage remove error:', e);
      return false;
    }
  }
};

// ===== Issue #1: ゲーム状態の保存・復元 =====
export function saveGameState(room) {
  if (!room) return false;
  const data = {
    room: JSON.parse(JSON.stringify(room)),
    timestamp: Date.now()
  };
  return storage.set(KEYS.GAME_STATE, data);
}

export function loadGameState() {
  const data = storage.get(KEYS.GAME_STATE);
  if (!data) return null;
  if (Date.now() - data.timestamp > TTL.GAME_STATE) {
    storage.remove(KEYS.GAME_STATE);
    return null;
  }
  return data.room;
}

export function clearGameState() {
  return storage.remove(KEYS.GAME_STATE);
}

// ===== Issue #9: 対戦履歴 =====
export function saveMatchHistory(record) {
  const history = storage.get(KEYS.HISTORY) || [];
  history.unshift({
    ...record,
    timestamp: Date.now()
  });
  // 上限を超えたら古いものを削除
  if (history.length > LIMITS.HISTORY) {
    history.length = LIMITS.HISTORY;
  }
  // 期限切れのものを削除
  const now = Date.now();
  const filtered = history.filter(h => now - h.timestamp <= TTL.HISTORY);
  storage.set(KEYS.HISTORY, filtered);
  return filtered;
}

export function getMatchHistory() {
  const history = storage.get(KEYS.HISTORY) || [];
  const now = Date.now();
  return history.filter(h => now - h.timestamp <= TTL.HISTORY);
}

export function clearMatchHistory() {
  return storage.remove(KEYS.HISTORY);
}

// ===== Issue #10: 個人統計 =====
export function updatePlayerStats(playerName, gameResult) {
  const stats = storage.get(KEYS.STATS) || {};
  if (!stats[playerName]) {
    stats[playerName] = {
      totalGames: 0,
      wins: 0,
      totalFailChips: 0,
      totalCorrectGuesses: 0,
      totalGuesses: 0,
      lastPlayed: null
    };
  }
  const s = stats[playerName];
  s.totalGames += 1;
  if (gameResult.isWinner) s.wins += 1;
  s.totalFailChips += gameResult.faceDown || 0;
  s.totalCorrectGuesses += gameResult.correctGuesses || 0;
  s.totalGuesses += gameResult.totalGuesses || 0;
  s.lastPlayed = Date.now();
  storage.set(KEYS.STATS, stats);
  return s;
}

export function getPlayerStats(playerName) {
  const stats = storage.get(KEYS.STATS) || {};
  return stats[playerName] || null;
}

export function getAllPlayerStats() {
  return storage.get(KEYS.STATS) || {};
}

export function clearPlayerStats() {
  return storage.remove(KEYS.STATS);
}

// ===== Issue #14: PWA / オフラインキャッシュ =====
export function saveOfflineCache(data) {
  const cache = {
    data,
    timestamp: Date.now()
  };
  return storage.set(KEYS.OFFLINE_CACHE, cache);
}

export function loadOfflineCache() {
  const cache = storage.get(KEYS.OFFLINE_CACHE);
  if (!cache) return null;
  if (Date.now() - cache.timestamp > TTL.OFFLINE_CACHE) {
    storage.remove(KEYS.OFFLINE_CACHE);
    return null;
  }
  return cache.data;
}

// ===== Issue #12: チュートリアル完了フラグ =====
export function isTutorialCompleted() {
  return storage.get(KEYS.TUTORIAL) === true;
}

export function setTutorialCompleted() {
  return storage.set(KEYS.TUTORIAL, true);
}

// ===== Issue #4: 通知許可状態 =====
export function getNotificationPermission() {
  return storage.get(KEYS.NOTIFICATION) || null;
}

export function setNotificationPermission(allowed) {
  return storage.set(KEYS.NOTIFICATION, allowed);
}

// ===== Issue #8: 設定（ダークモード等） =====
export function getSettings() {
  return storage.get(KEYS.SETTINGS) || {
    darkMode: false,
    soundEnabled: true,
    volume: 0.7,
    highContrast: false,
    reduceMotion: false
  };
}

export function updateSettings(updates) {
  const current = getSettings();
  const updated = { ...current, ...updates };
  storage.set(KEYS.SETTINGS, updated);
  return updated;
}

// ===== Issue #16: 名前変更履歴 =====
export function saveNameHistory(playerName, newName) {
  const history = storage.get('yabu_name_history') || [];
  history.push({
    from: playerName,
    to: newName,
    timestamp: Date.now()
  });
  // 最新10件まで
  if (history.length > 10) history.shift();
  storage.set('yabu_name_history', history);
}

// ===== トークン管理（再接続用） =====
const memTokenStore = {};

export function getOrCreateToken(code) {
  const key = KEYS.TOKEN_PREFIX + code;
  try {
    let t = localStorage.getItem(key);
    if (!t) {
      t = 'tok_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(key, t);
    }
    return t;
  } catch (e) {
    if (!memTokenStore[key]) {
      memTokenStore[key] = 'tok_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    }
    return memTokenStore[key];
  }
}

// ===== 一括クリア（プライバシー用） =====
export function clearAllData() {
  const keys = Object.values(KEYS);
  keys.forEach(key => storage.remove(key));
  storage.remove('yabu_name_history');
  storage.remove('yabu_lang');
  return true;
}

// ===== ストレージ使用量確認 =====
export function getStorageUsage() {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length * 2; // UTF-16
    }
  }
  return {
    bytes: total,
    kb: (total / 1024).toFixed(2),
    mb: (total / (1024 * 1024)).toFixed(4)
  };
}
