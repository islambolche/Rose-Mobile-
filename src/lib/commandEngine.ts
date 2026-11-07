import { supabase } from "../lib/supabase";

export const proposeAction = async ({ target, action, summary, payload }: any) => {
  if (supabase) {
    const user = await supabase.auth.getUser();
    if (user.data.user) {
      const { data, error } = await supabase.from('commands').insert({
        user_id: user.data.user.id,
        target,
        action,
        summary,
        payload,
        status: 'pending'
      });
      if (error) throw error;
      return data;
    }
  }
  
  // Local storage fallback
  const pending = JSON.parse(localStorage.getItem('pending_commands') || '[]');
  pending.push({ target, action, summary, payload, status: 'pending', created_at: new Date() });
  localStorage.setItem('pending_commands', JSON.stringify(pending));
  return { success: true, local: true };
};
