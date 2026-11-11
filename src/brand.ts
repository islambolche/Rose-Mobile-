export const ROSE_BRAND = {
  name: "Rose",
  avatar: "/rose-avatar.jpg",
  chatBackground: "/rose-chat-bg.jpg",
  homeBackground: "/rose-bg.webp",
  accent: "#8B5CF6",
  themeColor: "#1E1035",
  outerGradientStart: "#090418",
  outerGradientMid: "#13092D",
  outerGradientEnd: "#050716",
  scrollbarThumb: "rgba(139, 92, 246, 0.35)",
  scrollbarTrack: "rgba(10, 6, 24, 0.45)",
} as const;

export function getRoseWebManifest() {
  return {
    name: ROSE_BRAND.name,
    short_name: ROSE_BRAND.name,
    display: "standalone",
    background_color: ROSE_BRAND.outerGradientStart,
    theme_color: ROSE_BRAND.themeColor,
    orientation: "portrait",
    start_url: "/",
    icons: [
      {
        src: ROSE_BRAND.avatar,
        sizes: "256x256",
        type: "image/jpeg",
        purpose: "any maskable",
      },
    ],
  };
}
