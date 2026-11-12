export function openExternal(url: string): void {
  if (!url || typeof window === 'undefined') return;
  const win = window as any;
  const isNative = Boolean(win.Capacitor?.isNativePlatform?.());
  const isWebView =
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('wv');

  if (url.startsWith('tel:') || isNative || isWebView) {
    window.location.href = url;
    return;
  }

  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
