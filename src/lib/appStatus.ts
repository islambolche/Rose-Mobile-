export type StatusState = 'done' | 'in progress' | 'pending';

export interface AppStatusItem {
  id: string;
  name: string;
  nameBn: string;
  category: string;
  status: StatusState;
  description: string;
}

export const APP_STATUS: AppStatusItem[] = [
  {
    id: 'gemini_chat',
    name: 'Gemini Text Chat',
    nameBn: 'টাইপ চ্যাট ও জেমিনাই মডেল',
    category: 'Core AI',
    status: 'done',
    description: 'টেক্সট চ্যাট, বহু মডেল নির্বাচন এবং কাস্টম সিস্টেম প্রম্পট কার্যকর।'
  },
  {
    id: 'live_voice',
    name: 'Gemini Live Voice Call',
    nameBn: 'লাইভ ভয়েস কল ও ওয়েবসকেট',
    category: 'Core AI',
    status: 'done',
    description: 'রিয়েলটাইম দ্বিমুখী অডিও স্ট্রিম, ওয়াচডগ রিকানেকশন ও স্পিচ ক্যাপশন চালু।'
  },
  {
    id: 'bengali_tts',
    name: 'Bengali TTS Speech',
    nameBn: 'বাংলা ভয়েস আউটপুট (TTS)',
    category: 'Speech',
    status: 'done',
    description: 'স্বাভাবিক বাংলা উচ্চারণ, পিচ/স্পিড টিউনিং ও অডিও ক্যাশিং সম্পন্ন।'
  },
  {
    id: 'admin_camera',
    name: 'Admin Camera Streaming',
    nameBn: 'অ্যাডমিন লাইভ ক্যামেরা (১ FPS)',
    category: 'Vision',
    status: 'done',
    description: 'অ্যাডমিন মোবাইল কল স্ক্রিন ও বটম ন্যাভ থেকে ১ FPS ভিডিও ফ্রেম জেমিনাই লাইভে প্রেরণ।'
  },
  {
    id: 'history_navigation',
    name: 'History & Continuation',
    nameBn: 'হিস্টরি তালিকা ও চ্যাট কন্টিনিউ',
    category: 'Navigation',
    status: 'done',
    description: 'তারিখভিত্তিক গ্রুপ (আজ, গতকাল, এই সপ্তাহ, আগের) এবং সরাসরি চ্যাটে লোড করে চালিয়ে নেওয়া।'
  },
  {
    id: 'bottom_nav',
    name: 'Bottom Navigation Bar',
    nameBn: 'নিচের মেনু বার (HOME, CHAT, গোলক, CAMERA, SETTINGS)',
    category: 'Navigation',
    status: 'done',
    description: '৫টি প্রধান বাটন, কল চলাকালীন অটো-মিনিমাইজ ও স্ক্রিন পরিবর্তন ব্যবস্থাপনা।'
  },
  {
    id: 'settings_manual',
    name: 'Settings & Knowledge Manual',
    nameBn: 'সেটিংস ও অ্যাপ ম্যানুয়াল',
    category: 'Settings',
    status: 'done',
    description: 'সম্পূর্ণ সেটিংস ট্রি, বাংলা ইউজার গাইড ও অ্যাপের সব বোতামের নিখুঁত বিবরণ।'
  },
  {
    id: 'developer_tools',
    name: 'Developer Tools & Logger',
    nameBn: 'ডেভেলপার টুলস ও এরর ট্র্যাকার',
    category: 'Dev',
    status: 'done',
    description: 'এরর লগ সংরক্ষণ, অ্যাপ স্ট্যাটাস ও জেমিনাই দিয়ে সমস্যা বিশ্লেষণ প্রম্পট জেনারেটর।'
  },
  {
    id: 'phone_control',
    name: 'Phone Control & Permissions',
    nameBn: 'ফোন কন্ট্রোল ও অ্যাপ অনুমতি',
    category: 'Phone',
    status: 'in progress',
    description: 'ক্যামেরা, মাইক, লোকেশন পারমিশন যুক্ত; ওয়েব ও ডিপলিঙ্ক কাজ করছে।'
  },
  {
    id: 'pc_setup',
    name: 'PC Setup & Office Team',
    nameBn: 'পিসি সেটআপ ও অফিস টিম',
    category: 'PC & Office',
    status: 'in progress',
    description: 'সুপাবেস ব্রিজ ও ৫ অফিস এজেন্টের টাস্ক স্ট্যাটাস ইন্টিগ্রেশন চলমান।'
  },
  {
    id: 'android_apk',
    name: 'Native Android APK Services',
    nameBn: 'অ্যান্ড্রয়েড নেটিভ সার্ভিস',
    category: 'Platform',
    status: 'pending',
    description: 'ব্যাকগ্রাউন্ড ফরগ্রাউন্ড অডিও সার্ভিস এবং কল স্ক্রিন লকস্ক্রিন ইন্টিগ্রেশন APK বিল্ডে যুক্ত হবে।'
  }
];
