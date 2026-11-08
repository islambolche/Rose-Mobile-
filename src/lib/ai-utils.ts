export function mapRole(role: string): 'user' | 'model' {
  const r = role.toLowerCase();
  if (r === 'user') return 'user';
  return 'model';
}

export function prepareHistory(messages: { role: string, text: string }[], systemInstruction: string) {
  // 1. Map roles and filter empty
  let mapped = messages
    .filter(m => m.text && m.text.trim().length > 0)
    .map(m => ({ role: mapRole(m.role), parts: [{ text: m.text }] }));

  // 2. Merge consecutive identical roles
  if (mapped.length === 0) return [];
  const merged = [mapped[0]];
  for (let i = 1; i < mapped.length; i++) {
    const last = merged[merged.length - 1];
    const curr = mapped[i];
    if (last.role === curr.role) {
      last.parts[0].text += " " + curr.parts[0].text;
    } else {
      merged.push(curr);
    }
  }

  // 3. Limit to last 8 messages as history
  const result = merged.slice(-8);

  // 4. Ensure starts with user (if not, add dummy user)
  if (result.length > 0 && result[0].role !== 'user') {
    result.unshift({ role: 'user', parts: [{ text: "Hello." }] });
  }

  return result;
}

export function extractReplyText(data: any): string {
  try {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return data; // Not JSON, return as is
      }
    }
    
    if (data?.candidates && data.candidates[0]?.content?.parts) {
      const parts = data.candidates[0].content.parts;
      if (parts.length === 0) return "দুঃখিত, আবার বলুন।";
      return parts.map((p: any) => p.text || "").join(" ");
    }
    
    return "দুঃখিত, আবার বলুন।";
  } catch (e) {
    console.error("Error extracting reply:", e, data);
    return "দুঃখিত, আবার বলুন।";
  }
}
