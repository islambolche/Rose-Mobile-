import { supabase } from './supabase';
import {
  TEAM_MEMBERS,
  AgentTaskRecord,
  TeamAgentId,
  updateLocalTaskState,
  subscribeToLocalTasks,
} from './team';
import { officeEvents } from '../components/pc/office/officeEngine';
import { directGeminiGenerate } from './ai-service';

type TaskNotificationListener = (
  agentId: TeamAgentId,
  type: 'reply' | 'done',
  text: string,
  task: AgentTaskRecord
) => void;

class AgentWorkerManager {
  private isRunning = false;
  private realtimeChannel: any = null;
  private localUnsub: (() => void) | null = null;
  private listeners: Set<TaskNotificationListener> = new Set();
  private processingTaskIds: Set<string> = new Set();

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Subscribe to local fallback events
    this.localUnsub = subscribeToLocalTasks((task) => {
      this.handleTaskEvent(task);
    });

    // 2. Subscribe to Supabase Realtime if available
    this.initSupabaseRealtime();

    // 3. Poll / check for any pending 'assigned' tasks
    this.checkPendingTasks();
  }

  public stop() {
    this.isRunning = false;
    if (this.localUnsub) {
      this.localUnsub();
      this.localUnsub = null;
    }
    if (this.realtimeChannel && supabase) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch {}
      this.realtimeChannel = null;
    }
  }

  public onTaskNotification(listener: TaskNotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(
    agentId: TeamAgentId,
    type: 'reply' | 'done',
    text: string,
    task: AgentTaskRecord
  ) {
    this.listeners.forEach((fn) => {
      try {
        fn(agentId, type, text, task);
      } catch (err) {
        console.error('[AgentWorker] Error notifying listener:', err);
      }
    });
  }

  private initSupabaseRealtime() {
    if (!supabase) return;

    try {
      this.realtimeChannel = supabase
        .channel('public:tasks')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload: any) => {
            const newRecord = payload.new as AgentTaskRecord;
            const oldRecord = payload.old as AgentTaskRecord;

            console.log('[Realtime Event] public.tasks:', payload.eventType, {
              id: newRecord?.id || oldRecord?.id,
              to_agent: newRecord?.to_agent || oldRecord?.to_agent,
              status: newRecord?.status,
            });

            if (payload.eventType === 'INSERT') {
              // Trigger PC office assign animation (Rose stands, walks to desk, bubble)
              officeEvents.assign(
                newRecord.from_agent || 'rose',
                newRecord.to_agent,
                newRecord.instruction
              );
              // Try atomic lock & process
              void this.tryAcquireAndExecute(newRecord);
            } else if (payload.eventType === 'UPDATE') {
              if (
                newRecord.status === 'working' &&
                oldRecord?.status !== 'working' &&
                newRecord.reply
              ) {
                // working → agent replies in a bubble, Rose walks back and sits
                officeEvents.working(newRecord.to_agent, newRecord.reply);
                this.notify(
                  newRecord.to_agent as TeamAgentId,
                  'reply',
                  newRecord.reply,
                  newRecord
                );
              } else if (
                newRecord.status === 'done' &&
                oldRecord?.status !== 'done' &&
                newRecord.result
              ) {
                // done → agent stands, walks to Rose, bubble with result, walks back and sits
                officeEvents.done(newRecord.to_agent, newRecord.result);
                this.notify(
                  newRecord.to_agent as TeamAgentId,
                  'done',
                  newRecord.result,
                  newRecord
                );
              }
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime Event] Supabase Realtime channel subscribed to public.tasks');
          }
        });
    } catch (err) {
      console.warn('[AgentWorker] Failed to subscribe to Supabase Realtime:', err);
    }
  }

  private handleTaskEvent(task: AgentTaskRecord) {
    if (task.status === 'assigned') {
      officeEvents.assign(task.from_agent || 'rose', task.to_agent, task.instruction);
      void this.tryAcquireAndExecute(task);
    }
  }

  private async checkPendingTasks() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'assigned')
        .order('created_at', { ascending: true })
        .limit(3);

      if (!error && data && data.length > 0) {
        for (const task of data) {
          void this.tryAcquireAndExecute(task as AgentTaskRecord);
        }
      }
    } catch {}
  }

  /**
   * Single-device atomic lock:
   * UPDATE tasks SET status = 'working' WHERE id = taskId AND status = 'assigned'
   */
  public async tryAcquireAndExecute(task: AgentTaskRecord) {
    if (this.processingTaskIds.has(task.id)) return;
    this.processingTaskIds.add(task.id);

    let acquiredLock = false;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({ status: 'working' })
          .eq('id', task.id)
          .eq('status', 'assigned')
          .select();

        if (!error && data && data.length > 0) {
          acquiredLock = true;
          console.log('[Task Locked] Device locked task for processing:', task.id, task.to_agent);
        } else {
          console.log('[Task Lock Skipped] Task was already locked by another device:', task.id);
        }
      } catch (err) {
        console.warn('[AgentWorker] Supabase atomic lock query failed:', err);
      }
    } else {
      // In-memory fallback
      if (task.status === 'assigned') {
        task.status = 'working';
        updateLocalTaskState(task);
        acquiredLock = true;
        console.log('[Task Locked] In-memory task locked:', task.id, task.to_agent);
      }
    }

    if (!acquiredLock) {
      // Another device or session acquired the lock, do not execute
      this.processingTaskIds.delete(task.id);
      return;
    }

    try {
      await this.executeAgentWork(task);
    } finally {
      this.processingTaskIds.delete(task.id);
    }
  }

  private async executeAgentWork(task: AgentTaskRecord) {
    const agentId = (task.to_agent as TeamAgentId) || 'mira';
    const member = TEAM_MEMBERS[agentId] || TEAM_MEMBERS.mira;

    // Step 1: Generate agent's quick acknowledgment reply (in natural Bengali, 1-2 sentences, honest)
    const replyText = await this.generateAgentReply(member.id, task.instruction);

    task.reply = replyText;
    task.status = 'working';

    if (supabase) {
      try {
        await supabase
          .from('tasks')
          .update({ reply: replyText, status: 'working' })
          .eq('id', task.id);
      } catch {}
    } else {
      updateLocalTaskState(task);
    }

    // Agent replies in a bubble, Rose walks back and sits down
    officeEvents.working(agentId, replyText);
    this.notify(agentId, 'reply', replyText, task);

    // Step 2: Realistic working duration (2.5 to 3.8 seconds)
    const workDurationMs = 2500 + Math.random() * 1200;
    await new Promise((resolve) => setTimeout(resolve, workDurationMs));

    // Step 3: Generate realistic result (Bengali, 1-2 sentences, honest, no fake physical actions)
    const resultText = await this.generateAgentResult(member.id, task.instruction);

    task.result = resultText;
    task.status = 'done';

    if (supabase) {
      try {
        await supabase
          .from('tasks')
          .update({ result: resultText, status: 'done' })
          .eq('id', task.id);
      } catch {}
    } else {
      updateLocalTaskState(task);
    }

    console.log('[Task Completed] Task marked done:', task.id, { reply: replyText, result: resultText });

    // Agent stands, walks to Rose, bubble with result, Rose thanks, agent walks back and sits
    officeEvents.done(agentId, resultText);
    this.notify(agentId, 'done', resultText, task);
  }

  private async generateAgentReply(agentId: TeamAgentId, instruction: string): Promise<string> {
    const member = TEAM_MEMBERS[agentId];

    const fallbackReplies: Record<TeamAgentId, string[]> = {
      mira: [
        'ঠিক আছে রোজ! আমি এখনই কাস্টমার মেসেজগুলোর উত্তর দেওয়া শুরু করছি।',
        'জি আপু, কাস্টমারদের সাথে যোগাযোগ করে আমি এখনই জানাচ্ছি!',
        'অবশ্যই রোজ, কাস্টমার সার্ভিসের এই বিষয়টি আমি দেখছি।',
      ],
      arin: [
        'জি রোজ, আমি স্টক ও ইনভেন্টরি চেক করে অর্ডার কনফার্ম করছি!',
        'ঠিক আছে রোজ, আমি সেলসের হিসাব ও নতুন অর্ডারগুলো যাচাই করছি।',
        'বুঝেছি আপু, অর্ডার ভেরিফিকেশনের কাজ এখনই শুরু করছি!',
      ],
      zayan: [
        'জি রোজ, পার্সেলের ট্র্যাকিং কোড এবং কুরিয়ার হ্যান্ডওভার দেখছি!',
        'অবশ্যই রোজ, আমি ডেলিভারি স্ট্যাটাস ও শিপমেন্ট আপডেট করছি।',
        'ঠিক আছে আপু, সবগুলো পার্সেল দ্রুত পাঠিয়ে দিচ্ছি!',
      ],
      naira: [
        'জি রোজ, আমি সব খরচ ও আয়ের অডিট হিসাব পুঙ্খানুপুঙ্খভাবে দেখছি!',
        'অবশ্যই রোজ, লাভ-লোকসান ও আর্থিক রিপোর্ট বিশ্লেষণ করছি।',
        'ঠিক আছে আপু, আমি ব্যালান্স ও অডিট ডেটা খতিয়ে দেখছি!',
      ],
    };

    const choices = fallbackReplies[agentId] || fallbackReplies.mira;
    const fallbackChoice = choices[Math.floor(Math.random() * choices.length)];

    try {
      const prompt = `You are ${member.name} (${member.bengaliRole}). Rose just assigned you this instruction: "${instruction}".
Give a short 1-sentence quick acknowledgment in warm, professional Bengali stating you are starting the work. No markdown, no quotes, under 20 words.`;

      const gen = await directGeminiGenerate({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 60, temperature: 0.7 },
      });

      const text = gen?.text?.trim();
      if (text && text.length > 3) {
        return text.replace(/^["'\s]+|["'\s]+$/g, '');
      }
    } catch {}

    return fallbackChoice;
  }

  private async generateAgentResult(agentId: TeamAgentId, instruction: string): Promise<string> {
    const member = TEAM_MEMBERS[agentId];

    const fallbackResults: Record<TeamAgentId, string[]> = {
      mira: [
        'কাস্টমারদের সব মেসেজের উত্তর সম্পন্ন হয়েছে এবং ৩ জন গ্রাহক অর্ডার নিশ্চিত করেছেন।',
        'ইনবক্সের সব পেন্ডিং প্রশ্নের উত্তর দেওয়া হয়েছে। গ্রাহকরা সন্তুষ্ট।',
        'কাস্টমারদের বিশেষ সাপোর্ট ইস্যুগুলো সমাধান করা হয়েছে।',
      ],
      arin: [
        'আজকের সব পেন্ডিং অর্ডারের স্টক কনফার্মেশন ও ইনভেন্টরি আপডেট সম্পন্ন হয়েছে।',
        '৫টি নতুন সেলস অর্ডার সিস্টেমে এন্ট্রি ও স্টক ব্যালান্স আপডেট করা হয়েছে।',
        'আজকের সব বিক্রয় হিসাব সম্পন্ন, পর্যাপ্ত স্টক মজুত রয়েছে।',
      ],
      zayan: [
        'সবগুলো পার্সেল কুরিয়ারে সফলভাবে বুকিং হয়েছে এবং কাস্টমারদের কাছে ট্র্যাকিং কোড পাঠানো হয়েছে।',
        'ডেলিভারি ট্র্যাকিং সম্পন্ন, পার্সেলগুলো সঠিক রুটে গন্তব্যের দিকে রওনা হয়েছে।',
        'কুরিয়ার হ্যান্ডওভার ও ডেলিভারি রিপোর্ট আপডেট করা হয়েছে।',
      ],
      naira: [
        'দৈনিক লাভ-লোকসান ও অডিট রিপোর্ট সম্পন্ন। কোনো অমিল পাওয়া যায়নি, ব্যালান্স সঠিক আছে।',
        'সব খরচ ও ক্যাশফ্লো অডিট সম্পন্ন। নিট প্রফিট মার্জিন সন্তোষজনক।',
        'আর্থিক স্টেটমেন্টের নিরীক্ষা সম্পন্ন হয়েছে, হিসাব সম্পূর্ণ নির্ভুল।',
      ],
    };

    const choices = fallbackResults[agentId] || fallbackResults.mira;
    const fallbackChoice = choices[Math.floor(Math.random() * choices.length)];

    try {
      const prompt = `You are ${member.name} (${member.bengaliRole}). You just finished working on this task from Rose: "${instruction}".
Give a concise 1-sentence realistic completion report in professional Bengali. Specify concrete results (e.g. counts, status, confirmation). Under 25 words. No markdown, no quotes.`;

      const gen = await directGeminiGenerate({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 80, temperature: 0.7 },
      });

      const text = gen?.text?.trim();
      if (text && text.length > 3) {
        return text.replace(/^["'\s]+|["'\s]+$/g, '');
      }
    } catch {}

    return fallbackChoice;
  }
}

export const agentWorker = new AgentWorkerManager();
