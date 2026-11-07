export const isDesktopMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check Capacitor native platform
  const cap = (window as any).Capacitor;
  const isNative = cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  if (isNative) return false;

  // Check window width >= 1024
  if (window.innerWidth < 1024) return false;

  // Check fine pointer (mouse)
  try {
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (!hasFinePointer) return false;
  } catch (e) {
    // Fallback if matchMedia not supported
  }

  // Check user preference for classic view
  try {
    const classic = localStorage.getItem('iyabd_classic_view');
    if (classic === 'true') return false;
  } catch (e) {}

  return true;
};
