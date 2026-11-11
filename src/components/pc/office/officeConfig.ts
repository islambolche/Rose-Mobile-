export interface AgentPosition {
  x: number; // feet point percentage (0 - 100%)
  y: number; // feet point percentage (0 - 100%)
  scale?: number; // scale multiplier, default 1.0
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

// Default standing positions (x%, y% of the office):
export const DEFAULT_OFFICE_POSITIONS: Record<string, AgentPosition> = {
  mira: { x: 34, y: 93, scale: 1.0 },
  rose: { x: 64, y: 86, scale: 1.0 },
  naira: { x: 74, y: 99, scale: 1.0 },
  arin: { x: 39, y: 52, scale: 1.0 },
  zayan: { x: 92, y: 50, scale: 1.0 },
};

// Default seated positions (hips point x%, y% of the office):
export const DEFAULT_SEAT_POSITIONS: Record<string, AgentPosition> = {
  arin:  { x: 23.9, y: 35.3, scale: 1.0 },
  zayan: { x: 75.8, y: 35.3, scale: 1.0 },
  rose:  { x: 49.9, y: 52.1, scale: 1.0 },
  mira:  { x: 12.3, y: 57.9, scale: 1.0 },
  naira: { x: 89.0, y: 59.5, scale: 1.0 },
};

// Desk overlay bottom y% for depth calculations
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

export const STORAGE_KEY_OFFICE_POSITIONS = "rose_office_positions";
export const STORAGE_KEY_OFFICE_SEAT_POSITIONS = "rose_office_seat_positions";

export function loadOfficePositions(): Record<string, AgentPosition> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFICE_POSITIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_OFFICE_POSITIONS, ...parsed };
      }
    }
  } catch {}
  return { ...DEFAULT_OFFICE_POSITIONS };
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
  return { ...DEFAULT_OFFICE_POSITIONS };
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

export const OFFICE_AGENTS: Record<string, OfficeAgentConfig> = {
  rose: {
    id: "rose",
    name: "Rose",
    role: "Chief Business Manager",
    color: "#EC4899", // Pink
    image: "/office/rose.png",
    avatar: "/office/avatars/rose.jpg",
    defaultX: 64,
    defaultY: 86,
    defaultHeight: 30,
    initialFacing: "right",
  },
  mira: {
    id: "mira",
    name: "Mira",
    role: "Customer Communication",
    color: "#10B981", // Green
    image: "/office/mira.png",
    avatar: "/office/avatars/mira.jpg",
    defaultX: 34,
    defaultY: 93,
    defaultHeight: 30,
    initialFacing: "right",
  },
  naira: {
    id: "naira",
    name: "Naira",
    role: "Business Audit & Analytics",
    color: "#A855F7", // Purple
    image: "/office/naira.png",
    avatar: "/office/avatars/naira.jpg",
    defaultX: 74,
    defaultY: 99,
    defaultHeight: 30,
    initialFacing: "left",
  },
  arin: {
    id: "arin",
    name: "Arin",
    role: "Sales & Order",
    color: "#3B82F6", // Blue
    image: "/office/arin.png",
    avatar: "/office/avatars/arin.jpg",
    defaultX: 39,
    defaultY: 52,
    defaultHeight: 22,
    initialFacing: "right",
  },
  zayan: {
    id: "zayan",
    name: "Zayan",
    role: "Parcel & Delivery",
    color: "#F97316", // Orange
    image: "/office/zayan.png",
    avatar: "/office/avatars/zayan.jpg",
    defaultX: 92,
    defaultY: 50,
    defaultHeight: 22,
    initialFacing: "left",
  },
};

export const OFFICE_AGENT_LIST = Object.values(OFFICE_AGENTS);
