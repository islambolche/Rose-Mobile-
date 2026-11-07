import { extractReplyText, prepareHistory } from "./ai-utils";
import { getModelRoute } from "./modelRouter";
export async function getReply(
  messages: { role: string; text: string }[],
  systemInstruction: string,
  onToken: (token: string) => void
): Promise<string> {
  const model = (localStorage.getItem("chat_model") || "").trim();
  const geminiKey = localStorage.getItem("gemini_api_key") || "";
  const groqKeys = (localStorage.getItem("groq_api_keys") || "").split(",").map(k => k.trim()).filter(k => k);
  const groqKey = groqKeys[0] || "";

  const provider = getModelRoute(model);
  
  // Validate if we have key for the selected provider
  const hasGroqKey = groqKey.length > 0;
  const hasGeminiKey = geminiKey.length > 0;
  
  let actualProvider = provider;
  if (provider === 'groq' && !hasGroqKey) actualProvider = 'gemini';
  if (provider === 'gemini' && !hasGeminiKey) actualProvider = 'groq';

  let finalModel = model;
  if (actualProvider === 'gemini' && !finalModel.startsWith('gemini')) finalModel = 'gemini-3.5-flash';
  if (actualProvider === 'groq' && !finalModel.startsWith('llama') && !finalModel.startsWith('mixtral') && !finalModel.startsWith('gemma')) finalModel = 'llama-3.3-70b-versatile';

  const usedKey = actualProvider === 'groq' ? groqKey : geminiKey;
  if (!usedKey) throw new Error("Could not answer. Please try again.");

  console.log(`[ReplyEngine] Provider: ${actualProvider}, Model: ${finalModel}, Key: ${usedKey ? 'Present' : 'Missing'}`);

  try {
    if (actualProvider === 'groq') {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${usedKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: finalModel,
          messages: [{ role: "system", content: systemInstruction }, ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))],
          stream: true,
          max_tokens: 300
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Groq Error (${res.status}): ${errorText}`);
        throw new Error("মডেল পাওয়া যায়নি। Settings > AI Model-এ মডেল বদলান।");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data === '[DONE]') break;
              try {
                const json = JSON.parse(data);
                const token = json.choices[0].delta.content || "";
                fullText += token;
                onToken(token);
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
      return fullText;
    } else {
      // Gemini
      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: finalModel,
          contents: prepareHistory(messages, systemInstruction),
          systemInstruction: systemInstruction,
          apiKey: usedKey,
          stream: true
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Gemini Error (${res.status}): ${errorText}`);
        throw new Error("মডেল পাওয়া যায়নি। Settings > AI Model-এ মডেল বদলান।");
      }

      // Handle streaming for Gemini
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          onToken(chunk);
        }
      }
      return fullText;
    }
  } catch (e: any) {
    console.error(e);
    throw new Error(e.message || "মডেল পাওয়া যায়নি। Settings > AI Model-এ মডেল বদলান।");
  }
}
