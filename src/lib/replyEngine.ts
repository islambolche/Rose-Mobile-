import { directGeminiGenerate, TEXT_MODELS } from "./ai-service";
import { getGeminiKey, ensureGeminiReady } from "./geminiKey";

export async function getReply(
  messages: { role: string; text: string }[],
  systemInstruction: string,
  onToken: (token: string) => void
): Promise<string> {
  const model = (localStorage.getItem("chat_model") || "").trim();
  const cleanKey = String(getGeminiKey() || localStorage.getItem("gemini_api_key") || "")
    .replace(/[\r\n\t\s"']+/g, "")
    .trim();

  if (!(await ensureGeminiReady(cleanKey))) {
    throw new Error("Add your Gemini key in Settings > Connections.");
  }

  const finalModel = model && model.startsWith("gemini") ? model : TEXT_MODELS[0];

  try {
    const result = await directGeminiGenerate({
      model: finalModel,
      contents: messages,
      systemInstruction: systemInstruction,
      apiKey: cleanKey,
    });
    const text = result.text || result?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("").trim() || "";
    if (text && onToken) {
      onToken(text);
    }
    return text;
  } catch (e: any) {
    console.error(e);
    throw new Error(
      e?.message || "Cannot reach Gemini. Check your internet and your Gemini key."
    );
  }
}
