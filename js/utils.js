// ===== XSS対策 =====
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== 数字フォーマット =====
export function formatFlipValue(val) {
  if (val === 5) return '↓5↑';
  if (val === 'blank') return '白';
  return String(val);
}

export function isFlipValue(val) {
  return val === 5;
}

// ===== ランダムコード生成 =====
export function genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// ===== 配列シャッフル =====
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== デッキ値生成 =====
export function freshDeckValues(n) {
  let vals = [2, 3, 4, 5, 6, 7, 8, 'blank'];
  if (n === 2) vals = [3, 4, 5, 6, 7, 'blank'];
  else if (n === 3) vals = vals.filter(v => v !== 2);
  return vals;
}

// ===== 真犯人判定 =====
export function computeCulprit(suspects) {
  const numeric = suspects.map((v, i) => ({ v, i })).filter(x => x.v !== 'blank');
  const hasFive = numeric.some(x => x.v === 5);
  if (numeric.length === 0) return null;
  const pick = hasFive
    ? numeric.reduce((a, b) => b.v < a.v ? b : a)
    : numeric.reduce((a, b) => b.v > a.v ? b : a);
  return pick.i;
}

// ===== プレイヤーカラー =====
export const PLAYER_COLORS = ['#8c2f26', '#2c4a6b', '#4f6b3f', '#6b4f8c', '#8b4513'];

// ===== URLパラメータ取得 (Issue #2) =====
export function getURLParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// ===== URL生成 (Issue #2, #3) =====
export function generateRoomURL(code) {
  return `${window.location.origin}${window.location.pathname}?room=${code}`;
}

// ===== 深いコピー =====
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ===== デバウンス =====
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ===== スロットル =====
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ===== 日付フォーマット =====
export function formatDate(date, locale = 'ja-JP') {
  return new Date(date).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ===== 勝率計算 (Issue #10) =====
export function calculateWinRate(history, playerName) {
  if (!history || history.length === 0) return 0;
  const playerGames = history.filter(h => h.players.includes(playerName));
  if (playerGames.length === 0) return 0;
  const wins = playerGames.filter(h => h.winners && h.winners.includes(playerName)).length;
  return (wins / playerGames.length) * 100;
}

// ===== 統計計算 (Issue #10) =====
export function calculateStats(history, playerName) {
  if (!history || history.length === 0) {
    return {
      totalGames: 0,
      wins: 0,
      winRate: 0,
      avgFailChips: 0,
      correctRate: 0
    };
  }
  
  const playerGames = history.filter(h => h.players.includes(playerName));
  const wins = playerGames.filter(h => h.winners && h.winners.includes(playerName)).length;
  const totalFailChips = playerGames.reduce((sum, h) => {
    const playerStats = h.playerStats?.find(p => p.name === playerName);
    return sum + (playerStats?.faceDown || 0);
  }, 0);
  const totalCorrect = playerGames.reduce((sum, h) => {
    const playerStats = h.playerStats?.find(p => p.name === playerName);
    return sum + (playerStats?.correctGuesses || 0);
  }, 0);
  const totalGuesses = playerGames.reduce((sum, h) => {
    const playerStats = h.playerStats?.find(p => p.name === playerName);
    return sum + (playerStats?.totalGuesses || 0);
  }, 0);

  return {
    totalGames: playerGames.length,
    wins,
    winRate: playerGames.length > 0 ? (wins / playerGames.length) * 100 : 0,
    avgFailChips: playerGames.length > 0 ? totalFailChips / playerGames.length : 0,
    correctRate: totalGuesses > 0 ? (totalCorrect / totalGuesses) * 100 : 0
  };
}

// ===== ボットAI (Issue #20) =====
export function generateBotMove(gameState, botIndex) {
  // 簡易AI：ランダムに選択
  const suspects = [0, 1, 2];
  const randomIndex = Math.floor(Math.random() * suspects.length);
  return suspects[randomIndex];
}

// ===== 乱数生成 =====
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===== 配列の重複削除 =====
export function unique(arr) {
  return [...new Set(arr)];
}

// ===== オブジェクトの空チェック =====
export function isEmptyObject(obj) {
  return Object.keys(obj).length === 0;
}

// ===== 数値の範囲制限 =====
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ===== 文字列の切り詰め =====
export function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

// ===== ローカルストレージヘルパー =====
export const localStorageHelper = {
  get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.warn('Failed to get from localStorage:', e);
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Failed to set to localStorage:', e);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('Failed to remove from localStorage:', e);
      return false;
    }
  }
};

// ===== クエリセレクタヘルパー =====
export function $(selector, context = document) {
  return context.querySelector(selector);
}

export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// ===== イベントリスナーヘルパー =====
export function on(element, event, handler, options = {}) {
  element.addEventListener(event, handler, options);
  return () => element.removeEventListener(event, handler, options);
}

// ===== クラス操作ヘルパー =====
export function addClass(element, ...classes) {
  classes.forEach(cls => element.classList.add(cls));
}

export function removeClass(element, ...classes) {
  classes.forEach(cls => element.classList.remove(cls));
}

export function toggleClass(element, cls, force = undefined) {
  element.classList.toggle(cls, force);
}

// ===== 要素生成ヘルパー =====
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') el.className = value;
    else if (key === 'textContent') el.textContent = value;
    else if (key === 'innerHTML') el.innerHTML = value;
    else if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    }
    else el.setAttribute(key, value);
  });
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  });
  return el;
}
