export function openExternal(url: string): void {
  if (!url || typeof window === 'undefined') return;
  const win = window as any;
  const isNative = Boolean(win.Capacitor?.isNativePlatform?.());
  const isWebView = typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' && navigator.userAgent.includes('wv');

  if (isNative || isWebView) {
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener');
  }
}
