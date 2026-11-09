export function mapRole(role: string): 'user' | 'model' {
  const r = (role || '').toLowerCase().trim();
  if (r === 'rose' || r === 'assistant' || r === 'model') return 'model';
  return 'user';
}

export function prepareHistory(messages: any[], _legacySystemPrompt?: string): { role: 'user' | 'model'; parts: [{ text: string }] }[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const validItems: { role: 'user' | 'model'; text: string }[] = [];

  for (const m of messages) {
    if (!m) continue;
    if (m.role === 'system' || m.isError) continue;

    let text = '';
    if (typeof m.text === 'string') text = m.text;
    else if (typeof m.content === 'string') text = m.content;
    else if (Array.isArray(m.parts)) {
      text = m.parts
        .map((p: any) => (typeof p === 'string' ? p : p?.text || ''))
        .filter(Boolean)
        .join(' ');
    }

    text = text.trim();
    if (!text) continue;

    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('gemini error') ||
      lowerText.includes('cannot reach gemini') ||
      text === 'Mic heard nothing' ||
      lowerText.startsWith('gemini key') ||
      lowerText.includes('অনুরোধের গড়নে সমস্যা')
    ) {
      continue;
    }

    const mappedRole = mapRole(m.role);
    validItems.push({ role: mappedRole, text });
  }

  if (validItems.length === 0) return [];

  // Merge consecutive items of the same role
  const merged: { role: 'user' | 'model'; parts: [{ text: string }] }[] = [
    { role: validItems[0].role, parts: [{ text: validItems[0].text }] },
  ];

  for (let i = 1; i < validItems.length; i++) {
    const last = merged[merged.length - 1];
    const curr = validItems[i];
    if (last.role === curr.role) {
      last.parts[0].text += '\n' + curr.text;
    } else {
      merged.push({ role: curr.role, parts: [{ text: curr.text }] });
    }
  }

  // Keep at most the last 8 items
  let sliced = merged.slice(-8);

  // Ensure first item is 'user'
  while (sliced.length > 0 && sliced[0].role !== 'user') {
    sliced.shift();
  }

  // Ensure last item is 'user'
  while (sliced.length > 0 && sliced[sliced.length - 1].role !== 'user') {
    sliced.pop();
  }

  if (sliced.length === 0) {
    const lastUser = [...validItems].reverse().find((x) => x.role === 'user');
    if (lastUser) {
      sliced = [{ role: 'user', parts: [{ text: lastUser.text }] }];
    }
  }

  return sliced;
}

export function extractLastUserText(contents: any[]): string {
  const prepared = prepareHistory(contents);
  if (prepared.length > 0 && prepared[prepared.length - 1].role === 'user') {
    return prepared[prepared.length - 1].parts[0].text;
  }
  if (Array.isArray(contents)) {
    for (let i = contents.length - 1; i >= 0; i--) {
      const c = contents[i];
      if (c && c.role !== 'system' && c.role !== 'rose' && c.role !== 'assistant' && c.role !== 'model') {
        const txt = (typeof c.text === 'string' ? c.text : c.content) || (c.parts?.[0]?.text) || '';
        if (txt.trim()) return txt.trim();
      }
    }
  }
  return 'Hi';
}

export function extractReplyText(data: any): string {
  try {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return data;
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
