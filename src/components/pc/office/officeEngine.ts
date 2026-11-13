import {
  OFFICE_AGENTS,
  OfficeAgentConfig,
  DEFAULT_STAND_POSITIONS,
  DEFAULT_SEAT_POSITIONS,
  DEFAULT_ROSE_ROUTES,
  ROSE_DESK_SIDES,
  OFFICE_AISLES,
  loadOfficePositions,
  loadOfficeSeatPositions,
  loadOfficeRoutes,
  cleanInstructionBubbleText,
  cleanResultBubbleText,
  RouteWaypoint,
  AgentPosition,
} from "./officeConfig";

export type AgentPoseState = "seated" | "standing" | "walking";

export interface AgentVisualState {
  id: string;
  status: AgentPoseState;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  facing: "left" | "right";
  isWalking: boolean;
  isWorking: boolean;
  isSeated: boolean;
  bubbleText: string | null;
  bubbleTimeoutId?: ReturnType<typeof setTimeout>;
}

export type OfficeEvent =
  | { type: "assign"; from: string; to: string; text: string }
  | { type: "working"; from: string; text: string }
  | { type: "reply"; from: string; to: string; text: string }
  | { type: "done"; agent: string; result: string };

type StateChangeListener = (states: Record<string, AgentVisualState>) => void;
type ChatMessageListener = (agent: OfficeAgentConfig, text: string) => void;

const ROLE_DEFAULT_INSTRUCTIONS: Record<string, string> = {
  mira: "মিরা, গ্রাহকদের মেসেজগুলো দেখে নাও।",
  arin: "আরিন, আজকের অর্ডার আর সেলস দেখো।",
  zayan: "জায়ান, পার্সেল ও ডেলিভারি স্ট্যাটাস দেখো।",
  naira: "নাইরা, আজকের হিসাব ও অডিট রিপোর্ট দেখো।",
};

const ROLE_ACK_TO_ROSE: Record<string, string> = {
  mira: "জি আপু, হাসিমুখে সব কাস্টমারকে রিপ্লাই দিচ্ছি।",
  arin: "জি ম্যাডাম! এখনই অর্ডার আর নাম্বার চেক করছি।",
  zayan: "জি আপু, পার্সেল ও ডেলিভারি স্ট্যাটাস দেখছি।",
  naira: "জি ম্যাডাম, ডেটা ও অডিট রিপোর্ট মিলিয়ে নিচ্ছি।",
};

const ROLE_PEER_REPLIES: Record<string, string> = {
  mira: "দারুণ! আমি কাস্টমারদের আপডেট জানিয়ে দিচ্ছি।",
  arin: "চলো, অর্ডার নাম্বারটা একসাথে মিলিয়ে নিই!",
  zayan: "ঠিক আছে, আমি ডেলিভারি আপডেট রেডি রাখছি।",
  naira: "ভালো, আমি রিপোর্টে ডেটাটা যোগ করে নিচ্ছি।",
};

const ROSE_PRAISES = [
  "দারুণ কাজ করেছো, ধন্যবাদ!",
  "খুব ভালো হয়েছে, এভাবেই এগিয়ে যাও।",
  "চমৎকার রিপোর্ট, ধন্যবাদ!",
];

function isLeftSideAgent(agentId: string): boolean {
  return agentId === "mira" || agentId === "arin";
}

function getAgentAisleX(agentId: string): number {
  return isLeftSideAgent(agentId) ? OFFICE_AISLES.leftX : OFFICE_AISLES.rightX;
}

class OfficeEngine {
  private states: Record<string, AgentVisualState> = {};
  private listeners: Set<StateChangeListener> = new Set();
  private chatListeners: Set<ChatMessageListener> = new Set();
  private eventQueue: OfficeEvent[] = [];
  private isProcessingEvent = false;
  private walkingAgents: Set<string> = new Set();

  constructor() {
    this.resetStates();
  }

