export const ROSE_BRAND = {
  name: "Rose",
  aliveName: "Rose Alive",
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
  mouthX: 52,
  mouthY: 59,
  mouthW: 5.2,
  mouthH: 1.9,
  mouthShadowColor: "rgba(88, 22, 44, 0.88)",
  hairGlowGradient:
    "radial-gradient(ellipse 65% 50% at 50% 28%, rgba(168, 85, 247, 0.95) 0%, rgba(139, 92, 246, 0.45) 48%, transparent 100%)",
} as const;

export type RoseAliveMovementStrength = "low" | "medium" | "high";

export interface RoseAliveSettings {
  enabled: boolean;
  mouthShadow: boolean;
  movementStrength: RoseAliveMovementStrength;
}

export const DEFAULT_ROSE_ALIVE_SETTINGS: RoseAliveSettings = {
  enabled: true,
  mouthShadow: true,
  movementStrength: "medium",
};

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
