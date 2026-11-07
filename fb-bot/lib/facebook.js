export async function sendMessage(psid, text) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('PAGE_ACCESS_TOKEN env var is missing');

  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`;
  const payload = {
    recipient: { id: psid },
    message: { text: text },
    messaging_type: 'RESPONSE'
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed to send FB message:', data);
  }
  return data;
}

export async function replyToComment(commentId, text) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('PAGE_ACCESS_TOKEN env var is missing');

  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(commentId)}/comments?access_token=${encodeURIComponent(token)}`;
  const payload = {
    message: text
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed to reply to comment:', data);
  }
  return data;
}

export async function sendSenderAction(psid, action) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) return;

  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`;
  const payload = {
    recipient: { id: psid },
    sender_action: action
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('Error sending sender action:', e);
  }
}

export async function markSeen(psid) {
  return sendSenderAction(psid, 'mark_seen');
}

export async function sendTypingIndicator(psid, typing = true) {
  return sendSenderAction(psid, typing ? 'typing_on' : 'typing_off');
}
