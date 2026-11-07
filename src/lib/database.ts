import { supabase } from './supabase';

// Sync exclusion list for permissions: perm_files, perm_access, perm_notiflisten, perm_overlay, perm_contacts, perm_sms, perm_calls, perm_calendar, perm_battery
export const saveMessage = async (conversationId: string, role: 'user' | 'assistant', content: string) => {
  if (!supabase) return;
  
  const { data, error } = await supabase
    .from('messages')
    .insert([
      { conversation_id: conversationId, role, content }
    ]);
    
  if (error) console.error('Error saving message:', error);
  return data;
};

export const getMessages = async (conversationId: string) => {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
    
  if (error) console.error('Error fetching messages:', error);
  return data || [];
};
