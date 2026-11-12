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
  { id: 'settings', path: 'settings', titleBn: 'সেটিংস', aliases: ['settings', 'সেটিংস', 'সেটিং', 'কনফিগারেশন'] },
  { id: 'about', path: 'about', titleBn: 'এবাউট অ্যান্ড গাইড', aliases: ['about', 'এবাউট', 'গাইড', 'পরিচয়'] },
  { id: 'connections', path: 'connections', titleBn: 'কানেকশনস', aliases: ['connections', 'কানেকশন', 'কানেকশনস', 'কী', 'api key', 'এপিআই কি'] },
  { id: 'live_voice_model', path: 'live_voice_model', titleBn: 'লাইভ ভয়েস মডেল', aliases: ['live_voice_model', 'লাইভ ভয়েস মডেল', 'ভয়েস মডেল', 'লাইভ মডেল'] },
  { id: 'voice_language', path: 'voice_language', titleBn: 'ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ', aliases: ['voice_language', 'ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ', 'ভাষা ও কণ্ঠ', 'voice and language'] },
  { id: 'chats_memory', path: 'chats_memory', titleBn: 'চ্যাটস অ্যান্ড মেমোরি', aliases: ['chats_memory', 'চ্যাটস অ্যান্ড মেমোরি', 'মেমোরি', 'স্মৃতি'] },
  { id: 'look_feel', path: 'look_feel', titleBn: 'লুক অ্যান্ড ফিল', aliases: ['look_feel', 'লুক অ্যান্ড ফিল', 'ডিজাইন', 'থিম'] },
  { id: 'phone_control', path: 'phone_control', titleBn: 'ফোন কন্ট্রোল', aliases: ['phone_control', 'ফোন কন্ট্রোল', 'নিয়ন্ত্রণ'] },
  { id: 'privacy', path: 'privacy', titleBn: 'প্রাইভেসি', aliases: ['privacy', 'প্রাইভেসি', 'গোপনীয়তা'] },
  { id: 'pc_setup', path: 'pc_setup', titleBn: 'পিসি সেটআপ', aliases: ['pc_setup', 'পিসি সেটআপ', 'computer setup'] },
  { id: 'tts_model', path: 'tts_model', titleBn: 'টিটিএস মডেল', aliases: ['tts_model', 'টিটিএস মডেল', 'tts model'] },
  { id: 'assistant_name', path: 'assistant_name', titleBn: 'অ্যাসিস্ট্যান্ট নাম', aliases: ['assistant_name', 'অ্যাসিস্ট্যান্ট নাম', 'নাম বদল'] },
  { id: 'owner_name', path: 'owner_name', titleBn: 'তোমার নাম', aliases: ['owner_name', 'তোমার নাম', 'ইউজারের নাম', 'my name'] },
  { id: 'personality', path: 'personality', titleBn: 'পার্সোনালিটি', aliases: ['personality', 'পার্সোনালিটি', 'স্বভাব'] },
  { id: 'affection', path: 'affection', titleBn: 'অ্যাফেকশন', aliases: ['affection', 'অ্যাফেকশন', 'ভালোবাসা'] },
  { id: 'language_page', path: 'language_page', titleBn: 'ল্যাঙ্গুয়েজ', aliases: ['language', 'ল্যাঙ্গুয়েজ', 'ভাষা'] },
  { id: 'response_style', path: 'response_style', titleBn: 'রেসপন্স স্টাইল', aliases: ['response_style', 'রেসপন্স স্টাইল', 'উত্তর দেওয়ার ধরন'] },
  { id: 'voice_page', path: 'voice_page', titleBn: 'ভয়েস', aliases: ['voice', 'ভয়েস', 'কণ্ঠস্বর'] },
  { id: 'voice_tuning', path: 'voice_tuning', titleBn: 'ভয়েস টিউনিং', aliases: ['voice_tuning', 'ভয়েস টিউনিং', 'গতি ও পিচ'] },
  { id: 'voice_check', path: 'voice_check', titleBn: 'ভয়েস চেক', aliases: ['voice_check', 'ভয়েস চেক', 'সিস্টেম চেক'] },
  { id: 'mic_listening', path: 'mic_listening', titleBn: 'মাইক অ্যান্ড লিসেনিং', aliases: ['mic_listening', 'মাইক অ্যান্ড লিসেনিং', 'মাইক', 'লিসেনিং', 'always listening'] },
];

export function findMatchingPage(query: string): { page: PageRegistration | null; matches: PageRegistration[] } {
  const q = query.toLowerCase().trim();
  if (!q) return { page: null, matches: [] };

  // Exact or alias match
  for (const p of PAGES_REGISTRY) {
    if (p.id === q || p.path === q || p.titleBn.toLowerCase() === q) {
      return { page: p, matches: [p] };
    }
    for (const alias of p.aliases) {
      if (alias.toLowerCase() === q || q.includes(alias.toLowerCase())) {
        return { page: p, matches: [p] };
      }
    }
  }

  // Partial match score
  const scored = PAGES_REGISTRY.map((p) => {
    let score = 0;
    const titleLower = p.titleBn.toLowerCase();
    if (titleLower.includes(q) || q.includes(titleLower)) score += 5;
    for (const alias of p.aliases) {
      if (alias.toLowerCase().includes(q) || q.includes(alias.toLowerCase())) {
        score += 3;
      }
    }
    return { page: p, score };
  }).filter(x => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  const matches = scored.map(s => s.page);

  return {
    page: matches.length > 0 ? matches[0] : null,
    matches,
  };
}
