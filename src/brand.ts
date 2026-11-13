export const ROSE_BRAND = {
  name: "Rose",
  aliveName: "Rose Alive",
  avatar: "/agents/rose-avatar.png",
  chatBackground: "/rose-mobile.png",
  homeBackground: "/rose-mobile.png",
  officeBackground: "/rose-office.jpg",
  fullBodyAvatar: "/rose-full-body.jpg",
  accent: "#8B5CF6",
  themeColor: "#1E1035",
  outerGradientStart: "#090418",
  outerGradientMid: "#13092D",
  outerGradientEnd: "#050716",
  scrollbarThumb: "rgba(139, 92, 246, 0.35)",
  scrollbarTrack: "rgba(10, 6, 24, 0.45)",
  mouthX: 50,
  mouthY: 41,
  mouthW: 10,
  mouthH: 2,
  mouthShadowColor: "rgba(148, 52, 78, 0.9)",
  mouthGuideBorder: "#22C55E",
  mouthGuideBg: "rgba(34, 197, 94, 0.22)",
  hairGlowGradient:
    "radial-gradient(ellipse 65% 50% at 50% 28%, rgba(168, 85, 247, 0.95) 0%, rgba(139, 92, 246, 0.45) 48%, transparent 100%)",
} as const;

export type RoseAliveMovementStrength = "low" | "medium" | "high";

export interface RoseAliveSettings {
  enabled: boolean;
  mouthShadow: boolean;
  movementStrength: RoseAliveMovementStrength;
  mouthX: number;
  mouthY: number;
  mouthW: number;
  mouthH: number;
  showMouthGuide: boolean;
}

export const DEFAULT_ROSE_ALIVE_SETTINGS: RoseAliveSettings = {
  enabled: true,
  mouthShadow: true,
  movementStrength: "medium",
  mouthX: ROSE_BRAND.mouthX,
  mouthY: ROSE_BRAND.mouthY,
  mouthW: ROSE_BRAND.mouthW,
  mouthH: ROSE_BRAND.mouthH,
  showMouthGuide: false,
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
