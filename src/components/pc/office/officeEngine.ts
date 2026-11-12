import {
  OFFICE_AGENTS,
  OfficeAgentConfig,
  DEFAULT_STAND_POSITIONS,
  DEFAULT_SEAT_POSITIONS,
  DEFAULT_ROSE_ROUTES,
  loadOfficePositions,
  loadOfficeSeatPositions,
  loadOfficeRoutes,
  cleanInstructionBubbleText,
  cleanResultBubbleText,
  RouteWaypoint,
} from "./officeConfig";

export interface AgentVisualState {
  id: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  facing: "left" | "right";
  isWalking: boolean;
  isWorking: boolean;
  isSeated: boolean;
  bubbleText: string | null;
  bubbleTimeoutId?: any;
}

export type OfficeEvent =
  | { type: "assign"; from: string; to: string; text: string }
  | { type: "working"; from: string; text: string }
  | { type: "reply"; from: string; to: string; text: string }
  | { type: "done"; agent: string; result: string };

type StateChangeListener = (states: Record<string, AgentVisualState>) => void;
type ChatMessageListener = (agent: OfficeAgentConfig, text: string) => void;

class OfficeEngine {
  private states: Record<string, AgentVisualState> = {};
  private listeners: Set<StateChangeListener> = new Set();
  private chatListeners: Set<ChatMessageListener> = new Set();
  private eventQueue: OfficeEvent[] = [];
  private isProcessingEvent = false;

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
      if (this.states[id] && !this.states[id].isWalking) {
        const isSeated = this.states[id].isSeated;
        const pos = isSeated
          ? (seatPositions[id] || DEFAULT_SEAT_POSITIONS[id] || { x: 50, y: 60 })
          : (standPositions[id] || DEFAULT_STAND_POSITIONS[id] || { x: 50, y: 60 });
        this.states[id] = {
          ...this.states[id],
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

  public async standUp(agentId: string, facing?: "left" | "right"): Promise<void> {
    const state = this.states[agentId];
    if (!state) return;

    const standPositions = loadOfficePositions();
    const standPos = standPositions[agentId] || DEFAULT_STAND_POSITIONS[agentId] || { x: state.x, y: state.y };

    this.states[agentId] = {
      ...state,
      isSeated: false,
      isWalking: false,
      x: standPos.x,
      y: standPos.y,
      facing: facing || state.facing,
    };
    this.notify();
    await this.delay(250); // 250ms crossfade duration
  }

  public async sitDown(agentId: string): Promise<void> {
    const state = this.states[agentId];
    if (!state) return;

    const seatPositions = loadOfficeSeatPositions();
    const seatPos = seatPositions[agentId] || DEFAULT_SEAT_POSITIONS[agentId] || { x: state.x, y: state.y };
    const agentConfig = OFFICE_AGENTS[agentId];

    this.states[agentId] = {
      ...state,
      isSeated: true,
      isWalking: false,
      x: seatPos.x,
      y: seatPos.y,
      facing: agentConfig ? agentConfig.initialFacing : state.facing,
    };
    this.notify();
    await this.delay(250); // 250ms crossfade duration
  }

  public say(agentId: string, text: string, autoHideMs: number = 3000): Promise<void> {
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

  /**
   * Walk along floor waypoints sequentially at 7% stage width / sec
   */
  public async walkRoute(
    agentId: string,
    waypoints: RouteWaypoint[],
    finalFacing?: "left" | "right"
  ): Promise<void> {
    if (!waypoints || waypoints.length === 0) return;
    const state = this.states[agentId];
    if (!state) return;

    // Start standing up if currently seated
    if (state.isSeated) {
      await this.standUp(agentId);
    }

    const speed = 7.0; // 7% stage width per second

    for (let i = 0; i < waypoints.length; i++) {
      const current = this.states[agentId];
      if (!current) break;

      const target = waypoints[i];
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.2) continue;

      const facing: "left" | "right" = dx >= 0 ? "right" : "left";
      const durationSeconds = Math.max(0.3, distance / speed);
      const durationMs = durationSeconds * 1000;

      this.states[agentId] = {
        ...this.states[agentId],
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

          // Linear interpolation for consistent walking speed
          const curX = startX + dx * progress;
          const curY = startY + dy * progress;

          if (this.states[agentId]) {
            this.states[agentId] = {
              ...this.states[agentId],
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

    // Set final facing direction and mark walking finished
    if (this.states[agentId]) {
      const lastWaypoint = waypoints[waypoints.length - 1];
      this.states[agentId] = {
        ...this.states[agentId],
        x: lastWaypoint.x,
        y: lastWaypoint.y,
        facing: finalFacing || this.states[agentId].facing,
        isWalking: false,
        isSeated: false,
      };
      this.notify();
    }
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
        const targetAgentId =
          event.type === "assign"
            ? event.to
            : event.type === "done"
            ? event.agent
            : event.type === "reply"
            ? event.to
            : event.from;
        const routeConfig =
          routes[targetAgentId] || DEFAULT_ROSE_ROUTES[targetAgentId] || DEFAULT_ROSE_ROUTES.mira;

        if (event.type === "assign") {
          const targetAgent = event.to;
          const shortInstruction = cleanInstructionBubbleText(event.text, targetAgent);

          // 1. Rose stands up
          await this.standUp("rose", "right");

          // 2. Rose walks route to target agent
          await this.walkRoute("rose", routeConfig.waypoints, routeConfig.roseFacing);

          // 3. Target agent stands up facing Rose
          await this.standUp(targetAgent, routeConfig.agentFacing);
          await this.delay(100);

          // 4. Rose instruction bubble (3s)
          await this.say("rose", shortInstruction, 3000);

          // 5. Target agent acknowledgment bubble (3s)
          await this.say(targetAgent, "ঠিক আছে", 3000);

          // 6. Target agent sits down
          await this.sitDown(targetAgent);

          // 7. Rose walks reverse route back home to stand point (42, 52)
          const reverseWaypoints = [...routeConfig.waypoints].reverse();
          await this.walkRoute("rose", reverseWaypoints, "right");

          // 8. Rose sits down
          await this.sitDown("rose");

          // 9. Mark target agent working
          this.setWorking(targetAgent, true);

        } else if (event.type === "working") {
          // Agent is working at desk
          const agentId = event.from;
          this.setWorking(agentId, true);

        } else if (event.type === "done") {
          const agentId = event.agent;
          const shortResult = cleanResultBubbleText(event.result);

          // 1. Target agent stands up facing Rose
          await this.standUp(agentId, routeConfig.agentFacing);

          // 2. Rose stands up and walks route to target agent
          await this.standUp("rose", "right");
          await this.walkRoute("rose", routeConfig.waypoints, routeConfig.roseFacing);
          await this.delay(100);

          // 3. Target agent result bubble (3s)
          await this.say(agentId, shortResult, 3000);

          // 4. Rose thanks bubble (2.5s)
          await this.say("rose", "ধন্যবাদ! খুব চমৎকার কাজ।", 2500);

          // 5. Target agent sits down
          await this.sitDown(agentId);

          // 6. Rose walks reverse route back home and sits
          const reverseWaypoints = [...routeConfig.waypoints].reverse();
          await this.walkRoute("rose", reverseWaypoints, "right");
          await this.sitDown("rose");

          // 7. Clear working state
          this.setWorking(agentId, false);
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

