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
  { id: 'voice_model_list', path: 'voice-model-list', titleBn: 'ভয়েস মডেল', aliases: ['voice_model_list', 'voice-model-list', 'ভয়েস মডেল', 'voice model mode'] },
  { id: 'voice_tuning', path: 'voice-tuning', titleBn: 'ভয়েস টিউনিং', aliases: ['voice_tuning', 'voice-tuning', 'ভয়েস টিউনিং', 'গতি ও পিচ', 'voice tuning'] },
  { id: 'voice_check', path: 'voice-debug', titleBn: 'ভয়েস চেক', aliases: ['voice_check', 'voice-debug', 'ভয়েস চেক', 'voice check', 'voice debug'] },
  { id: 'mic_listening', path: 'mic-listening', titleBn: 'মাইক অ্যান্ড লিসেনিং', aliases: ['mic_listening', 'mic-listening', 'মাইক অ্যান্ড লিসেনিং', 'মাইক', 'লিসেনিং', 'always listening', 'mic & listening'] },
];

export function findMatchingPage(query: string): { page: PageRegistration | null; matches: PageRegistration[] } {
  const q = query.toLowerCase().trim();
  if (!q) return { page: null, matches: [] };

  let bestMatch: PageRegistration | null = null;
  let maxAliasLength = -1;
  const matchedPagesSet = new Set<PageRegistration>();

  for (const p of PAGES_REGISTRY) {
    for (const alias of p.aliases) {
      const aliasLower = alias.toLowerCase();
      if (q.includes(aliasLower) || aliasLower.includes(q)) {
        matchedPagesSet.add(p);
        if (aliasLower.length > maxAliasLength) {
          maxAliasLength = aliasLower.length;
          bestMatch = p;
        }
      }
    }
  }

  const matches = Array.from(matchedPagesSet);
  matches.sort((a, b) => {
    const maxA = Math.max(...a.aliases.map(al => al.length));
    const maxB = Math.max(...b.aliases.map(al => al.length));
    return maxB - maxA;
  });

  return {
    page: bestMatch || (matches.length > 0 ? matches[0] : null),
    matches,
  };
}
