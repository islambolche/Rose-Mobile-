# Facebook Page Auto-Reply Bot (Vercel + Gemini AI)

A lightweight serverless Facebook Page auto-reply bot built with ES module Node.js and powered by Google Gemini AI. Replies automatically to Facebook Messenger messages and Post Comments based on your product catalog (`products.json`).

---

## 1. Meta Developer App Setup

1. Go to [Meta for Developers](https://developers.facebook.com/) and create a **Business** type App.
2. Under **Add Products to Your App**, add:
   - **Messenger**
   - **Webhooks**
3. Under **Messenger Settings**:
   - Connect your Facebook Page.
   - Click **Generate Token** for your Page. Copy this string; it will be your `PAGE_ACCESS_TOKEN`.
4. Under **App Settings > Basic**:
   - Copy your **App Secret** (`APP_SECRET`).

---

## 2. Environment Variables

Set these 4 environment variables in Vercel:

| Environment Variable | Description |
|----------------------|-------------|
| `PAGE_ACCESS_TOKEN`  | Page Access Token generated in Messenger Settings |
| `VERIFY_TOKEN`       | Custom secret string chosen by you for Meta Webhook verification |
| `APP_SECRET`         | App Secret from Meta Developer App Settings |
| `GEMINI_API_KEY`     | Google Gemini API key from Google AI Studio |

---

## 3. Webhook Configuration in Meta

1. Deploy this project to Vercel (e.g. `https://your-app-name.vercel.app`).
2. Go to **Webhooks** in your Meta App Dashboard:
   - Select **Page** from the dropdown and click **Subscribe to this object**.
   - **Callback URL**: `https://<your-vercel-domain>/api/webhook`
   - **Verify Token**: The exact string matching `VERIFY_TOKEN` in Vercel.
   - Click **Verify and Save**.
3. Under **Page Subscriptions**, subscribe to:
   - `messages` (Messenger direct messages)
   - `feed` (Page post comments and updates)

---

## 4. Required Meta Permissions

When requesting permissions or submitting for App Review:

- `pages_messaging` (to send and receive direct messages)
- `pages_manage_engagement` (to reply to page post comments)
- `pages_read_engagement` (to read incoming comments)
- `pages_show_list` (to view managed Facebook pages)

---

## 5. Testing & Going Live

1. **Development Mode**:
   - While the Meta app is in Development Mode, only App Admins, Developers, and Testers can send messages to the Page and receive AI replies.
2. **App Review**:
   - To serve general public Facebook users, submit your app for **Meta App Review** requesting `pages_messaging` and `pages_manage_engagement` permissions.
