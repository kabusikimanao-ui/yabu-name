import { getUIState, setUIState } from '../ui-render.js';
import { getCurrentLang } from '../i18n.js';
import { escapeHtml } from '../utils.js';
import { Net } from '../network.js';

export function initChat() {
  const input = document.getElementById('chatInput');
  const send = document.getElementById('chatSend');
  const header = document.getElementById('chatHeader');
  const panel = document.getElementById('chatPanel');

  if (panel) panel.style.display = 'none';

  if (header) {
    header.onclick = function() {
      const { chatCollapsed } = getUIState();
      const newCollapsed = !chatCollapsed;
      setUIState({ chatCollapsed: newCollapsed });
      if (panel) {
        if (newCollapsed) panel.classList.add('collapsed');
        else panel.classList.remove('collapsed');
      }
    };
  }

  if (!input || !send) return;
  send.onclick = () => {
    const text = input.value.trim();
    if (!text) return;
    Net.chat(text);
    input.value = '';
  };
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send.click();
  });
}

export function handleChatMessage(chatMsg) {
  const { chatMessages } = getUIState();
  chatMessages.push(chatMsg);
  if (chatMessages.length > 50) chatMessages.shift();
  setUIState({ chatMessages });
  
  const messages = document.getElementById('chatMessages');
  if (messages) {
    const lang = getCurrentLang();
    messages.innerHTML = chatMessages.map(m => {
      const time = new Date(m.ts).toLocaleTimeString(lang === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      return `<div class="chat-message"><span class="chat-time">[${escapeHtml(time)}]</span><span class="chat-name">${escapeHtml(m.name)}:</span> <span class="chat-text">${escapeHtml(m.text)}</span></div>`;
    }).join('');
    messages.scrollTop = messages.scrollHeight;
  }
  
  const panel = document.getElementById('chatPanel');
  if (panel) panel.style.display = 'block';
}
