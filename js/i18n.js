// ===== 多言語定義（Issue #18対応） =====
export const i18n = {
  ja: {
    chat: 'チャット',
    send: '送信',
    createRoom: '部屋を作る（ホスト）',
    joinRoom: '部屋に入る',
    howToPlay: '遊び方・ルールを見る',
    enterName: 'あなたの名前',
    roomCode: '部屋番号',
    customRoomCode: '自分で部屋番号を決める',
    expansionRule: '拡張ルール（容疑者と被害者の入れ替え）',
    dontUse: '使わない',
    use: '使う',
    create: '部屋を作成する',
    join: 'この部屋に入る',
    back: '戻る',
    start: '捜査を開始する',
    waiting: 'ホストの開始を待っています',
    confirm: '確認完了',
    viewEvidence: '証拠を確認する',
    next: '決定して次の人へ',
    finalTruth: '全員の証言が出そろった — 真相を確かめる',
    swap: 'と入れ替える',
    noSwap: '入れ替えない',
    culprit: '真犯人',
    victim: '被害者',
    suspect: '容疑者',
    unseen: '見なかった',
    confirmed: '確認済',
    yourTurn: 'あなたの手番',
    waitingOther: '他のプレイヤーを待っています',
    round: '第',
    turn: '手番',
    alibi: 'アリバイ確認',
    reveal: '真相解明',
    result: '結果',
    gameEnd: '捜査終了',
    playAgain: 'もう一度、同じ面子で',
    leave: '退出する',
    disconnected: 'ホストとの接続が切れました',
    reconnect: '部屋番号を入力し直す',
    minimumPlayers: '最低2人集まると開始できます',
    maxPlayers: '最大5人',
    flip5: '「↓5↑」は特別な数字です',
    previousRoom: '前回の部屋',
    restoreRoom: 'この部屋を復元',
    clear: '削除',
    roomInUse: 'この部屋番号は既に使用されています。別のブラウザで開いている可能性があります。',
    winner: '勝者',
    mostDeceived: '一番だまされた人',
    worstGuesser: '一番推理を外した人',
    gameStartedError: 'この部屋はすでにゲームを開始しています。',
    roomFullError: 'この部屋は満員です（最大5人）。',
    notYourTurn: 'あなたの手番ではありません。',
    invalidRequest: '不正な要求です。',
    wrongPhase: 'フェーズが違います。',
    unknownRequest: '不明な要求です。',
    connectionError: '接続エラーが発生しました。',
    roomNotFound: 'その部屋は見つかりません。番号を確認してください。',
    codeLengthError: '部屋番号は3〜6文字で入力してください。',
    enterCode: '部屋番号を入力してください。',
    customCodeExample: '例：MYROOM',
    nameExample: '例：探偵1',
    nameExample2: '例：探偵2',
    host: 'ホスト',
    you: 'あなた',
    disconnectedTag: '切断中',
    hand: '手持ち',
    fail: '失敗',
    empty: '空席',
    neighborAlibi: '隣のアリバイ',
    checkTiles: '手元の人物を確認する',
    hideNext: '伏せて次へ',
    alibiComplete: 'アリバイ確認 — 完了',
    waitingOthers: '他のプレイヤーの確認が終わるのを待っています…',
    confirmedCount: '確認済み',
    firstDetective: 'あなたは第一発見者。',
    remainingSelect: '人選択可能',
    tapSuspect: '円卓上の容疑者カードをタッチして',
    checkNumbers: '、好きな2人の数字を確かめよ。',
    exceptPrevious: '前の人が犯人だと示した場所以外、残り2人の',
    touchRemaining: '容疑者カードをタッチして数字を確認せよ。',
    expansionDesc: '拡張ルール：望むなら、容疑者1人と被害者のタイルを入れ替えられる（数字は公開されない）。',
    tapCulprit: '誰が犯人だと思うか、円卓上の容疑者をタップしてチップを置け。選択すると光って強調されます。',
    currentlySelected: '現在',
    selected: 'を選択中。別の容疑者を選ぶ場合は円卓上のカードを再度タップしてください。',
    waitingHost: 'ホストが次に進めるのを待っています',
    nextRound: '次のラウンドへ',
    viewFinal: '最終結果を見る',
    impossible: 'ありえない組み合わせだった。',
    hasFiveExplain: '容疑者の中に「↓5↑」が含まれているため、最も小さい数字を持つ',
    noFiveExplain: '最も大きい数字を持つ',
    wasCulprit: 'が真犯人だった。',
    allRoundsEnd: 'ラウンドを終え、事件簿は閉じられた。',
    waitingHostFinal: 'ホストの操作を待っています…',
    tabCloseWarning: 'ゲームが進行中です。タブを閉じると部屋が削除されます。',
    leaveConfirm: '本当に退出しますか？\nホストの場合、ゲーム状態は保存され、後で復元できます。',
    person: '人',
    hidden: '伏 せ',
    victimKanji: '被 害 者',
    alibiDesc: 'この事件とは無関係な人物のタイルが、あなたと隣に座る',
    alibiDesc2: 'にそれぞれ配られている。両方を確かめよう。容疑者の数字を推理する除外情報になる。',
    alibiRevealed: 'の手元がめくれた。これで2人分の「無関係な人物」が分かった——場の4体の中には含まれない数字だ。',
    waitingAlibi: 'アリバイ確認で表示されます',
    touchToConfirm: '容疑者カードをタッチして確認してください',
    listeningTestimony: '証言を聞いています',
    currentTurn: '今の手番',
    connecting: '接続しています',
    createRoomTitle: '部屋を作る',
    hostDesc: 'あなたの端末がこの部屋の進行役になります。2〜5人集まったら、あなたが開始ボタンを押してゲームを始めます。ゲームが終わるまで、このタブを閉じないでください。',
    joinRoomTitle: '部屋に入る',
    joinDesc: 'ホストから伝えられた部屋番号を入力してください。',
    lobbyTitle: '捜査本部 — 集合待ち',
    lobbyDesc: 'この番号を仲間に伝えて、参加してもらいましょう。',
    directConnect: '直接接続中（P2P・リアルタイム反映）',
    confirmedPeople: '確認済みの人物（ターン中ずっと表示）',
    confirmedSuspects: '確認した容疑者（ターン中ずっと表示）',
    chatPlaceholder: 'メッセージを入力...',
    unknown: '不明',
    youChat: 'あなた',
    notConnected: 'Not connected',
    phase: 'フェーズ',
    players: 'プレイヤー',
    personCount: '人',
    titleDesc: '竹林に横たわる一体の敵。容疑者は三人。2〜5人で遊ぶ新版',
    noticeText: 'このバージョンは2〜5人対応。ブラウザ同士がWebRTCで直接通信します。部屋を作った人の端末がゲームの進行を管理します。部屋番号は自分で決められます（3〜6文字）。容疑者カードをタッチして数字を確認します。「↓5↑」は特別な数字です。',
    onlineGame: 'オンライン推理ゲーム',
    sealText: '検',
    disconnectedSeal: '切',
    connectingSeal: '…',
    // Issue #4: ブラウザ通知
    notificationTitle: 'あなたの手番です！',
    notificationBody: '藪の中であなたのターンが回ってきました。',
    notificationPermission: '通知を許可する',
    notificationAllowed: '通知が許可されました',
    notificationDenied: '通知が拒否されました',
    // Issue #8: ダークモード
    darkMode: 'ダークモード',
    lightMode: 'ライトモード',
    // Issue #9: 対戦履歴
    history: '対戦履歴',
    noHistory: '対戦履歴がありません',
    date: '日付',
    rounds: 'ラウンド',
    // Issue #10: 統計
    stats: '統計',
    totalGames: '総プレイ数',
    winRate: '勝率',
    avgFailChips: '平均失敗チップ数',
    correctRate: '正解率',
    // Issue #11: スクリーンショット
    saveScreenshot: '結果を保存',
    shareResult: '結果を共有',
    screenshotSaved: 'スクリーンショットを保存しました',
    // Issue #12: チュートリアル
    tutorial: 'チュートリアル',
    tutorialSkip: 'スキップ',
    tutorialNext: '次へ',
    tutorialPrev: '戻る',
    tutorialStep1: 'ようこそ！このゲームは2〜5人で遊ぶ推理ゲームです。',
    tutorialStep2: 'まず、アリバイ確認フェーズで自分と隣のプレイヤーのタイルを確認します。',
    tutorialStep3: '次に、証言フェーズで容疑者の数字を確認し、犯人を推理します。',
    tutorialStep4: '最後に、全員の証言が出そろったら真相を解明します。',
    tutorialFinish: 'チュートリアルを終了する', // 追加
    // Issue #13: エモート
    emotes: 'リアクション',
    // Issue #14: PWA
    installApp: 'アプリをインストール',
    installPrompt: 'ホーム画面に追加してアプリのように使えます',
    // Issue #16: 名前変更
    changeName: '名前を変更',
    nameChanged: '名前を変更しました',
    // Issue #17: キック
    kickPlayer: 'キック',
    kickConfirm: 'このプレイヤーを部屋から追い出しますか？',
    kickedMessage: '部屋から追い出されました',
    // Issue #18: 言語
    language: '言語',
    // Issue #19: アクセシビリティ
    accessibility: 'アクセシビリティ',
    highContrast: '高コントラスト',
    reduceMotion: '動きを軽減',
    // Issue #20: ボット
    botMode: 'ボット対戦',
    botThinking: 'ボットが思考中…',
    bot: 'ボット',
    singlePlayer: '1人プレイ',
    backToLobby: 'ロビーに戻る'
  },
  en: {
    chat: 'Chat',
    send: 'Send',
    createRoom: 'Create Room (Host)',
    joinRoom: 'Join Room',
    howToPlay: 'How to Play',
    enterName: 'Your Name',
    roomCode: 'Room Code',
    customRoomCode: 'Set Custom Room Code',
    expansionRule: 'Expansion Rule (Swap Suspect & Victim)',
    dontUse: "Don't Use",
    use: 'Use',
    create: 'Create Room',
    join: 'Join Room',
    back: 'Back',
    start: 'Start Investigation',
    waiting: 'Waiting for host to start',
    confirm: 'Confirm',
    viewEvidence: 'View Evidence',
    next: 'Confirm & Next Player',
    finalTruth: "All testimonies ready — Reveal the truth",
    swap: 'Swap with',
    noSwap: "Don't Swap",
    culprit: 'Culprit',
    victim: 'Victim',
    suspect: 'Suspect',
    unseen: 'Unseen',
    confirmed: 'Confirmed',
    yourTurn: 'Your Turn',
    waitingOther: 'Waiting for other players',
    round: 'Round',
    turn: 'Turn',
    alibi: 'Alibi Check',
    reveal: 'Reveal Truth',
    result: 'Result',
    gameEnd: 'Investigation Complete',
    playAgain: 'Play Again',
    leave: 'Leave Room',
    disconnected: 'Disconnected from host',
    reconnect: 'Re-enter Room Code',
    minimumPlayers: 'Minimum 2 players required',
    maxPlayers: 'Max 5 players',
    flip5: '"↓5↑" is a special number (flip)',
    previousRoom: 'Previous Room',
    restoreRoom: 'Restore This Room',
    clear: 'Clear',
    roomInUse: 'This room code is already in use. It may be open in another browser.',
    winner: 'Winner',
    mostDeceived: 'Most Deceived',
    worstGuesser: 'Worst Guesser',
    gameStartedError: 'This room has already started the game.',
    roomFullError: 'This room is full (max 5 players).',
    notYourTurn: 'It\'s not your turn.',
    invalidRequest: 'Invalid request.',
    wrongPhase: 'Wrong phase.',
    unknownRequest: 'Unknown request.',
    connectionError: 'Connection error occurred.',
    roomNotFound: 'Room not found. Please check the code.',
    codeLengthError: 'Room code must be 3-6 characters.',
    enterCode: 'Please enter a room code.',
    customCodeExample: 'Ex: MYROOM',
    nameExample: 'Ex: Detective1',
    nameExample2: 'Ex: Detective2',
    host: 'Host',
    you: 'You',
    disconnectedTag: 'Disconnected',
    hand: 'Hand',
    fail: 'Fail',
    empty: 'Empty',
    neighborAlibi: 'Neighbor\'s Alibi',
    checkTiles: 'Check Your Tiles',
    hideNext: 'Hide & Next',
    alibiComplete: 'Alibi Check — Complete',
    waitingOthers: 'Waiting for other players to finish checking…',
    confirmedCount: 'Confirmed',
    firstDetective: 'You are the first detective.',
    remainingSelect: 'more can be selected',
    tapSuspect: 'Touch suspect cards on the table',
    checkNumbers: ' to check 2 people\'s numbers.',
    exceptPrevious: 'Except where the previous player indicated as culprit, ',
    touchRemaining: 'touch the remaining 2 suspect cards to check numbers.',
    expansionDesc: 'Expansion Rule: If desired, you can swap 1 suspect tile with the victim tile (number not revealed).',
    tapCulprit: 'Tap a suspect on the table to place your chip on who you think is the culprit. Selection will glow for emphasis.',
    currentlySelected: 'Currently selected: ',
    selected: '. Tap another suspect to change your choice.',
    waitingHost: 'Waiting for host to proceed',
    nextRound: 'Next Round',
    viewFinal: 'View Final Results',
    impossible: 'Impossible combination.',
    hasFiveExplain: 'with the smallest number is the true culprit because "↓5↑" is among the suspects.',
    noFiveExplain: 'with the largest number is the true culprit.',
    wasCulprit: 'is the true culprit.',
    allRoundsEnd: 'rounds completed. The case is closed.',
    waitingHostFinal: 'Waiting for host…',
    tabCloseWarning: 'Game in progress. Closing this tab will delete the room.',
    leaveConfirm: 'Are you sure you want to leave?\nIf you are the host, the game state will be saved and can be restored later.',
    person: 'P',
    hidden: 'Hidden',
    victimKanji: 'V I C T I M',
    alibiDesc: 'Tiles of "people unrelated to this case" are dealt to you and ',
    alibiDesc2: 'sitting next to you. Check both. This becomes exclusion information for deducing suspect numbers.',
    alibiRevealed: '\'s tiles revealed. Now you know 2 "unrelated people" — numbers not among the 4 at the scene.',
    waitingAlibi: 'Will be displayed after alibi check',
    touchToConfirm: 'Touch suspect cards to confirm',
    listeningTestimony: 'Listening to testimony',
    currentTurn: 'Current Turn',
    connecting: 'Connecting',
    createRoomTitle: 'Create Room',
    hostDesc: 'Your device will host this room. When 2-5 players gather, press the start button to begin. Do not close this tab until the game ends.',
    joinRoomTitle: 'Join Room',
    joinDesc: 'Enter the room code provided by the host.',
    lobbyTitle: 'Investigation HQ — Waiting',
    lobbyDesc: 'Share this code with your friends to join.',
    directConnect: 'Direct Connection (P2P・Real-time)',
    confirmedPeople: 'Confirmed People (Displayed Throughout Turn)',
    confirmedSuspects: 'Confirmed Suspects (Displayed Throughout Turn)',
    chatPlaceholder: 'Enter message...',
    unknown: 'Unknown',
    youChat: 'You',
    notConnected: 'Not connected',
    phase: 'Phase',
    players: 'Players',
    personCount: '',
    titleDesc: 'A corpse lies in the bamboo grove. Three suspects. New version for 2-5 players',
    noticeText: 'This version supports 2-5 players. Browsers communicate directly via WebRTC. The host\'s device manages game progression. You can set your own room code (3-6 characters). Touch suspect cards to check numbers. "↓5↑" is a special number (flip).',
    onlineGame: 'Online Deduction Game',
    sealText: 'INV',
    disconnectedSeal: '切',
    connectingSeal: '…',
    notificationTitle: 'It\'s your turn!',
    notificationBody: 'Your turn has come in In a Grove.',
    notificationPermission: 'Allow Notifications',
    notificationAllowed: 'Notifications allowed',
    notificationDenied: 'Notifications denied',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    history: 'Match History',
    noHistory: 'No match history',
    date: 'Date',
    rounds: 'Rounds',
    stats: 'Statistics',
    totalGames: 'Total Games',
    winRate: 'Win Rate',
    avgFailChips: 'Avg Fail Chips',
    correctRate: 'Correct Rate',
    saveScreenshot: 'Save Result',
    shareResult: 'Share Result',
    screenshotSaved: 'Screenshot saved',
    tutorial: 'Tutorial',
    tutorialSkip: 'Skip',
    tutorialNext: 'Next',
    tutorialPrev: 'Back',
    tutorialStep1: 'Welcome! This is a deduction game for 2-5 players.',
    tutorialStep2: 'First, check your and your neighbor\'s tiles in the Alibi Check phase.',
    tutorialStep3: 'Then, check suspect numbers and deduce the culprit in the Testimony phase.',
    tutorialStep4: 'Finally, reveal the truth when all testimonies are ready.',
    tutorialFinish: 'Finish Tutorial', // 追加
    emotes: 'Reactions',
    installApp: 'Install App',
    installPrompt: 'Add to home screen to use like an app',
    changeName: 'Change Name',
    nameChanged: 'Name changed',
    kickPlayer: 'Kick',
    kickConfirm: 'Kick this player from the room?',
    kickedMessage: 'You have been kicked from the room',
    language: 'Language',
    accessibility: 'Accessibility',
    highContrast: 'High Contrast',
    reduceMotion: 'Reduce Motion',
    botMode: 'Bot Battle',
    botThinking: 'Bot is thinking…',
    bot: 'Bot',
    singlePlayer: 'Single Player',
    backToLobby: 'Back to Lobby'
  },
  // Issue #18: 多言語拡充（簡易版）
  zh: {
    chat: '聊天',
    send: '发送',
    createRoom: '创建房间（房主）',
    joinRoom: '加入房间',
    howToPlay: '玩法说明',
    enterName: '你的名字',
    roomCode: '房间号',
    winner: '胜利者',
    leave: '离开房间',
    start: '开始调查',
    round: '第',
    turn: '回合',
    // 不足分は英語にフォールバック
  },
  ko: {
    chat: '채팅',
    send: '보내기',
    createRoom: '방 만들기 (호스트)',
    joinRoom: '방 참여',
    howToPlay: '게임 방법',
    enterName: '닉네임',
    roomCode: '방 번호',
    winner: '승자',
    leave: '방 나가기',
    start: '수사 시작',
    round: '라운드',
    turn: '턴',
  },
  es: {
    chat: 'Chat',
    send: 'Enviar',
    createRoom: 'Crear Sala (Anfitrión)',
    joinRoom: 'Unirse a Sala',
    howToPlay: 'Cómo Jugar',
    enterName: 'Tu Nombre',
    roomCode: 'Código de Sala',
    winner: 'Ganador',
    leave: 'Salir',
    start: 'Iniciar Investigación',
    round: 'Ronda',
    turn: 'Turno',
  }
};

