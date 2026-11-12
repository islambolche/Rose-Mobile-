export interface PageRegistration {
  id: string;
  path: string;
  titleBn: string;
  aliases: string[];
}

export const PAGES_REGISTRY: PageRegistration[] = [
  { id: 'home', path: 'home', titleBn: 'হোম', aliases: ['home', 'হোম', 'মূল পাতা'] },
  { id: 'chat', path: 'chat', titleBn: 'চ্যাট', aliases: ['chat', 'চ্যাট', 'বার্তা'] },
  { id: 'history', path: 'history', titleBn: 'হিস্টরি', aliases: ['history', 'হিস্টরি', 'ইতিহাস', 'পূর্বের চ্যাট'] },
  { id: 'settings', path: 'settings', titleBn: 'সেটিংস', aliases: ['settings', 'সেটিংস', 'সেটিং', 'অ্যাপের সেটিং', 'রোজের সেটিং', 'কনফিগারেশন'] },
  { id: 'connections', path: 'connections', titleBn: 'কানেকশনস', aliases: ['connections', 'কানেকশন', 'কানেকশনস', 'কী', 'api key', 'এপিআই কি'] },
  { id: 'live_voice_model', path: 'live-model', titleBn: 'লাইভ ভয়েস মডেল', aliases: ['live_voice_model', 'live-model', 'লাইভ ভয়েস মডেল', 'ভয়েস মডেল', 'লাইভ মডেল'] },
  { id: 'voice_language', path: 'voice', titleBn: 'ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ', aliases: ['voice_language', 'voice', 'ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ', 'ভয়েস', 'ভাষা', 'ভাষা ও কণ্ঠ', 'voice and language', 'voice & language'] },
  { id: 'chats_memory', path: 'memory', titleBn: 'চ্যাটস অ্যান্ড মেমোরি', aliases: ['chats_memory', 'memory', 'চ্যাটস অ্যান্ড মেমোরি', 'মেমোরি', 'স্মৃতি', 'chats & memory'] },
  { id: 'look_feel', path: 'look', titleBn: 'লুক অ্যান্ড ফিল', aliases: ['look_feel', 'look', 'লুক অ্যান্ড ফিল', 'ডিজাইন', 'থিম', 'look & feel'] },
  { id: 'phone_control', path: 'phone', titleBn: 'ফোন কন্ট্রোল', aliases: ['phone_control', 'phone', 'ফোন কন্ট্রোল', 'নিয়ন্ত্রণ', 'phone control'] },
  { id: 'privacy', path: 'privacy', titleBn: 'প্রাইভেসি', aliases: ['privacy', 'প্রাইভেসি', 'গোপনীয়তা', 'সিকিউরিটি'] },
  { id: 'pc_setup', path: 'pc-setup', titleBn: 'পিসি সেটআপ', aliases: ['pc_setup', 'pc-setup', 'পিসি সেটআপ', 'computer setup', 'pc setup'] },
  { id: 'about', path: 'about', titleBn: 'এবাউট অ্যান্ড গাইড', aliases: ['about', 'এবাউট', 'গাইড', 'পরিচয়', 'about & guide'] },
  { id: 'tts_model', path: 'tts-model', titleBn: 'টিটিএস মডেল', aliases: ['tts_model', 'tts-model', 'টিটিএস মডেল', 'tts model'] },
  { id: 'assistant_name', path: 'edit-assistant-name', titleBn: 'অ্যাসিস্ট্যান্ট নাম', aliases: ['assistant_name', 'edit-assistant-name', 'অ্যাসিস্ট্যান্ট নাম', 'নাম বদল', 'assistant name'] },
  { id: 'owner_name', path: 'edit-user-name', titleBn: 'তোমার নাম', aliases: ['owner_name', 'edit-user-name', 'তোমার নাম', 'আমার নাম', 'ইউজারের নাম', 'my name', 'user name'] },
  { id: 'personality', path: 'personality', titleBn: 'পার্সোনালিটি', aliases: ['personality', 'পার্সোনালিটি', 'স্বভাব'] },
  { id: 'affection', path: 'affection', titleBn: 'অ্যাফেকশন', aliases: ['affection', 'অ্যাফেকশন', 'ভালোবাসা'] },
  { id: 'language_page', path: 'language-list', titleBn: 'ল্যাঙ্গুয়েজ', aliases: ['language', 'language-list', 'ল্যাঙ্গুয়েজ', 'ভাষা নির্বাচন'] },
  { id: 'response_style', path: 'response-style-list', titleBn: 'রেসপন্স স্টাইল', aliases: ['response_style', 'response-style-list', 'রেসপন্স স্টাইল', 'উত্তর দেওয়ার ধরন', 'response style'] },
  { id: 'voice_page', path: 'voice-list', titleBn: 'ভয়েস', aliases: ['voice_page', 'voice-list', 'ভয়েস তালিকা', 'voice voices'] },
  { id: 'voice_model_list', path: 'voice-model-list', titleBn: 'ভয়েস মডেল লিস্ট', aliases: ['voice_model_list', 'voice-model-list', 'ভয়েস মডেল লিস্ট', 'voice model mode'] },
  { id: 'voice_tuning', path: 'voice-tuning', titleBn: 'ভয়েস টিউনিং', aliases: ['voice_tuning', 'voice-tuning', 'ভয়েস টিউনিং', 'গতি ও পিচ', 'voice tuning'] },
  { id: 'voice_check', path: 'voice-debug', titleBn: 'ভয়েস চেক', aliases: ['voice_check', 'voice-debug', 'ভয়েস চেক', 'voice check', 'voice debug'] },
  { id: 'mic_listening', path: 'mic-listening', titleBn: 'মাইক অ্যান্ড লিসেনিং', aliases: ['mic_listening', 'mic-listening', 'মাইক অ্যান্ড লিসেনিং', 'মাইক', 'লিসেনিং', 'always listening', 'mic & listening'] },
];

export function cleanTextForFuzzy(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(এ|তে|কে|র|এর)$/g, '');
}

export function calculateSimilarity(s1: string, s2: string): number {
  const clean1 = cleanTextForFuzzy(s1);
  const clean2 = cleanTextForFuzzy(s2);
  if (clean1 === clean2) return 1.0;
  if (!clean1 || !clean2) return 0.0;

  const longer = clean1.length > clean2.length ? clean1 : clean2;
  const shorter = clean1.length > clean2.length ? clean2 : clean1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longerLength - editDistance) / longerLength;
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function findMatchingPage(query: string): { page: PageRegistration | null; matches: PageRegistration[]; lowConfidence: boolean; top3: PageRegistration[] } {
  const q = query.trim();
  if (!q) return { page: null, matches: [], lowConfidence: false, top3: [] };

  const scored = PAGES_REGISTRY.map((p) => {
    let maxSim = 0;
    for (const alias of p.aliases) {
      const sim = calculateSimilarity(q, alias);
      if (sim > maxSim) maxSim = sim;
    }
    const titleSim = calculateSimilarity(q, p.titleBn);
    if (titleSim > maxSim) maxSim = titleSim;
    return { page: p, score: maxSim };
  });

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3).map(s => s.page);
  const bestScore = scored.length > 0 ? scored[0].score : 0;
  const bestPage = scored.length > 0 ? scored[0].page : null;

  if (bestScore >= 0.75) {
    return { page: bestPage, matches: top3, lowConfidence: false, top3 };
  } else if (bestScore >= 0.50 && bestScore < 0.75) {
    return { page: null, matches: top3, lowConfidence: true, top3 };
  } else {
    return { page: null, matches: [], lowConfidence: false, top3: [] };
  }
}
