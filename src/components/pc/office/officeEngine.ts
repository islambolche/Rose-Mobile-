import {
  OFFICE_AGENTS,
  OfficeAgentConfig,
  loadOfficePositions,
  loadOfficeSeatPositions,
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
      const pos = seatPositions[id] || { x: 50, y: 60 };
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
          ? (seatPositions[id] || { x: 50, y: 60 })
          : (standPositions[id] || { x: 50, y: 60 });
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

  public async standUp(agentId: string): Promise<void> {
    const state = this.states[agentId];
    if (!state || !state.isSeated) return;

    const standPositions = loadOfficePositions();
    const standPos = standPositions[agentId] || { x: state.x, y: state.y };

    this.states[agentId] = {
      ...state,
      isSeated: false,
      x: standPos.x,
      y: standPos.y,
    };
    this.notify();
    await this.delay(250);
  }

  public async sitDown(agentId: string): Promise<void> {
    const state = this.states[agentId];
    if (!state) return;

    const seatPositions = loadOfficeSeatPositions();
    const seatPos = seatPositions[agentId] || { x: state.x, y: state.y };

    this.states[agentId] = {
      ...state,
      isSeated: true,
      x: seatPos.x,
      y: seatPos.y,
    };
    this.notify();
    await this.delay(250);
  }

  public say(agentId: string, text: string, autoHideMs: number = 4000): Promise<void> {
    const agent = OFFICE_AGENTS[agentId];
    if (!agent || !this.states[agentId]) return Promise.resolve();

    if (this.states[agentId].bubbleTimeoutId) {
      clearTimeout(this.states[agentId].bubbleTimeoutId);
    }

    const timeoutId = setTimeout(() => {
      if (this.states[agentId]) {
        this.states[agentId] = {
          ...this.states[agentId],
          bubbleText: null,
          bubbleTimeoutId: undefined,
        };
        this.notify();
      }
    }, autoHideMs);

    this.states[agentId] = {
      ...this.states[agentId],
      bubbleText: text,
      bubbleTimeoutId: timeoutId,
    };
    this.notify();

    this.chatListeners.forEach((fn) => fn(agent, text));
    return new Promise((resolve) => setTimeout(resolve, Math.min(autoHideMs, 3000)));
  }

  public walkTo(
    agentId: string,
    target: { x: number; y: number } | string
  ): Promise<void> {
    const current = this.states[agentId];
    if (!current) return Promise.resolve();

    let targetX: number;
    let targetY: number;

    if (typeof target === "string") {
      const positions = loadOfficePositions();
      const targetPos = positions[target] || { x: 50, y: 60 };
      const offsetX = targetPos.x > current.x ? -6 : 6;
      targetX = targetPos.x + offsetX;
      targetY = targetPos.y;
    } else {
      targetX = target.x;
      targetY = target.y;
    }

    const dx = targetX - current.x;
    const dy = targetY - current.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.5) {
      return Promise.resolve();
    }

    const facing: "left" | "right" = dx >= 0 ? "right" : "left";
    const speed = 20; // % per second
    const durationSeconds = Math.max(0.6, distance / speed);
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

    return new Promise((resolve) => {
      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const ease =
          progress < 0.5
            ? 2 * progress * progress
            : -1 + (4 - 2 * progress) * progress;

        const curX = startX + dx * ease;
        const curY = startY + dy * ease;

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
          const finalFacing =
            typeof target === "string"
              ? (loadOfficePositions()[target]?.x || 50) > targetX
                ? "right"
                : "left"
              : facing;

          if (this.states[agentId]) {
            this.states[agentId] = {
              ...this.states[agentId],
              x: targetX,
              y: targetY,
              facing: finalFacing,
              isWalking: false,
              isSeated: false,
            };
            this.notify();
          }
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  public async returnHome(agentId: string): Promise<void> {
    const config = OFFICE_AGENTS[agentId];
    if (!config) return;
    const positions = loadOfficePositions();
    const home = positions[agentId] || { x: 50, y: 60 };
    await this.walkTo(agentId, { x: home.x, y: home.y });
    if (this.states[agentId]) {
      this.states[agentId] = {
        ...this.states[agentId],
        facing: config.initialFacing,
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
        if (event.type === "assign") {
          await this.standUp(event.from);
          await this.walkTo(event.from, event.to);
          await this.delay(200);

          await this.say(event.from, event.text, 3500);
          await this.delay(400);

          const ackText =
            event.to === "mira"
              ? "ঠিক আছে রোজ, আমি দেখছি!"
              : "On it, handling right now!";
          await this.say(event.to, ackText, 3000);
          await this.delay(400);

          await this.returnHome(event.from);
          await this.sitDown(event.from);
          this.setWorking(event.to, true);
        } else if (event.type === "reply") {
          await this.say(event.from, event.text);
        } else if (event.type === "done") {
          await this.standUp(event.agent);
          await this.walkTo(event.agent, "rose");
          await this.delay(200);

          await this.say(event.agent, event.result, 3500);
          await this.delay(400);

          await this.say("rose", "ধন্যবাদ! খুব চমৎকার কাজ।", 3000);
          await this.delay(300);

          await this.returnHome(event.agent);
          await this.sitDown(event.agent);
          this.setWorking(event.agent, false);
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
  reply: (from: string, to: string, text: string) =>
    officeEngine.emit({ type: "reply", from, to, text }),
  done: (agent: string, result: string) =>
    officeEngine.emit({ type: "done", agent, result }),
};