// ===== 言語管理 =====
const LANG_KEY = 'yabu_lang';
const SUPPORTED_LANGS = ['ja', 'en', 'zh', 'ko', 'es'];

export function getCurrentLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch (e) {}
  // ブラウザの言語設定から推測
  const browserLang = navigator.language?.slice(0, 2);
  if (browserLang && SUPPORTED_LANGS.includes(browserLang)) return browserLang;
  return 'ja';
}

export function setCurrentLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = 'ja';
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {}
}

export function getSupportedLangs() {
  return SUPPORTED_LANGS;
}

export function getLangName(lang) {
  const names = {
    ja: '日本語',
    en: 'English',
    zh: '中文',
    ko: '한국어',
    es: 'Español'
  };
  return names[lang] || lang;
}

// ===== 翻訳関数 =====
export function t(key, lang = getCurrentLang()) {
  try {
    // 指定言語で検索
    let obj = i18n[lang];
    if (obj && obj[key] !== undefined) return obj[key];
    
    // 英語にフォールバック
    if (lang !== 'en' && i18n.en && i18n.en[key] !== undefined) {
      return i18n.en[key];
    }
    
    // キーをそのまま返す
    return key;
  } catch (e) {
    return key;
  }
}

// ===== 複数形対応（簡易版） =====
export function tn(key, count, lang = getCurrentLang()) {
  const base = t(key, lang);
  // 日本語は複数形なし
  if (lang === 'ja') return base;
  // 英語などは count に応じて変化（必要に応じて拡張）
  return `${count} ${base}`;
}

// ===== 言語切り替えイベント =====
export function onLangChange(callback) {
  window.addEventListener('yabu-lang-change', callback);
  return () => window.removeEventListener('yabu-lang-change', callback);
}

export function triggerLangChange(lang) {
  setCurrentLang(lang);
  window.dispatchEvent(new CustomEvent('yabu-lang-change', { detail: lang }));
}
