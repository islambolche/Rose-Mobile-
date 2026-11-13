export interface AgentPosition {
  x: number; // feet point percentage (0 - 100%)
  y: number; // feet point percentage (0 - 100%)
  scale?: number; // scale multiplier, default 1.0
}

export interface RouteWaypoint {
  x: number;
  y: number;
}

export interface AgentRouteConfig {
  waypoints: RouteWaypoint[];
  roseFacing: "left" | "right";
  agentFacing: "left" | "right";
}

export interface OfficeAgentConfig {
  id: string;
  name: string;
  role: string;
  color: string;
  image: string;
  avatar: string;
  defaultX: number;
  defaultY: number;
  defaultHeight: number; // base height in % of office height
  initialFacing: "left" | "right";
}

// Stand points beside each desk (feet point stage percentages x, y where agents stand/meet):
export const DEFAULT_STAND_POSITIONS: Record<string, AgentPosition> = {
  rose:  { x: 31, y: 63, scale: 1.0 },
  mira:  { x: 32, y: 60, scale: 1.0 },
  arin:  { x: 39, y: 44, scale: 1.0 },
  zayan: { x: 61, y: 44, scale: 1.0 },
  naira: { x: 68, y: 60, scale: 1.0 },
};

// Left and right stand spots beside Rose's desk
export const ROSE_DESK_SIDES: Record<"left" | "right", AgentPosition> = {
  left:  { x: 31, y: 63, scale: 1.0 },
  right: { x: 69, y: 63, scale: 1.0 },
};

// Walkable floor aisles (never cross desks or behind chairs)
export const OFFICE_AISLES = {
  frontY: 90,
  frontMinX: 8,
  frontMaxX: 92,
  leftX: 37,
  rightX: 63,
  minY: 44,
  maxY: 90,
};

// Aliased as DEFAULT_OFFICE_POSITIONS for backwards compatibility
export const DEFAULT_OFFICE_POSITIONS = DEFAULT_STAND_POSITIONS;

// Default seated positions (hips point x%, y% of the office):
export const DEFAULT_SEAT_POSITIONS: Record<string, AgentPosition> = {
  arin:  { x: 23.9, y: 35.3, scale: 1.0 },
  zayan: { x: 75.8, y: 35.3, scale: 1.0 },
  rose:  { x: 49.9, y: 52.1, scale: 1.0 },
  mira:  { x: 12.3, y: 57.9, scale: 1.0 },
  naira: { x: 89.0, y: 59.5, scale: 1.0 },
};

// Default desk name label positions (Bengali desk front glowing border):
export const DEFAULT_LABEL_POSITIONS: Record<string, AgentPosition> = {
  rose:  { x: 50.4, y: 64.5, scale: 1.0 },
  mira:  { x: 15.0, y: 69.5, scale: 1.0 },
  arin:  { x: 23.3, y: 42.5, scale: 1.0 },
  zayan: { x: 77.0, y: 42.0, scale: 1.0 },
  naira: { x: 84.6, y: 70.5, scale: 1.0 },
};

// Rose's front-aisle routes from her desk side to each agent's meeting spot
export const DEFAULT_ROSE_ROUTES: Record<string, AgentRouteConfig> = {
  arin: {
    waypoints: [
      { x: 31, y: 63 },
      { x: 31, y: 90 },
      { x: 37, y: 90 },
      { x: 37, y: 49 },
    ],
    roseFacing: "right",
    agentFacing: "left",
  },
  mira: {
    waypoints: [
      { x: 31, y: 63 },
      { x: 31, y: 90 },
      { x: 37, y: 90 },
      { x: 37, y: 60 },
    ],
    roseFacing: "left",
    agentFacing: "right",
  },
  zayan: {
    waypoints: [
      { x: 69, y: 63 },
      { x: 69, y: 90 },
      { x: 63, y: 90 },
      { x: 63, y: 49 },
    ],
    roseFacing: "left",
    agentFacing: "right",
  },
  naira: {
    waypoints: [
      { x: 69, y: 63 },
      { x: 69, y: 90 },
      { x: 63, y: 90 },
      { x: 63, y: 60 },
    ],
    roseFacing: "right",
    agentFacing: "left",
  },
};

export const DESK_BENGALI_NAMES: Record<string, string> = {
  rose: "রোজ",
  mira: "মিরা",
  arin: "আরিন",
  zayan: "জায়ান",
  naira: "নাইরা",
};

