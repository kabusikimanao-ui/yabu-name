import { t } from '../i18n.js';
import { getNotificationPermission, setNotificationPermission } from '../storage.js';

export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  const current = getNotificationPermission();
  if (current === true) return;
  
  try {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        setNotificationPermission(true);
        showNotificationBanner(t('notificationAllowed'));
      } else {
        setNotificationPermission(false);
      }
    });
  } catch (e) {
    console.warn('Notification permission error:', e);
  }
}

export function showNotificationBanner(message) {
  const banner = document.createElement('div');
  banner.className = 'notification-banner';
  banner.textContent = message;
  document.body.appendChild(banner);
  setTimeout(() => {
    banner.classList.add('fade-out');
    setTimeout(() => document.body.removeChild(banner), 300);
  }, 3000);
}

export function sendTurnNotification(playerName) {
  if (getNotificationPermission() !== true) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  
  try {
    new Notification(t('notificationTitle'), {
      body: `${playerName} - ${t('notificationBody')}`,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔍</text></svg>'
    });
  } catch (e) {}
}
