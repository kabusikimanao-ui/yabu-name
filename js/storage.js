const GAME_STATE_KEY = 'yabu_game_state';
const GAME_STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

export function saveGameState(room) {
  try{
    const data = {
      room: JSON.parse(JSON.stringify(room)),
      timestamp: Date.now()
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(data));
  }catch(e){
    console.warn('Failed to save game state:', e);
  }
}

export function loadGameState(){
  try{
    const saved = localStorage.getItem(GAME_STATE_KEY);
    if(!saved) return null;
    const data = JSON.parse(saved);
    if(Date.now() - data.timestamp > GAME_STATE_TTL_MS){
      localStorage.removeItem(GAME_STATE_KEY);
      return null;
    }
    return data.room;
  }catch(e){
    console.warn('Failed to load game state:', e);
    return null;
  }
}

export function clearGameState(){
  try{
    localStorage.removeItem(GAME_STATE_KEY);
  }catch(e){}
}

// トークン管理（再接続用）
const memTokenStore = {};

export function getOrCreateToken(code){
  const key = 'yabu_token_'+code;
  try{
    let t = localStorage.getItem(key);
    if(!t){ 
      t = 'tok_'+Math.random().toString(36).slice(2,12)+Date.now().toString(36); 
      localStorage.setItem(key, t); 
    }
    return t;
  }catch(e){
    if(!memTokenStore[key]){ 
      memTokenStore[key] = 'tok_'+Math.random().toString(36).slice(2,12)+Date.now().toString(36); 
    }
    return memTokenStore[key];
  }
}
