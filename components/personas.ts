import type { Lang } from "@/lib/types";

/** Demo personas, written the way owners actually talk — they go through the same free-text understanding. */
export const PERSONAS: Record<string, { emoji: string; text: Record<Lang, string> }> = {
  kirana: {
    emoji: "🛒",
    text: {
      en: "I run a kirana store in Pune with 3 staff. Want UPI billing and WhatsApp orders. GST registered.",
      hi: "मेरी पुणे में किराना दुकान है, 3 लोग काम करते हैं। UPI बिलिंग और WhatsApp ऑर्डर चाहिए, जीएसटी है।",
      mr: "माझे पुण्यात किराणा दुकान आहे, 3 जण काम करतात. UPI बिलिंग आणि WhatsApp ऑर्डर हवे, जीएसटी आहे.",
    },
  },
  clinic: {
    emoji: "🦷",
    text: {
      en: "Dental clinic in Kochi, 8 people. Need patient records backup, email and WhatsApp reminders. No GST yet.",
      hi: "कोच्चि में डेंटल क्लिनिक है, 8 लोग। रिकॉर्ड का बैकअप, ईमेल और WhatsApp रिमाइंडर चाहिए। जीएसटी नहीं है।",
      mr: "कोचीमध्ये डेंटल क्लिनिक आहे, 8 जण. नोंदींचा बॅकअप, ईमेल आणि WhatsApp रिमाइंडर हवे. जीएसटी नाही.",
    },
  },
  chain: {
    emoji: "🍽️",
    text: {
      en: "Restaurant chain with 6 outlets in Bengaluru, 60 staff, GST yes. Need billing, CCTV and never go offline.",
      hi: "बेंगलुरु में 6 आउटलेट वाली रेस्टोरेंट चेन, 60 स्टाफ, जीएसटी है। बिलिंग, CCTV चाहिए और इंटरनेट कभी बंद नहीं होना चाहिए।",
      mr: "बंगळुरूमध्ये 6 आउटलेटची रेस्टॉरंट चेन, 60 कर्मचारी, जीएसटी आहे. बिलिंग, CCTV हवे आणि इंटरनेट कधीही बंद पडू नये.",
    },
  },
  factory: {
    emoji: "🏭",
    text: {
      en: "Textile unit in Surat with 40 workers, GST registered. Want machine monitoring and CCTV.",
      hi: "सूरत में टेक्सटाइल फैक्ट्री, 40 कामगार, जीएसटी है। मशीन मॉनिटरिंग और CCTV चाहिए।",
      mr: "सुरतमध्ये टेक्सटाइल कारखाना, 40 कामगार, जीएसटी आहे. मशीन मॉनिटरिंग आणि CCTV हवे.",
    },
  },
};
