import { CITIES, segmentFor, tierFor } from "../catalogue";
import type { InternetNow, Need, Profile } from "../types";

/**
 * Offline understanding of free text in English, Hinglish, Hindi and Marathi.
 * Runs instantly in the browser; the AI (when a key is configured) only refines it.
 */

const DEV_DIGITS = "०१२३४५६७८९";
const normDigits = (s: string) => s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));

const TYPE_WORDS: [string, RegExp][] = [
  ["chain", /\b(chain|branches|outlets|franchise)\b|चेन|शाखाएं|शाखाएँ|शाखा|आउटलेट/i],
  ["factory", /\b(factory|manufactur\w*|plant|workshop|textile|auto[- ]?parts?|plastic|moulding|molding|packaging|printing|press|furniture|food processing|fabrication|mill)\b|फैक्ट्री|फ़ैक्टरी|कारखान|उत्पादन|मिल\b|वर्कशॉप/i],
  ["pharmacy", /\b(pharmacy|chemist|medical (store|shop)|medicals|drug ?store)\b|दवा(?!खान)|मेडिकल|औषध|फार्मसी|फ़ार्मेसी/i],
  ["clinic", /\b(clinic|doctor|dental|dentist|physio\w*|hospital|nursing home|diagnostic|lab|pathology|polyclinic)\b|क्लिनिक|क्लीनिक|दवाखान|डॉक्टर|डॉक्टर|डेंटल|रुग्णालय|अस्पताल|लैब|प्रयोगशाला/i],
  ["coaching", /\b(coaching|tuition|tutorial|classes|institute|academy|pre-?school|school)\b|कोचिंग|ट्यूशन|क्लासेस|शिकवणी|संस्थान|अकॅडमी|अकादमी/i],
  ["office", /\b(ca firm|chartered|accountant|law|lawyer|advocate|legal|insurance|real estate|realty|property|travel agency|travels?|architect\w*|consult\w*|office|agency|firm)\b|ऑफिस|कार्यालय|वकील|सीए|विमा|बीमा|प्रॉपर्टी|ट्रॅव्हल|ट्रैवल/i],
  ["salon", /\b(salon|parlou?r|barber|spa|beauty)\b|सैलून|सलून|पार्लर|ब्यूटी/i],
  ["bakery", /\b(bakery|bakers?|sweets?|mithai|confectioner\w*|cake)\b|बेकरी|मिठाई|मिठाई|केक/i],
  ["restaurant", /\b(restaurant|cafe|café|dhaba|eatery|canteen|hotel|food joint|bar)\b|रेस्टोरेंट|रेस्टॉरंट|होटल|ढाबा|कॅफे|कैफे|उपहारगृह|खानावळ/i],
  ["boutique", /\b(boutique|clothes|clothing|garments?|apparel|fashion|tailor)\b|कपड़े|कपडे|बुटीक|गारमेंट|टेलर/i],
  ["kirana", /\b(kirana|grocery|general store|provision|supermarket|mart|hardware|stationery|optician|optical|mobile (shop|repair)|electronics?|shop|store|dukaa?n)\b|किराना|किराणा|दुकान|स्टोर|जनरल|मोबाइल|मोबाईल|हार्डवेयर/i],
];

const CITY_ALIASES: Record<string, string[]> = {
  Pune: ["pune", "poona", "पुणे", "पुण्या"],
  Mumbai: ["mumbai", "bombay", "मुंबई", "मुम्बई"],
  Nagpur: ["nagpur", "नागपुर", "नागपूर"],
  Nashik: ["nashik", "nasik", "नाशिक"],
  Delhi: ["delhi", "new delhi", "दिल्ली"],
  Jaipur: ["jaipur", "जयपुर"],
  Lucknow: ["lucknow", "लखनऊ"],
  Bhopal: ["bhopal", "भोपाल"],
  Indore: ["indore", "इंदौर", "इंदूर"],
  Patna: ["patna", "पटना"],
  Kolkata: ["kolkata", "calcutta", "कोलकाता"],
  Chennai: ["chennai", "madras", "चेन्नई"],
  Hyderabad: ["hyderabad", "हैदराबाद"],
  Bengaluru: ["bengaluru", "bangalore", "बेंगलुरु", "बंगलौर", "बेंगळुरू", "बंगळुरू", "बंगळूर"],
  Ahmedabad: ["ahmedabad", "अहमदाबाद"],
  Surat: ["surat", "सूरत", "सुरत"],
  Vadodara: ["vadodara", "baroda", "वडोदरा"],
  Kochi: ["kochi", "cochin", "कोच्चि", "कोची"],
  Ludhiana: ["ludhiana", "लुधियाना"],
  Visakhapatnam: ["visakhapatnam", "vizag", "विशाखापत्तनम"],
  Mysuru: ["mysuru", "mysore", "मैसूर", "म्हैसूर"],
  Coimbatore: ["coimbatore", "कोयंबटूर"],
};