export const DESK_GLOW_COLORS: Record<string, { color: string; glow: string; textShadow: string }> = {
  rose: {
    color: "#F472B6",
    glow: "#EC4899",
    textShadow: "0 0 6px #EC4899, 0 0 14px rgba(236,72,153,0.9), 0 0 24px rgba(236,72,153,0.6)",
  },
  mira: {
    color: "#34D399",
    glow: "#10B981",
    textShadow: "0 0 6px #10B981, 0 0 14px rgba(16,185,129,0.9), 0 0 24px rgba(16,185,129,0.6)",
  },
  arin: {
    color: "#60A5FA",
    glow: "#3B82F6",
    textShadow: "0 0 6px #3B82F6, 0 0 14px rgba(59,130,246,0.9), 0 0 24px rgba(59,130,246,0.6)",
  },
  zayan: {
    color: "#FB923C",
    glow: "#F97316",
    textShadow: "0 0 6px #F97316, 0 0 14px rgba(249,115,22,0.9), 0 0 24px rgba(249,115,22,0.6)",
  },
  naira: {
    color: "#C084FC",
    glow: "#A855F7",
    textShadow: "0 0 6px #A855F7, 0 0 14px rgba(168,85,247,0.9), 0 0 24px rgba(168,85,247,0.6)",
  },
};

// Desk overlay bottom y% depth sorting thresholds
export const DESK_BOTTOMS: Record<string, number> = {
  arin: 53,
  zayan: 53,
  rose: 79,
  mira: 87,
  naira: 88,
};

// Desk overlay image paths
export const DESK_OVERLAYS: Record<string, string> = {
  arin: "/office/desk-arin.png",
  zayan: "/office/desk-zayan.png",
  rose: "/office/desk-rose.png",
  mira: "/office/desk-mira.png",
  naira: "/office/desk-naira.png",
};

export const STORAGE_KEY_OFFICE_POSITIONS = "rose_office_positions_v2";
export const STORAGE_KEY_OFFICE_SEAT_POSITIONS = "rose_office_seat_positions";
export const STORAGE_KEY_OFFICE_LABEL_POSITIONS = "rose_office_label_positions";
export const STORAGE_KEY_OFFICE_ROUTES = "rose_office_routes_v2";

/**
 * Perspective height calculator:
 * Scales sprite smoothly smaller when further back (smaller y) and larger in front (larger y).
 * y=35 -> ~17.5%, y=44 -> ~19.4%, y=52 -> ~21%, y=90 -> ~28.8%, y=96 -> 30%.
 */
export function calculatePerspectiveHeight(y: number): number {
  const minY = 35;
  const maxY = 96;
  const minH = 17.5;
  const maxH = 30.0;
  const clampedY = Math.max(minY, Math.min(97, y));
  const t = (clampedY - minY) / (maxY - minY);
  return minH + t * (maxH - minH);
}

/**
 * Truncates instruction text for speech bubble (max 65 chars, strips leading name triggers)
 */
export function cleanInstructionBubbleText(rawText: string, _targetAgentId?: string): string {
  if (!rawText) return "";
  let text = rawText.trim();

  // Strip common leading words (রোজ, Rose, agent names, pronouns, punctuation)
  const stripRegex = /^(?:রোজ|rose|মিরা|mira|আরিন|arin|জায়ান|zayan|নাইরা|naira|কে|বল|বলো|জিজ্ঞেস|করো|please|পিক|টাস্ক|task|[,:\-\s]+)+/i;
  text = text.replace(stripRegex, "").trim();

  if (!text) text = rawText.trim();
  if (text.length > 65) {
    return text.substring(0, 64) + "…";
  }
  return text;
}

/**
 * Truncates result text for agent speech bubble (max 70 chars)
 */
export function cleanResultBubbleText(rawText: string): string {
  if (!rawText) return "";
  const text = rawText.trim();
  if (text.length > 70) {
    return text.substring(0, 69) + "…";
  }
  return text;
}

export function loadOfficeLabelPositions(): Record<string, AgentPosition> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFICE_LABEL_POSITIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_LABEL_POSITIONS, ...parsed };
      }
    }
  } catch {}
  return { ...DEFAULT_LABEL_POSITIONS };
}

export function saveOfficeLabelPositions(positions: Record<string, AgentPosition>) {
  try {
    localStorage.setItem(STORAGE_KEY_OFFICE_LABEL_POSITIONS, JSON.stringify(positions));
  } catch {}
}