  public resetStates() {
    const seatPositions = loadOfficeSeatPositions();
    const next: Record<string, AgentVisualState> = {};
    for (const [id, agent] of Object.entries(OFFICE_AGENTS)) {
      const pos = seatPositions[id] || DEFAULT_SEAT_POSITIONS[id] || { x: 50, y: 60 };
      next[id] = {
        id,
        status: "seated",
        x: pos.x,
        y: pos.y,
        facing: agent.initialFacing,
        isWalking: false,
        isWorking: false,
        isSeated: true,
        bubbleText: null,
      };
    }
    this.states = next;
    this.notify();
  }

  public reloadPositions() {
    const seatPositions = loadOfficeSeatPositions();
    const standPositions = loadOfficePositions();
    for (const [id] of Object.keys(OFFICE_AGENTS)) {
      const st = this.states[id];
      if (st && st.status !== "walking") {
        const isSeated = st.status === "seated";
        const pos = isSeated
          ? seatPositions[id] || DEFAULT_SEAT_POSITIONS[id] || { x: 50, y: 60 }
          : standPositions[id] || DEFAULT_STAND_POSITIONS[id] || { x: 50, y: 60 };
        this.states[id] = {
          ...st,
          x: pos.x,
          y: pos.y,
        };
      }
    }
    this.notify();
  }

  public getStates(): Record<string, AgentVisualState> {
    return { ...this.states };
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.states);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onChatMessage(listener: ChatMessageListener): () => void {
    this.chatListeners.add(listener);
    return () => {
      this.chatListeners.delete(listener);
    };
  }

  private notify() {
    const copy = { ...this.states };
    this.listeners.forEach((l) => l(copy));
  }

  public setWorking(agentId: string, working: boolean) {
    if (!this.states[agentId]) return;
    this.states[agentId] = {
      ...this.states[agentId],
      isWorking: working,
    };
    this.notify();
  }

  public setFacing(agentId: string, facing: "left" | "right") {
    if (!this.states[agentId]) return;
    this.states[agentId] = {
      ...this.states[agentId],
      facing,
    };
    this.notify();
  }

  public async standUp(
    agentId: string,
    facing?: "left" | "right",
    overrideStandPos?: AgentPosition
  ): Promise<void> {
    const state = this.states[agentId];
    if (!state) return;

    const standPositions = loadOfficePositions();
    const standPos =
      overrideStandPos ||
      standPositions[agentId] ||
      DEFAULT_STAND_POSITIONS[agentId] || { x: state.x, y: state.y };

    this.states[agentId] = {
      ...state,
      status: "standing",
      isSeated: false,
      isWalking: false,
      x: standPos.x,
      y: standPos.y,
      facing: facing || state.facing,
    };
    this.notify();
    await this.delay(180);
  }

  public async sitDown(agentId: string): Promise<void> {
    const state = this.states[agentId];
    if (!state) return;

    const seatPositions = loadOfficeSeatPositions();
    const seatPos = seatPositions[agentId] || DEFAULT_SEAT_POSITIONS[agentId] || { x: state.x, y: state.y };
    const agentConfig = OFFICE_AGENTS[agentId];

    this.states[agentId] = {
      ...state,
      status: "seated",
      isSeated: true,
      isWalking: false,
      x: seatPos.x,
      y: seatPos.y,
      facing: agentConfig ? agentConfig.initialFacing : state.facing,
    };
    this.notify();
    await this.delay(180);
  }

