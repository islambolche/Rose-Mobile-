import { directGeminiStream, TEXT_MODELS } from "./ai-service";
import { getGeminiKey } from "./geminiKey";

export async function getReply(
  messages: { role: string; text: string }[],
  systemInstruction: string,
  onToken: (token: string) => void
): Promise<string> {
  const model = (localStorage.getItem("chat_model") || "").trim();
  const cleanKey = String(getGeminiKey() || localStorage.getItem("gemini_api_key") || "")
    .replace(/[\r\n\t\s"']+/g, "")
    .trim();

  if (!cleanKey) {
    throw new Error("Add your Gemini key in Settings > Connections.");
  }

  const finalModel = model && model.startsWith("gemini") ? model : TEXT_MODELS[0];

  try {
    const result = await directGeminiStream(
      {
        model: finalModel,
        contents: messages,
        systemInstruction: systemInstruction,
        apiKey: cleanKey,
      },
      onToken
    );
    return result.text;
  } catch (e: any) {
    console.error(e);
    throw new Error(
      e?.message || "Cannot reach Gemini. Check your internet and your Gemini key."
    );
  }
}
