import crypto from 'node:crypto';
import { generateAiReply } from '../lib/ai.js';
import { sendMessage, replyToComment, markSeen, sendTypingIndicator } from '../lib/facebook.js';

// In-memory cache for duplicate event deduplication
const processedIds = new Set();
// Simple rate limiter tracking last response per user (max 1 msg/sec)
const lastUserReplyTime = new Map();

function verifySignature(req, rawBody) {
  const appSecret = process.env.APP_SECRET;
  if (!appSecret) return true; // Skip signature check if APP_SECRET not set

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const elements = signature.split('=');
  const expectedHash = elements[1];

  const actualHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expectedHash || ''), Buffer.from(actualHash));
}

export default async function handler(req, res) {
  // 1. GET: Verification Request from Meta
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedVerifyToken = process.env.VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expectedVerifyToken) {
      console.log('Webhook verification successful');
      return res.status(200).send(challenge);
    } else {
      console.error('Webhook verification failed');
      return res.status(403).send('Forbidden');
    }
  }

  // 2. POST: Handle incoming Meta events
  if (req.method === 'POST') {
    let rawBody = '';
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else {
      rawBody = JSON.stringify(req.body);
    }

    if (!verifySignature(req, rawBody)) {
      console.error('Invalid signature');
      return res.status(403).send('Invalid signature');
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody);

    if (body.object === 'page') {
      // Respond 200 OK quickly to Meta
      res.status(200).send('EVENT_RECEIVED');

      // Asynchronously process entries
      for (const entry of body.entry || []) {
        // a) Handle Messenger messages
        if (entry.messaging) {
          for (const event of entry.messaging) {
            const senderId = event.sender?.id;
            const recipientId = event.recipient?.id;
            const message = event.message;

            if (!message || message.is_echo || senderId === recipientId) continue;

            const mid = message.mid;
            if (mid && processedIds.has(mid)) continue;
            if (mid) {
              processedIds.add(mid);
              if (processedIds.size > 2000) {
                const oldest = Array.from(processedIds)[0];
                processedIds.delete(oldest);
              }
            }

            const text = message.text;
            if (!text || text.length > 1000) continue;

            // Rate limit: max 1 reply per sec per sender
            const now = Date.now();
            const lastTime = lastUserReplyTime.get(senderId) || 0;
            if (now - lastTime < 1000) continue;
            lastUserReplyTime.set(senderId, now);

            // Mark seen & send typing indicator
            await markSeen(senderId);
            await sendTypingIndicator(senderId, true);

            // Generate AI reply
            const aiReply = await generateAiReply(text, false);

            await sendTypingIndicator(senderId, false);
            await sendMessage(senderId, aiReply);
            console.log(`Replied to Messenger user ${senderId}`);
          }
        }

        // b) Handle Feed Post Comments
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'feed') {
              const value = change.value;
              if (value.item === 'comment' && value.verb === 'add') {
                const commentId = value.comment_id;
                const parentId = value.parent_id;
                const commentText = value.message;
                const senderId = value.from?.id;
                const pageId = entry.id;

                if (!commentText || senderId === pageId || commentId === parentId) continue;

                if (commentId && processedIds.has(commentId)) continue;
                if (commentId) {
                  processedIds.add(commentId);
                  if (processedIds.size > 2000) {
                    const oldest = Array.from(processedIds)[0];
                    processedIds.delete(oldest);
                  }
                }

                if (commentText.length > 1000) continue;

                const aiReply = await generateAiReply(commentText, true);
                await replyToComment(commentId, aiReply);
                console.log(`Replied to comment ${commentId}`);
              }
            }
          }
        }
      }
      return;
    }

    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}
