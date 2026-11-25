export function isHapticEnabled() {
  try {
    return localStorage.getItem('habito_haptic') !== 'false';
  } catch {
    return true;
  }
}

export function isAutoRestEnabled() {
  try {
    return localStorage.getItem('habito_autorest') !== 'false';
  } catch {
    return true;
  }
}

export function getWeightIncrement() {
  try {
    const saved = localStorage.getItem('habito_athlete_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.increment === '1.25 kg') return 1.25;
      if (parsed?.increment === '2.5 kg') return 2.5;
    }
  } catch {}
  return 2.5;
}

export function triggerSafeVibrate(pattern = 10) {
  if (!isHapticEnabled()) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}
