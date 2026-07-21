// XSS対策：HTMLエスケープ
export function escapeHtml(str){
  if(str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 数字のフォーマット（flip値対応）
export function formatFlipValue(val){
  if(val === 5) return '↓5↑';
  if(val === 'blank') return '白';
  return String(val);
}

export function isFlipValue(val){
  return val === 5;
}

// ランダムな部屋番号生成
export function genCode(){
  const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s='';
  for(let i=0;i<4;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

// 配列をシャッフル
export function shuffle(arr){ 
  const a=arr.slice(); 
  for(let i=a.length-1;i>0;i--){ 
    const j=Math.floor(Math.random()*(i+1)); 
    [a[i],a[j]]=[a[j],a[i]]; 
  } 
  return a; 
}

// デッキの値を生成
export function freshDeckValues(n){ 
  let vals=[2,3,4,5,6,7,8,'blank']; 
  if(n===2) vals=[3,4,5,6,7,'blank'];
  else if(n===3) vals=vals.filter(v=>v!==2);
  return vals; 
}

// 真犯人を判定
export function computeCulprit(suspects){
  const numeric = suspects.map((v,i)=>({v,i})).filter(x=>x.v!=='blank');
  const hasFive = numeric.some(x=>x.v===5);
  if(numeric.length===0) return null;
  const pick = hasFive ? numeric.reduce((a,b)=> b.v<a.v?b:a) : numeric.reduce((a,b)=> b.v>a.v?b:a);
  return pick.i;
}

// プレイヤーカラー
export const PLAYER_COLORS = ['#8c2f26','#2c4a6b','#4f6b3f','#6b4f8c','#8b4513'];