  public say(agentId: string, text: string, autoHideMs: number = 2400): Promise<void> {
    const agent = OFFICE_AGENTS[agentId];
    if (!agent || !this.states[agentId]) return Promise.resolve();

    if (this.states[agentId].bubbleTimeoutId) {
      clearTimeout(this.states[agentId].bubbleTimeoutId);
    }

    this.states[agentId] = {
      ...this.states[agentId],
      bubbleText: text,
      bubbleTimeoutId: undefined,
    };
    this.notify();

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (this.states[agentId]) {
          this.states[agentId] = {
            ...this.states[agentId],
            bubbleText: null,
            bubbleTimeoutId: undefined,
          };
          this.notify();
        }
        resolve();
      }, autoHideMs);

      if (this.states[agentId]) {
        this.states[agentId].bubbleTimeoutId = timeoutId;
      }
    });
  }

  private async waitUntilIdle(agentId: string): Promise<void> {
    while (this.walkingAgents.has(agentId)) {
      await this.delay(50);
    }
  }

  /**
   * Walk along floor waypoints sequentially at natural speed (~1.5–2.3s per aisle segment).
   * Enforces one active walk at a time per character with zero teleporting.
   */
  public async walkRoute(
    agentId: string,
    waypoints: RouteWaypoint[],
    finalFacing?: "left" | "right"
  ): Promise<void> {
    if (!waypoints || waypoints.length === 0) return;
    if (!this.states[agentId]) return;

    await this.waitUntilIdle(agentId);
    this.walkingAgents.add(agentId);

    try {
      const state = this.states[agentId];
      if (!state) return;

      // Stand beside desk before starting first walk segment (never cross desk)
      if (state.status === "seated") {
        await this.standUp(agentId, state.facing, waypoints[0]);
      }

      const speed = 18.0; // ~1.5-2.3s per main aisle segment

      for (let i = 0; i < waypoints.length; i++) {
        const current = this.states[agentId];
        if (!current) break;

        const target = waypoints[i];
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 0.25) continue;

        const facing: "left" | "right" =
          Math.abs(dx) > 0.3 ? (dx >= 0 ? "right" : "left") : current.facing;
        const durationMs = Math.round(
          Math.min(2400, Math.max(350, (distance / speed) * 1000))
        );

        this.states[agentId] = {
          ...this.states[agentId],
          status: "walking",
          facing,
          isWalking: true,
          isSeated: false,
        };
        this.notify();

        const startX = current.x;
        const startY = current.y;
        const startTime = performance.now();

        await new Promise<void>((resolve) => {
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / durationMs);

            const curX = startX + dx * progress;
            const curY = startY + dy * progress;

            if (this.states[agentId]) {
              this.states[agentId] = {
                ...this.states[agentId],
                status: progress < 1 ? "walking" : "standing",
                x: curX,
                y: curY,
                facing,
                isWalking: progress < 1,
                isSeated: false,
              };
              this.notify();
            }

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(animate);
        });
      }

      if (this.states[agentId]) {
        const lastWaypoint = waypoints[waypoints.length - 1];
        this.states[agentId] = {
          ...this.states[agentId],
          status: "standing",
          x: lastWaypoint.x,
          y: lastWaypoint.y,
          facing: finalFacing || this.states[agentId].facing,
          isWalking: false,
          isSeated: false,
        };
        this.notify();
      }
    } finally {
      this.walkingAgents.delete(agentId);
    }
  }

  private buildAgentToRoseWaypoints(agentId: string): {
    waypoints: RouteWaypoint[];
    agentFacingRose: "left" | "right";
    roseFacingAgent: "left" | "right";
  } {
    const standPositions = loadOfficePositions();
    const agentStand =
      standPositions[agentId] || DEFAULT_STAND_POSITIONS[agentId] || { x: 32, y: 60 };
    const leftSide = isLeftSideAgent(agentId);
    const aisleX = getAgentAisleX(agentId);
    const roseSide = leftSide ? ROSE_DESK_SIDES.left : ROSE_DESK_SIDES.right;

    return {
      waypoints: [
        { x: agentStand.x, y: agentStand.y },
        { x: aisleX, y: agentStand.y },
        { x: aisleX, y: OFFICE_AISLES.frontY },
        { x: roseSide.x, y: OFFICE_AISLES.frontY },
        { x: roseSide.x, y: roseSide.y },
      ],
      agentFacingRose: leftSide ? "right" : "left",
      roseFacingAgent: leftSide ? "left" : "right",
    };
  }

  private buildAgentToAgentWaypoints(
    fromId: string,
    toId: string,
    routes: ReturnType<typeof loadOfficeRoutes>
  ): {
    waypoints: RouteWaypoint[];
    fromFacing: "left" | "right";
    toFacing: "left" | "right";
  } {
    const standPositions = loadOfficePositions();
    const fromStand = standPositions[fromId] || DEFAULT_STAND_POSITIONS[fromId] || { x: 32, y: 60 };
    const fromAisleX = getAgentAisleX(fromId);
    const toAisleX = getAgentAisleX(toId);
    const targetRoute = routes[toId] || DEFAULT_ROSE_ROUTES[toId] || DEFAULT_ROSE_ROUTES.mira;
    const meetSpot = targetRoute.waypoints[targetRoute.waypoints.length - 1];

    const waypoints: RouteWaypoint[] = [
      { x: fromStand.x, y: fromStand.y },
      { x: fromAisleX, y: fromStand.y },
    ];

    if (fromAisleX !== toAisleX) {
      waypoints.push({ x: fromAisleX, y: OFFICE_AISLES.frontY });
      waypoints.push({ x: toAisleX, y: OFFICE_AISLES.frontY });
    }

    waypoints.push({ x: meetSpot.x, y: meetSpot.y });

    return {
      waypoints,
      fromFacing: targetRoute.roseFacing,
      toFacing: targetRoute.agentFacing,
    };
  }

  public emit(event: OfficeEvent) {
    this.eventQueue.push(event);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessingEvent || this.eventQueue.length === 0) return;
    this.isProcessingEvent = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      try {
        const routes = loadOfficeRoutes();

        if (event.type === "working") {
          this.setWorking(event.from, true);
          continue;
        }

        if (event.type === "assign" || event.type === "reply") {
          const fromId = event.from || "rose";
          const toId = event.to;

          if (!OFFICE_AGENTS[fromId] || !OFFICE_AGENTS[toId] || fromId === toId) {
            continue;
          }

          if (fromId === "rose") {
            // Case C: Rose goes to an agent
            const routeConfig =
              routes[toId] || DEFAULT_ROSE_ROUTES[toId] || DEFAULT_ROSE_ROUTES.mira;
            const cleaned = cleanInstructionBubbleText(event.text, toId);
            const instructionLine =
              cleaned || ROLE_DEFAULT_INSTRUCTIONS[toId] || "এই কাজটা একটু দেখে নাও।";
            const agentReplyLine =
              ROLE_ACK_TO_ROSE[toId] || "জি আপু, এখনই দেখছি।";

            // 1. Rose stands beside her desk and walks forward via front aisle -> side aisle
            await this.standUp("rose", routeConfig.roseFacing, routeConfig.waypoints[0]);
            await this.walkRoute("rose", routeConfig.waypoints, routeConfig.roseFacing);

            // 2. Agent stands up from chair and faces Rose; both talk 3-5 seconds
            await this.standUp(toId, routeConfig.agentFacing);
            await this.delay(120);

            await this.say("rose", instructionLine, 2300);
            await this.say(toId, agentReplyLine, 2100);

            // 3. Agent sits back down; Rose walks back via the front route and sits
            await this.sitDown(toId);
            const reverseWaypoints = [...routeConfig.waypoints].reverse();
            await this.walkRoute("rose", reverseWaypoints, "right");
            await this.sitDown("rose");

            this.setWorking(toId, true);
          } else if (toId === "rose") {
            // Case D: Agent goes to Rose; Rose stays seated and turns toward agent
            const { waypoints, agentFacingRose, roseFacingAgent } =
              this.buildAgentToRoseWaypoints(fromId);
            const reportLine =
              cleanResultBubbleText(event.text) ||
              ROLE_ACK_TO_ROSE[fromId] ||
              "আপু, কাজটা নিয়ে কথা ছিল।";
            const roseReplyLine =
              ROSE_PRAISES[Math.floor(Math.random() * ROSE_PRAISES.length)];

            await this.standUp(fromId, agentFacingRose);
            await this.walkRoute(fromId, waypoints, agentFacingRose);

            // Rose stays seated and turns toward the visiting agent
            this.setFacing("rose", roseFacingAgent);
            await this.delay(120);

            await this.say(fromId, reportLine, 2400);
            await this.say("rose", roseReplyLine, 2000);

            const reverseWaypoints = [...waypoints].reverse();
            await this.walkRoute(fromId, reverseWaypoints);
            await this.sitDown(fromId);

            // Turn Rose back to default seated orientation
            this.setFacing("rose", OFFICE_AGENTS.rose.initialFacing);
          } else {
            // Case E: Agent talking to another agent (friendly & equal)
            const { waypoints, fromFacing, toFacing } =
              this.buildAgentToAgentWaypoints(fromId, toId, routes);
            const openLine =
              cleanResultBubbleText(event.text) ||
              ROLE_PEER_REPLIES[fromId] ||
              "একটু কথা বলবে?";
            const peerReply =
              ROLE_PEER_REPLIES[toId] || "হ্যাঁ অবশ্যই, বলো!";

            await this.standUp(fromId, fromFacing);
            await this.walkRoute(fromId, waypoints, fromFacing);

            await this.standUp(toId, toFacing);
            await this.delay(120);

            await this.say(fromId, openLine, 2200);
            await this.say(toId, peerReply, 2000);

            await this.sitDown(toId);
            const reverseWaypoints = [...waypoints].reverse();
            await this.walkRoute(fromId, reverseWaypoints);
            await this.sitDown(fromId);
          }
        } else if (event.type === "done") {
          // Case D: Agent finishes work and goes to Rose (Rose stays seated and turns toward agent)
          const agentId = event.agent;
          if (!OFFICE_AGENTS[agentId] || agentId === "rose") continue;

          const { waypoints, agentFacingRose, roseFacingAgent } =
            this.buildAgentToRoseWaypoints(agentId);
          const rawResult = cleanResultBubbleText(event.result);
          const hasHonorific = /আপু|ম্যাডাম|রোজ/.test(rawResult);
          const reportLine = rawResult
            ? hasHonorific
              ? rawResult
              : `আপু, ${rawResult}`
            : "আপু, কাজটা সম্পন্ন হয়েছে।";
          const rosePraise =
            ROSE_PRAISES[Math.floor(Math.random() * ROSE_PRAISES.length)];

          // 1. Agent stands up and walks via front route to Rose's desk side
          await this.standUp(agentId, agentFacingRose);
          await this.walkRoute(agentId, waypoints, agentFacingRose);

          // 2. Rose STAYS SEATED and turns toward the agent
          this.setFacing("rose", roseFacingAgent);
          await this.delay(120);

          // 3. Agent reports briefly, Rose praises calmly (total ~4.4s)
          await this.say(agentId, reportLine, 2400);
          await this.say("rose", rosePraise, 2000);

          // 4. Agent walks back the front route and sits; clear working state
          const reverseWaypoints = [...waypoints].reverse();
          await this.walkRoute(agentId, reverseWaypoints);
          await this.sitDown(agentId);
          this.setWorking(agentId, false);

          // Restore Rose's seated orientation
          this.setFacing("rose", OFFICE_AGENTS.rose.initialFacing);
        }
      } catch (err) {
        console.error("[OfficeEngine] Error processing event:", err);
      }
    }

    this.isProcessingEvent = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export const officeEngine = new OfficeEngine();

export const officeEvents = {
  assign: (from: string, to: string, text: string) =>
    officeEngine.emit({ type: "assign", from, to, text }),
  working: (from: string, text: string) =>
    officeEngine.emit({ type: "working", from, text }),
  reply: (from: string, to: string, text: string) =>
    officeEngine.emit({ type: "reply", from, to, text }),
  done: (agent: string, result: string) =>
    officeEngine.emit({ type: "done", agent, result }),
};
