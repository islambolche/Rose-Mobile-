export function getModelRoute(modelName: string): 'groq' | 'gemini' {
  const groqModels = ['llama', 'mixtral', 'gemma2-'];
  if (groqModels.some(m => modelName.startsWith(m))) return 'groq';
  return 'gemini';
}