const NEED_WORDS: [Need, RegExp][] = [
  ["payments", /\b(upi|payments?|billing|bills?|pos|card machine|swipe|qr|invoice|gst billing)\b|बिलिंग|पेमेंट|भुगतान|यूपीआई|बिल/i],
  ["whatsapp", /\bwhats ?app\b|व्हाट्सएप|व्हाट्सऐप|व्हॉट्सअ‍?ॅप|वॉट्सऐप|व्हॉट्सॲप/i],
  ["email", /\b(e-?mails?|mail|office suite|google workspace|documents?|docs)\b|ईमेल|ई-मेल/i],
  ["backup", /\b(backup|back up|cloud storage|storage|data loss|records)\b|बैकअप|बॅकअप/i],
  ["cctv", /\b(cctv|cameras?|surveillance)\b|कैमरा|कॅमेरा|सीसीटीवी|सीसीटीव्ही/i],
  ["calls", /\b(ivr|landline|phone lines?|call(s|ing)? (centre|center)|telephony|reception calls|calls)\b|कॉल|फोन लाइन/i],
  ["tollfree", /\btoll[- ]?free|1800\b|टोल फ्री/i],
  ["website", /\b(website|web ?site|online presence|domain|online store)\b|वेबसाइट|वेबसाईट/i],
  ["security", /\b(antivirus|virus|ransomware|cyber|hack\w*|firewall|data security|secure)\b|सुरक्षा|वायरस|हॅक/i],
  ["wifi", /\b(wi-?fi|guest (internet|network)|customers? internet)\b|वाईफाई|वायफाय|वाई-फाई/i],
  ["machines", /\b(machines?|iot|sensors?|machine monitoring|energy use)\b|मशीन|यंत्र/i],
  ["fleet", /\b(vehicles?|fleet|delivery (vans?|bikes?)|trucks?|vans?|tempo|gps)\b|गाड़ी|गाडी|गाड्या|वाहन|ट्रक/i],
  ["uptime", /\b(never (go )?offline|downtime|outages?|backup internet|failover|always on|uptime)\b|कभी बंद नहीं|बंद नहीं होना|बंद पडू नये|बंद पडता कामा नये/i],
  ["sms", /\bsms\b|एसएमएस/i],
  ["remote", /\b(remote access|static ip|erp|server|tally on cloud|vpn)\b|रिमोट/i],
];

const INTERNET_WORDS: [InternetNow, RegExp][] = [
  ["leased", /leased line|लीज्ड लाइन/i],
  ["hotspot", /hotspot|mobile data|phone (internet|data)|हॉटस्पॉट|मोबाइल डेटा|मोबाईल डेटा/i],
  ["home", /home (broadband|wifi|wi-fi|connection)|घर का (वाईफाई|इंटरनेट)|घरचे/i],
  ["business", /business broadband|broadband|fibre|fiber|ब्रॉडबैंड|ब्रॉडबँड/i],
  ["none", /no internet|not online|इंटरनेट नहीं|इंटरनेट नाही/i],
];

const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/i;

function number(text: string, units: RegExp): number | undefined {
  const re = new RegExp(String.raw`(\d{1,4})\s*(?:\+\s*)?(?:-\s*)?(?:` + units.source + ")", "i");
  const m = text.match(re);
  if (m) return Number(m[1]);
  const re2 = new RegExp("(?:" + units.source + String.raw`)\s*(?:of|:|-|=)?\s*(\d{1,4})`, "i");
  const m2 = text.match(re2);
  return m2 ? Number(m2[1]) : undefined;
}

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
  paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, सात: 7, आठ: 8, दस: 10, दोन: 2, सहा: 6,
};

export interface ParseResult {
  patch: Partial<Profile>;
  found: (keyof Profile)[];
}