export function resetOfficeLabelPositions(): Record<string, AgentPosition> {
  try {
    localStorage.removeItem(STORAGE_KEY_OFFICE_LABEL_POSITIONS);
  } catch {}
  return { ...DEFAULT_LABEL_POSITIONS };
}

export function loadOfficePositions(): Record<string, AgentPosition> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFICE_POSITIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_STAND_POSITIONS, ...parsed };
      }
    }
  } catch {}
  return { ...DEFAULT_STAND_POSITIONS };
}

export function saveOfficePositions(positions: Record<string, AgentPosition>) {
  try {
    localStorage.setItem(STORAGE_KEY_OFFICE_POSITIONS, JSON.stringify(positions));
  } catch {}
}

export function resetOfficePositions(): Record<string, AgentPosition> {
  try {
    localStorage.removeItem(STORAGE_KEY_OFFICE_POSITIONS);
  } catch {}
  return { ...DEFAULT_STAND_POSITIONS };
}

export function loadOfficeSeatPositions(): Record<string, AgentPosition> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFICE_SEAT_POSITIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_SEAT_POSITIONS, ...parsed };
      }
    }
  } catch {}
  return { ...DEFAULT_SEAT_POSITIONS };
}

export function saveOfficeSeatPositions(positions: Record<string, AgentPosition>) {
  try {
    localStorage.setItem(STORAGE_KEY_OFFICE_SEAT_POSITIONS, JSON.stringify(positions));
  } catch {}
}

export function resetOfficeSeatPositions(): Record<string, AgentPosition> {
  try {
    localStorage.removeItem(STORAGE_KEY_OFFICE_SEAT_POSITIONS);
  } catch {}
  return { ...DEFAULT_SEAT_POSITIONS };
}

export function loadOfficeRoutes(): Record<string, AgentRouteConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFICE_ROUTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_ROSE_ROUTES, ...parsed };
      }
    }
  } catch {}
  return { ...DEFAULT_ROSE_ROUTES };
}

export function saveOfficeRoutes(routes: Record<string, AgentRouteConfig>) {
  try {
    localStorage.setItem(STORAGE_KEY_OFFICE_ROUTES, JSON.stringify(routes));
  } catch {}
}

export function resetOfficeRoutes(): Record<string, AgentRouteConfig> {
  try {
    localStorage.removeItem(STORAGE_KEY_OFFICE_ROUTES);
  } catch {}
  return { ...DEFAULT_ROSE_ROUTES };
}

export const OFFICE_AGENTS: Record<string, OfficeAgentConfig> = {
  rose: {
    id: "rose",
    name: "Rose",
    role: "Chief Business Manager",
    color: "#EC4899", // Pink
    image: "/office/rose.png",
    avatar: "/office/avatars/rose.png",
    defaultX: 31,
    defaultY: 63,
    defaultHeight: 23,
    initialFacing: "right",
  },
  mira: {
    id: "mira",
    name: "Mira",
    role: "Customer Communication",
    color: "#10B981", // Green
    image: "/office/mira.png",
    avatar: "/office/avatars/mira.png",
    defaultX: 32,
    defaultY: 60,
    defaultHeight: 23,
    initialFacing: "right",
  },
  naira: {
    id: "naira",
    name: "Naira",
    role: "Business Audit & Analytics",
    color: "#A855F7", // Purple
    image: "/office/naira.png",
    avatar: "/office/avatars/naira.png",
    defaultX: 68,
    defaultY: 60,
    defaultHeight: 23,
    initialFacing: "left",
  },
  arin: {
    id: "arin",
    name: "Arin",
    role: "Sales & Order",
    color: "#3B82F6", // Blue
    image: "/office/arin.png",
    avatar: "/office/avatars/arin.png",
    defaultX: 39,
    defaultY: 44,
    defaultHeight: 19,
    initialFacing: "right",
  },
  zayan: {
    id: "zayan",
    name: "Zayan",
    role: "Parcel & Delivery",
    color: "#F97316", // Orange
    image: "/office/zayan.png",
    avatar: "/office/avatars/zayan.png",
    defaultX: 61,
    defaultY: 44,
    defaultHeight: 19,
    initialFacing: "left",
  },
};

export const OFFICE_AGENT_LIST = Object.values(OFFICE_AGENTS);

