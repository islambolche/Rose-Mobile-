import fetch from 'node-fetch';

async function testTTS(apiKey: string) {
  const models = [
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-flash-tts',
    'gemini-2.0-flash-preview-tts'
  ];

  console.log("Starting Gemini TTS standalone test with key length:", apiKey ? apiKey.length : 0);

  for (const model of models) {
    console.log(`Testing model: ${model}...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "হ্যালো! আমি রোজ।" }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Leda" }
              }
            }
          }
        })
      });

      const elapsed = Date.now() - start;
      const status = res.status;
      const data = await res.json() as any;

      if (res.ok) {
        const audioData = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
        console.log(`SUCCESS [${model}] status: ${status}, elapsed: ${elapsed}ms, audioBytes: ${audioData ? audioData.length : 0}`);
        return { success: true, model, status, elapsed, audioBytes: audioData?.length };
      } else {
        console.log(`FAIL [${model}] status: ${status}, elapsed: ${elapsed}ms, error:`, JSON.stringify(data?.error || data));
      }
    } catch (err: any) {
      console.log(`EXCEPTION [${model}] error:`, err.message);
    }
  }
}

const key = process.argv[2] || '';
testTTS(key);
