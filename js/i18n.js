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
    flip5: '「↓5↑」は特別な数字（flip）です',
    previousRoom: '前回の部屋',
    restoreRoom: 'この部屋を復元',
    clear: '削除',
    roomInUse: 'この部屋番号は既に使用されています。別のブラウザで開いている可能性があります。',
    winner: '勝者',
    mostDeceived: '一番だまされた人',
    worstGuesser: '一番推理を外した人'
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
    worstGuesser: 'Worst Guesser'
  }
};

export function t(key, lang = 'ja') {
  try {
    const keys = key.split('.');
    let obj = i18n[lang];
    for (const k of keys) {
      if (obj && obj[k] !== undefined) {
        obj = obj[k];
      } else {
        return key;
      }
    }
    return obj || key;
  } catch(e) {
    return key;
  }
}