export function parseFreeText(raw: string): ParseResult {
  let text = normDigits(raw);
  // spelled-out numbers → digits (only when followed by a unit-ish word, kept simple)
  text = text.replace(/\b([a-z]+)\b|([ऀ-ॿ]+)/gi, (w) => (WORD_NUM[w.toLowerCase()] ? String(WORD_NUM[w.toLowerCase()]) : w));
  const lower = text.toLowerCase();
  const patch: Partial<Profile> = {};

  // Sites first (it affects segment)
  const sites = number(lower, /branches|branch|outlets?|stores|shops|locations?|sites?|centres|centers|clinics|units|शाखा\w*|दुकानें|दुकाने|आउटलेट|ठिकाण\w*|जगह/);
  if (sites && sites < 500) patch.sites = sites;
  else if (/\b(single|one) (shop|store|location|site|branch)\b|एक ही दुकान|एकच दुकान/i.test(lower)) patch.sites = 1;

  for (const [key, re] of TYPE_WORDS) {
    if (re.test(text)) {
      if (key === "chain" && !(patch.sites && patch.sites >= 3) && !/\bchain\b|चेन/i.test(text)) continue;
      patch.businessType = key;
      break;
    }
  }
  if (patch.businessType === "chain" && !patch.sites) patch.sites = 4;

  const emp = number(lower, /staff|employees?|people|persons?|workers?|members?|doctors?|teachers?|log|लोग|कर्मचारी|कामगार|स्टाफ|जण|लोक|कर्मचारी|सदस्य/);
  if (emp && emp < 5000) patch.employees = emp;
  else if (/\b(just me|only me|alone|myself|i work alone)\b|अकेले|मैं अकेला|मैं अकेली|एकटा|एकटी/i.test(lower)) patch.employees = 1;
  const teamOf = lower.match(/team of (\d{1,4})/);
  if (teamOf) patch.employees = Number(teamOf[1]);

  for (const [city, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some((a) => (/[a-z]/.test(a) ? new RegExp(`\\b${a}\\b`, "i").test(lower) : text.includes(a)))) {
      patch.city = city;
      break;
    }
  }
  if (patch.city) patch.tier = tierFor(patch.city);

  const needs = new Set<Need>();
  for (const [need, re] of NEED_WORDS) if (re.test(text)) needs.add(need);
  if (needs.size) patch.needs = [...needs];

  for (const [kind, re] of INTERNET_WORDS) {
    if (re.test(text)) { patch.internet = kind; break; }
  }
  if (/no fib(re|er)|fib(re|er) (is )?not available|no wired|no cable|फाइबर नहीं|फायबर नाही/i.test(text)) patch.noFibre = true;
  if (patch.noFibre && patch.internet === "business") delete patch.internet;

  const g = text.toUpperCase().match(GSTIN_RE);
  if (g) {
    patch.hasGstin = true;
    patch.gstin = g[0].toUpperCase();
  } else if (/\b(no|without|not registered (for|under)|don'?t have( a)?|do not have( a)?|haven'?t got)( a)? ?gst(in)?\b|gst(in)? (nahi|nahin|nahi hai)|जीएसटी नहीं|GST नहीं|GST नाही|जीएसटी नाही|बिना जीएसटी|non[- ]gst|\bgst(in)?\s*[:\-]?\s*(no|nahi|none)\b/i.test(text)) {
    patch.hasGstin = false;
  } else if (/\b(have|got|with|registered)( a)? gst(in)?\b|\bgst(in)?\s*[:\-]?\s*(yes|haan|available)\b|gst registered|gst (hai|है|आहे)|जीएसटी है|जीएसटी आहे/i.test(text)) {
    patch.hasGstin = true;
  }

  const spend = lower.match(/(?:₹|rs\.?|inr)\s?(\d[\d,]{2,})\s*(?:\/|per|a|each)?\s*(?:month|mo|महीना|महिना)?/i);
  if (spend) patch.spend = Number(spend[1].replace(/,/g, ""));

  const veh = number(lower, /vehicles?|vans?|trucks?|bikes?|गाड़ियां|गाड्या|वाहन/);
  if (veh) patch.vehicles = veh;
  const cams = number(lower, /cameras?|cctv|कैमरे|कॅमेरे/);
  if (cams) patch.cameras = cams;

  if (patch.businessType || patch.sites) patch.segment = segmentFor(patch.businessType, patch.sites);

  return { patch, found: Object.keys(patch) as (keyof Profile)[] };
}

export function mergeProfile(base: Profile, patch: Partial<Profile>): Profile {
  const merged: Profile = { ...base, ...patch, needs: base.needs };
  if (patch.needs?.length) merged.needs = [...new Set([...base.needs, ...patch.needs])];
  if (patch.needs?.length) merged.needsAnswered = true;
  merged.segment = segmentFor(merged.businessType, merged.sites) ?? merged.segment;
  if (merged.city) merged.tier = tierFor(merged.city);
  return merged;
}

export const KNOWN_CITIES = Object.keys(CITIES);
