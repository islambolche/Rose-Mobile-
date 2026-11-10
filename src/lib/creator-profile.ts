export const DEVELOPER_INFO = {
  name: "MD YOUSUF KHAN",
  role: "Web Developer",
  title: "Web Developer",
  whatsapp: "01671060679",
  whatsappLink: "https://wa.me/8801671060679",
  gmail: "md.yousuf.khan060@gmail.com",
  gmailLink: "mailto:md.yousuf.khan060@gmail.com",
  facebook: "https://www.facebook.com/share/19jLkEGsFv/",
  instagram: "https://www.instagram.com/md_yousuf_khan02",
  youtube: "https://www.youtube.com/@Islamicalo060",
  tiktok: "https://www.tiktok.com/@yousufkhan060",
  contacts: {
    whatsapp: {
      label: "WhatsApp",
      value: "01671060679",
      link: "https://wa.me/8801671060679",
    },
    gmail: {
      label: "Gmail",
      value: "md.yousuf.khan060@gmail.com",
      link: "mailto:md.yousuf.khan060@gmail.com",
    },
  },
  social: {
    facebook: {
      label: "Facebook",
      link: "https://www.facebook.com/share/19jLkEGsFv/",
    },
    instagram: {
      label: "Instagram",
      link: "https://www.instagram.com/md_yousuf_khan02",
    },
    youtube: {
      label: "YouTube",
      link: "https://www.youtube.com/@Islamicalo060",
    },
    tiktok: {
      label: "TikTok",
      link: "https://www.tiktok.com/@yousufkhan060",
    },
  },
};

export const CREATOR_PROFILE = {
  name: DEVELOPER_INFO.name,
  role: DEVELOPER_INFO.role,
  badge: "CREATOR OF Rose AI",
  lockBadge: "OFFICIAL CREATOR PROFILE",
  phone: DEVELOPER_INFO.whatsapp,
  whatsapp: DEVELOPER_INFO.whatsapp,
  gmail: DEVELOPER_INFO.gmail,
  facebook: DEVELOPER_INFO.facebook,
  instagram: DEVELOPER_INFO.instagram,
  youtube: DEVELOPER_INFO.youtube,
  tiktok: DEVELOPER_INFO.tiktok,
  telegram: "",
  bio: "Full-stack web developer and creator of Rose AI.",
  socials: [
    { label: "Facebook", url: DEVELOPER_INFO.facebook },
    { label: "Instagram", url: DEVELOPER_INFO.instagram },
    { label: "YouTube", url: DEVELOPER_INFO.youtube },
    { label: "TikTok", url: DEVELOPER_INFO.tiktok },
  ],
};

export const getDeveloperFactsInstruction = () => `ডেভেলপারের তথ্য (DEVELOPER_INFO):
- নাম: ${DEVELOPER_INFO.name}
- পরিচয়: ${DEVELOPER_INFO.role}
- WhatsApp: ${DEVELOPER_INFO.whatsapp || "এই তথ্য আমার কাছে নেই"} (লিংক: ${DEVELOPER_INFO.whatsappLink || "এই তথ্য আমার কাছে নেই"})
- Gmail: ${DEVELOPER_INFO.gmail || "এই তথ্য আমার কাছে নেই"}
- Facebook: ${DEVELOPER_INFO.facebook || "এই তথ্য আমার কাছে নেই"}
- Instagram: ${DEVELOPER_INFO.instagram || "এই তথ্য আমার কাছে নেই"}
- YouTube: ${DEVELOPER_INFO.youtube || "এই তথ্য আমার কাছে নেই"}
- TikTok: ${DEVELOPER_INFO.tiktok || "এই তথ্য আমার কাছে নেই"}

নিয়ম:
- ব্যবহারকারী কিছু জিজ্ঞেস করলে শুধু ততটুকুই বলো যতটুকু চাওয়া হয়েছে। নিজে থেকে ফোন নম্বর বা ইমেইল বলবে না।
- কোনো তথ্য না থাকলে (যেমন উপরে না থাকা কোনো লিংক বা তথ্য) বলবে "এই তথ্য আমার কাছে নেই", বানিয়ে বলবে না।`;
