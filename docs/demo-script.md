# 3-minute demo script

Record at phone width (Chrome DevTools → iPhone 14 Pro) for the owner screens, and full width for the partner console. Voiceover lines are in quotes. Timings are cumulative.

## 0:00–0:15 · Hook (home page)
- Show the landing page with the self-playing phone.
- "Accel Business converts 7 in 100 small-business leads. It takes 17.6 days, 3 follow-up calls and ₹15,000 per customer. Udyam Digital does it on the owner's phone, in their language, in one sitting."

## 0:15–0:55 · Advisor
- Switch the language to **मराठी**. Tap the persona **"पुण्यातील किराणा दुकान"** (or speak it with the mic).
- "The owner just talks. We understood the business type, staff, city, needs and GST status — in Marathi, offline, instantly."
- Answer the remaining two chips. Watch the live bundle price animate.
- On the result card: "Every product is checked against the catalogue rules — city tier, staff, sites, GSTIN, dependencies. AI only explains; it never picks products or prices." Tap the 🔊 read-aloud button for one line.

## 0:55–1:20 · Quote
- Switch the contract to 36 months (the price drops). Toggle CCTV on (setup appears). Switch the internet speed.
- "One price, no product codes, and add-ons the owner controls. The server re-prices every order, so nobody can tamper with it."

## 1:20–2:10 · Smart KYC
- Consent screen: "Consent is per purpose. Marketing is off by default."
- Load sample applicant **K07**, then **Verify**. "Documents are read on the phone — the images never leave it." Point at the flag for a tampered legal name.
- Back, load **K02** (tilted) → "auto-straightened 7°, matched by name". Load **K06** → "GSTIN fails its check digit", then tap **Use 08YKZXS5189L1ZO**.
- Load **K03**, then **Verify** → green → e-sign with any 6 digits → confetti.

## 2:10–2:35 · Tracker
- "No calls needed." Pick an install slot. Tap **+3 days** to show services going live. Show the "Your data" card: download, withdraw consent.

## 2:35–2:55 · Partner console + chat
- `/partner`: a hand-off from the advisor appears at the top, scored. "Partners get warm, ranked leads and keep their commission on digital orders."
- Flash the **Insights** tab: "54% of drops are process failures this journey removes."
- Optional: `/chat` — the same advisor in a WhatsApp-style chat.

## 2:55–3:00 · Close
- "Same spend, 55 to 130% more activations a quarter. Udyam Digital."

### Before recording
- `npm run build && npm start` (no dev badge). Clear site data for a fresh run.
- Optional: add API keys to `.env.local` to show the "Explained by AI" badge.
