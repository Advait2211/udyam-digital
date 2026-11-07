// Builds the ≤10-slide business case on the organisers' SYNC template backgrounds.
// Run: node docs/deck/build.js   (numbers come from lib/generated/insights.json)
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");
const ins = require("../../lib/generated/insights.json");
const model = require("../../lib/generated/propensity.json");

const A = (f) => path.join(__dirname, "assets", f);
const S = (f) => path.join(__dirname, "shots", f);
const OUT = path.join(__dirname, "..", "Udyam_Digital_Business_Case.pptx");

const THEME = {
  name: "Udyam Digital",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: { dk1: "1F1A17", lt1: "FFFFFF", dk2: "5B524C", lt2: "FFF3EF", accent1: "E5232B", accent2: "FFB020", accent3: "0E9F6E", accent4: "2563EB", accent5: "8A7F78", accent6: "B3141B", hlink: "E5232B", folHlink: "B3141B" },
};
const HEX = { ink: "1F1A17", muted: "8A7F78", red: "E5232B", line: "EFE2D6", soft: "FFF3EF", mint: "0E9F6E", saffron: "FFB020" };

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 — same as the template
pres.title = "Udyam Digital — business case";
pres.author = "Advait Desai";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: "SYNC_TITLE",
  background: { path: A("image2.jpg") },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.55, y: 2.72, w: 4.6, h: 0.75, fontSize: 34, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.55, y: 3.5, w: 4.3, h: 1.2, fontSize: 14, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "SYNC_CONTENT",
  background: { path: A("image1.jpg") },
  margin: [0.8, 0.5, 0.6, 0.5],
  slideNumber: { x: 0.5, y: 5.2, w: 0.5, h: 0.25, fontSize: 9, color: C.accent5 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.68, w: 9.0, h: 0.62, fontSize: 18, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});

const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, fontFace: "Arial", color: C.text1, ...o });
const card = (slide, x, y, w, h, fill = C.background1, name = "card") =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: HEX.line, width: 0.75 }, objectName: name });
const chip = (slide, x, y, w, text, fill, color) => {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.26, rectRadius: 0.13, fill: { color: fill }, line: { type: "none" } });
  T(slide, text, { x, y, w, h: 0.26, fontSize: 9, bold: true, color, align: "center", valign: "middle" });
};
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const H = ins.headline;
const seg = Object.fromEntries(ins.segments.map((s) => [s.segment, s]));

// ---------- 1. Title ----------
pres.addSection({ title: "Opening" });
{
  const s = pres.addSlide({ masterName: "SYNC_TITLE", sectionTitle: "Opening" });
  s.addText("Udyam Digital", { placeholder: "title" });
  s.addText(
    [
      { text: "Get a small business online in one sitting — discover, buy, verify and track on a phone, in its own language.", options: { breakLine: true } },
      { text: "Track A · Accel Business · YTL Hackathon 2026", options: { fontSize: 11, color: HEX.saffron, bold: true } },
    ],
    { placeholder: "body" },
  );
  s.addNotes("Udyam Digital turns Accel Business's slow, visit-led SMB sale into a self-serve journey: an AI advisor in Hindi, Marathi or English, one clear price, five-minute KYC on the phone and a live order tracker — with partners handling the high-value 20%.");
}

// ---------- 2. Problem ----------
pres.addSection({ title: "Problem" });
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Problem" });
  s.addText("Only 7 in 100 interested small businesses ever get connected — and most drops are our process, not their choice", { placeholder: "title" });
  const stats = [
    [`${H.activationRate}%`, "of 5,000 leads activate"],
    [`${H.avgDaysToActivate} days`, "from lead to live"],
    [`${H.avgFollowUpCalls}×`, "status chases per customer"],
    [inr(H.blendedCAC), "to acquire one SMB"],
  ];
  stats.forEach(([big, small], i) => {
    const x = 0.5 + (i % 2) * 2.05, y = 1.55 + Math.floor(i / 2) * 1.12;
    card(s, x, y, 1.9, 0.98, C.background1, "stat-" + i);
    T(s, big, { x: x + 0.15, y: y + 0.12, w: 1.65, h: 0.45, fontSize: 24, bold: true, color: C.accent1 });
    T(s, small, { x: x + 0.15, y: y + 0.58, w: 1.65, h: 0.3, fontSize: 10.5, color: C.text2 });
  });
  const fixable = ins.drops.filter((d) => d.fixedBy).reduce((a, d) => a + d.n, 0);
  const total = ins.drops.reduce((a, d) => a + d.n, 0);
  card(s, 0.5, 3.86, 3.95, 0.98, C.background2, "insight");
  T(s, [{ text: `${Math.round((fixable / total) * 100)}% of drops are process failures`, options: { bold: true, breakLine: true } }, { text: "no visit scheduled, unreachable, quote too slow or complex, paperwork, install delays — all removed by a self-serve journey", options: { fontSize: 10.5, color: C.text2 } }], { x: 0.65, y: 3.95, w: 3.7, h: 0.82, fontSize: 12.5, valign: "top" });

  s.addChart(pres.charts.BAR, [{ name: "Leads", labels: ins.funnel.map((f) => f.stage), values: ins.funnel.map((f) => f.count) }], {
    x: 4.75, y: 1.45, w: 4.85, h: 3.45, barDir: "bar", catAxisOrientation: "maxMin",
    chartColors: [HEX.ink], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.ink, dataLabelFontSize: 10, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
    catAxisLabelColor: "5B524C", catAxisLabelFontSize: 10.5, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showLegend: false, showTitle: true, title: "Apr–Jun 2026 funnel · steepest drop: needs assessed → quote (44%)", titleFontSize: 11, titleColor: "5B524C", titleFontFace: "+mn-lt", barGapWidthPct: 45,
  });
  s.addNotes("Source: smb_leads.csv. 5,000 leads became 368 activations. Leads with a GSTIN activate at 9.6% vs 2.0% without. Every one of the 273 drops between quote accepted and KYC complete was paperwork-related.");
}

// ---------- 3. Segments & bundles ----------
pres.addSection({ title: "Customer & offer" });
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Customer & offer" });
  s.addText("Start where digital pays: professional offices and micro shops online, partners on the high-value end", { placeholder: "title" });
  const hdr = (t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: HEX.ink }, fontSize: 9.5 } });
  const row = (cells, bold) => cells.map((c, i) => ({ text: c, options: { fontSize: 9.5, bold: bold && i === 0, color: HEX.ink } }));
  const P = seg["Professional offices"], M = seg["Micro retail & services"], MS = seg["Small multi-site businesses"], MF = seg["Small manufacturers"];
  const rows = [
    ["Segment (share of leads)", "Today: activation · median bill · CAC · churn", "Our play", "Starter bundle (from the rules engine)", "Price · contract"].map(hdr),
    row(["1 · Professional offices (25%)\nclinics, CA firms, coaching", `${P.rate}% · ${inr(P.medianMRR)} · ${inr(P.cac)} · ${P.churn6m}%`, "Digital-first, wave 1", "Fibre 300 + 2 business lines + email ×6 + 1 TB backup; add failover", "₹3,774/mo (12 m)\n₹3,346 on 36 m"], true),
    row(["2 · Micro retail (54%)\nkirana, pharmacy, salon", `${M.rate}% · ${inr(M.medianMRR)} · ${inr(M.cac)} · ${M.churn6m}%`, "Digital-only, zero-touch; CAC must fall ~8×", "Fibre 100 (or AirFiber) + 2 lines + billing & UPI tablet; WhatsApp once GST is active", "₹2,546/mo (12 m)\n+₹2,500 setup"], true),
    row(["3 · Multi-site (15%)\nchains of 3–12 outlets", `${MS.rate}% · ${inr(MS.medianMRR)} · ${inr(MS.cac)} · ${MS.churn6m}%`, "Digital quote, partner closes", "Per outlet: Fibre 300 + failover + SD-WAN + billing + 2 CCTV", "₹39,267/mo for 6 outlets\n(24 m, SD-WAN)"], true),
    row(["4 · Manufacturers (5%)\nauto-parts, textile units", `${MF.rate}% · ${inr(MF.medianMRR)} · ${inr(MF.cac)} · ${MF.churn6m}%`, "Field-led; digital KYC + tracker", "Leased line 20 + 2 lines + 6 CCTV + 4 machine sensors", "₹13,588/mo\n(24 m)"], true),
  ];
  s.addTable(rows, { x: 0.5, y: 1.45, w: 9.0, colW: [1.95, 1.9, 1.55, 2.3, 1.3], border: { type: "solid", color: HEX.line, pt: 0.75 }, fill: { color: "FFFFFF" }, valign: "middle", rowH: [0.34, 0.62, 0.62, 0.62, 0.62], fontFace: "Arial", margin: 0.05 });
  T(s, "Why this order: professional offices activate at 11% with low churn and buy cloud add-ons; micro shops are half the leads but cost ₹20k to win via visits against a ₹2.5k bill — only a near-zero-touch journey makes them profitable. Prices are the catalogue's midpoint on 12 months, falling to the floor on 36.", { x: 0.5, y: 4.48, w: 7.6, h: 0.55, fontSize: 9.5, color: C.text2 });
}

// ---------- 4. Journey ----------
pres.addSection({ title: "Solution" });
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Solution" });
  s.addText("One journey on the owner's phone: four screens, no visit", { placeholder: "title" });
  const shots = [
    ["m-advisor.png", "1 · Advisor", "Tap, type or speak in English, हिंदी or मराठी; bundle builds live"],
    ["m-quote.png", "2 · Quote", "One monthly price; toggle add-ons, switch speed, pick contract"],
    ["m-kyc.png", "3 · Smart KYC", "Read on the phone, checked against GST & Udyam records"],
    ["m-track.png", "4 · Tracker", "Live stages and install slot — no follow-up calls"],
  ];
  shots.forEach(([f, title, sub], i) => {
    const x = 0.55 + i * 2.27;
    s.addImage({ path: S(f), x: x + 0.25, y: 1.38, w: 1.55, h: 2.98, sizing: { type: "cover", w: 1.55, h: 2.98 }, rounding: false, objectName: "shot-" + i });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.22, y: 1.35, w: 1.61, h: 3.04, rectRadius: 0.1, fill: { type: "none" }, line: { color: HEX.ink, width: 2 } });
    T(s, title, { x, y: 4.45, w: 2.1, h: 0.25, fontSize: 12, bold: true, color: C.accent1, align: "center" });
    T(s, sub, { x, y: 4.7, w: 2.1, h: 0.42, fontSize: 9.5, color: C.text2, align: "center" });
  });
  s.addNotes("Also built: a WhatsApp-style chat front end on the same advisor (webhook contract ready for the WhatsApp Cloud API), voice input/read-aloud, and a partner console with a propensity-ranked call list.");
}

// ---------- 5. Advisor (needs discovery) ----------
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Solution" });
  s.addText("Needs discovery without a salesperson: rules decide, AI explains", { placeholder: "title" });
  const steps = [
    ["Owner speaks", "Taps 6 chips or says “dental clinic in Kochi, 8 people, no GST” — EN / हिं / मरा, voice or text"],
    ["Understand", "On-device parser in 3 languages; NVIDIA NIM / Sarvam fill gaps when keys are set"],
    ["Decide", "Rules engine over the 25-product catalogue: city tier, staff, sites, active GSTIN, dependencies"],
    ["Price", "One monthly price + setup + GST; contract slider; add-ons owners can toggle"],
    ["Explain", "Plain-language “why this fits you”, streamed; what's not included and why"],
  ];
  steps.forEach(([h, d], i) => {
    const x = 0.5 + i * 1.82;
    card(s, x, 1.5, 1.68, 1.95, i === 2 ? C.text1 : C.background1, "step-" + i);
    s.addShape(pres.shapes.OVAL, { x: x + 0.14, y: 1.64, w: 0.36, h: 0.36, fill: { color: i === 2 ? HEX.saffron : HEX.red }, line: { type: "none" } });
    T(s, String(i + 1), { x: x + 0.14, y: 1.64, w: 0.36, h: 0.36, fontSize: 12, bold: true, color: C.background1, align: "center", valign: "middle" });
    T(s, h, { x: x + 0.14, y: 2.1, w: 1.42, h: 0.3, fontSize: 13, bold: true, color: i === 2 ? C.background1 : C.text1 });
    T(s, d, { x: x + 0.14, y: 2.42, w: 1.42, h: 0.98, fontSize: 9.5, color: i === 2 ? "E9DFD8" : C.text2, valign: "top" });
  });
  const proof = [
    ["0", "ineligible products recommended across 15 judge-style scenarios + 400 random profiles (unit-tested)"],
    ["<100 ms", "for the bundle to update after a tap — no network round-trip; AI text streams in"],
    ["3.5 s", "hard timeout on every AI call, then a template answer — the screen never hangs"],
  ];
  proof.forEach(([big, small], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 3.7, 2.9, 1.15, C.background2, "proof-" + i);
    T(s, big, { x: x + 0.15, y: 3.8, w: 2.6, h: 0.42, fontSize: 22, bold: true, color: C.accent1 });
    T(s, small, { x: x + 0.15, y: 4.22, w: 2.6, h: 0.58, fontSize: 9.5, color: C.text2, valign: "top" });
  });
}

// ---------- 6. Smart KYC + privacy ----------
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Solution" });
  s.addText("KYC in five minutes, with privacy built in: documents never leave the phone", { placeholder: "title" });
  const pipe = ["Consent per purpose", "Blur check", "Auto-straighten", "On-device OCR", "Checksum + registry", "Verdict + one-tap fix"];
  pipe.forEach((p, i) => {
    const x = 0.5 + i * 1.52;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.45, w: 1.4, h: 0.5, rectRadius: 0.1, fill: { color: i === 3 ? HEX.red : "FFFFFF" }, line: { color: i === 3 ? HEX.red : HEX.line, width: 0.75 } });
    T(s, p, { x: x + 0.05, y: 1.45, w: 1.3, h: 0.5, fontSize: 9.5, bold: true, align: "center", valign: "middle", color: i === 3 ? C.background1 : C.text1 });
  });
  const res = [
    ["K01", "GSTIN cancelled; Udyam no. missing", "GST services blocked; non-GST bundle offered"],
    ["K02", "Photo tilted 7°", "Straightened, matched by name → verified"],
    ["K04", "GST certificate blurry", "“Retake in good light”"],
    ["K05", "No Udyam certificate", "Found in Udyam records — no upload"],
    ["K06", "GSTIN fails check digit", "Flagged; suggests the registered GSTIN"],
    ["K07", "Name differs from GST records", "Flagged as a possibly edited certificate"],
    ["K10", "OCR misread I↔J", "Auto-corrected via registry → verified"],
    ["K11", "Electricity bill 257 days old", "“Upload a bill from the last 90 days”"],
  ];
  const head = ["Applicant", "Planted problem", "What the owner sees"].map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: HEX.ink }, fontSize: 9.5 } }));
  s.addTable([head, ...res.map((r) => r.map((c, i) => ({ text: c, options: { fontSize: 9, bold: i === 0, color: i === 0 ? HEX.red : HEX.ink } })))], {
    x: 0.5, y: 2.15, w: 5.85, colW: [0.7, 2.2, 2.95], border: { type: "solid", color: HEX.line, pt: 0.75 }, fill: { color: "FFFFFF" }, rowH: 0.29, fontFace: "Arial", margin: 0.04, valign: "middle",
  });
  T(s, "K03, K08, K09, K12 pass clean · all 12 run as automated tests", { x: 0.5, y: 4.88, w: 5.85, h: 0.22, fontSize: 9, color: C.accent3, bold: true });
  card(s, 6.55, 2.15, 2.95, 2.88, C.background2, "dpdp");
  T(s, "DPDP Act 2023 by design", { x: 6.7, y: 2.25, w: 2.8, h: 0.3, fontSize: 12.5, bold: true, color: C.accent1 });
  T(s, [
    { text: "Consent: per-purpose toggles, versioned, withdrawable", options: { bullet: true, breakLine: true } },
    { text: "Minimisation: server receives fields, never images", options: { bullet: true, breakLine: true } },
    { text: "Purpose: KYC data used only to activate; no marketing by default", options: { bullet: true, breakLine: true } },
    { text: "IDs masked in UI, logs, partner console", options: { bullet: true, breakLine: true } },
    { text: "Retention: chats 30 d, unconverted leads 90 d, auto-deleted", options: { bullet: true } },
  ], { x: 6.7, y: 2.6, w: 2.7, h: 2.35, fontSize: 9.5, color: C.text2, valign: "top", paraSpaceAfter: 3 });
}

// ---------- 7. People & partners ----------
pres.addSection({ title: "Go-to-market" });
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Go-to-market" });
  s.addText("People where they add value: the journey hands partners warm, scored leads", { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "CAC", labels: ins.sources.map((x) => x.source), values: ins.sources.map((x) => x.cac) }], {
    x: 0.45, y: 1.4, w: 4.4, h: 2.75, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [HEX.ink],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "₹#,##0", dataLabelColor: HEX.ink, dataLabelFontSize: 10, dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: "5B524C", catAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    showTitle: true, title: "Cost per activated SMB by source", titleFontSize: 11, titleColor: "5B524C", titleFontFace: "+mn-lt", barGapWidthPct: 45,
  });
  T(s, "Field visits cost ~6× a referral or inbound lead.", { x: 0.5, y: 4.2, w: 4.3, h: 0.25, fontSize: 10, color: C.text2 });
  const roles = [
    ["Self-serve (80% of volume)", "Micro shops and offices buy online; partners earn the same commission on digital orders from their pin code."],
    ["Hand-off in one tap", "“Talk to a person” from advisor, quote, KYC or chat lands in the partner console with bundle, language and stage."],
    [`Call list ranked by propensity (AUC ${model.cvAUC})`, "Logistic model on lead-time features; next best action per drop reason (e.g. “no fibre → offer AirFiber”)."],
    ["Partners own the hard 20%", "Multi-site, leased lines, site surveys and installs — routed to someone who speaks the owner's language."],
  ];
  roles.forEach(([h, d], i) => {
    const y = 1.42 + i * 0.86;
    card(s, 5.1, y, 4.4, 0.76, i === 2 ? C.background2 : C.background1, "role-" + i);
    T(s, h, { x: 5.25, y: y + 0.08, w: 4.15, h: 0.24, fontSize: 11, bold: true, color: C.accent1 });
    T(s, d, { x: 5.25, y: y + 0.32, w: 4.15, h: 0.42, fontSize: 9.5, color: C.text2, valign: "top" });
  });
}

// ---------- 8. Business case ----------
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Go-to-market" });
  s.addText("Same spend, more customers: +55% to +130% activations a quarter", { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "Activations per quarter", labels: ["Today", "Conservative\n(recover 25% of process drops)", "Base case\n(recover 50%)"], values: [368, 570, 846] }], {
    x: 0.45, y: 1.4, w: 4.5, h: 3.2, barDir: "col", chartColors: [HEX.red], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.ink, dataLabelFontSize: 12, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
    catAxisLabelColor: "5B524C", catAxisLabelFontSize: 9.5, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    showTitle: true, title: "Activations from the same 5,000 leads", titleFontSize: 11, titleColor: "5B524C", titleFontFace: "+mn-lt", barGapWidthPct: 60,
  });
  const spend = H.blendedCAC * H.activated;
  const kp = [
    [`${inr(spend / 570)} → ${inr(spend / 846)}`, `CAC with today's ₹${(spend / 1e6).toFixed(1)}M quarterly spend (from ${inr(H.blendedCAC)}), before cutting any visits`],
    [`+₹${((202 * H.medianMRR * 12) / 1e7).toFixed(1)}–${((478 * H.medianMRR * 12) / 1e7).toFixed(1)} Cr`, `new ARR per quarterly cohort (202–478 extra activations × ${inr(H.medianMRR)} median bundle)`],
    ["17.6 → ~5 days", "to live: fibre in 5 days, AirFiber in 2; KYC no longer waits on visits"],
    ["1 bill, 1 number", "for the owner instead of 4–5 vendors; a kirana's whole setup is ₹2,546/month"],
  ];
  kp.forEach(([big, small], i) => {
    const y = 1.42 + i * 0.86;
    card(s, 5.15, y, 4.35, 0.76, i === 0 ? C.text1 : C.background1, "kp-" + i);
    T(s, big, { x: 5.3, y: y + 0.07, w: 4.1, h: 0.32, fontSize: 15, bold: true, color: i === 0 ? HEX.saffron : HEX.red });
    T(s, small, { x: 5.3, y: y + 0.39, w: 4.1, h: 0.34, fontSize: 9.5, color: i === 0 ? "E9DFD8" : C.text2, valign: "top" });
  });
  T(s, "Model: funnel stage rates from smb_leads.csv; only drops our screens remove are recovered (unreachable leads excluded).", { x: 0.5, y: 4.72, w: 4.5, h: 0.32, fontSize: 8.5, color: C.accent5 });
}

// ---------- 9. Metrics ----------
pres.addSection({ title: "Measure & roll out" });
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Measure & roll out" });
  s.addText("Five numbers we would run the business on", { placeholder: "title" });
  const m = [
    ["Lead → activation", `${H.activationRate}%`, "11%", "15%", "Self-serve + recovered process drops"],
    ["Days from lead to live", `${H.avgDaysToActivate}`, "7", "5", "Instant quote & KYC; AirFiber when no fibre"],
    ["Status chases per customer", `${H.avgFollowUpCalls}`, "0.5", "0.2", "Tracker; 5 chases today ⇒ 28% churn"],
    ["Blended CAC", inr(H.blendedCAC), "₹10,000", "₹6,000", "Digital first; micro ≤ ₹3,000"],
    ["6-month churn", `${H.churn6m}%`, "12%", "10%", "Faster, quieter onboarding; right-sized bundles"],
  ];
  const head = ["Metric", "Today", "90-day pilot", "Year 1", "Lever"].map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: HEX.ink }, fontSize: 10.5 } }));
  s.addTable([head, ...m.map((r) => r.map((c, i) => ({ text: c, options: { fontSize: i === 0 ? 11.5 : 11, bold: i === 0 || i === 3, color: i === 3 ? HEX.red : i === 1 ? "8A7F78" : HEX.ink } })))], {
    x: 0.5, y: 1.45, w: 9.0, colW: [2.2, 1.0, 1.25, 1.0, 3.55], border: { type: "solid", color: HEX.line, pt: 0.75 }, fill: { color: "FFFFFF" }, rowH: 0.48, fontFace: "Arial", margin: 0.07, valign: "middle",
  });
  T(s, "Guardrails: KYC first-pass rate ≥ 80% · NPS ≥ 8 · zero ineligible activations · AI fallback rate tracked per language.", { x: 0.5, y: 4.55, w: 8.0, h: 0.3, fontSize: 10.5, color: C.text2 });
}

// ---------- 10. Rollout & risks ----------
{
  const s = pres.addSlide({ masterName: "SYNC_CONTENT", sectionTitle: "Measure & roll out" });
  s.addText("Rollout in three steps, with the risks we have already designed for", { placeholder: "title" });
  const phases = [
    ["Weeks 0–6", "Connect", "GSTN/Udyam via a GSP, DigiLocker, Aadhaar e-sign, UPI AutoPay, OSS provisioning events"],
    ["Days 1–90", "Pilot", "Pune + Nagpur (Marathi/Hindi), professional offices + micro, 2 channel partners, weekly metric review"],
    ["Quarter 2–4", "Scale", "10 cities; Tamil, Telugu, Kannada, Gujarati, Bengali; WhatsApp Cloud API; multi-site with partners"],
  ];
  phases.forEach(([when, h, d], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.42, 2.9, 1.42, i === 1 ? C.text1 : C.background1, "phase-" + i);
    T(s, when, { x: x + 0.15, y: 1.5, w: 2.6, h: 0.22, fontSize: 9.5, bold: true, color: i === 1 ? HEX.saffron : HEX.red });
    T(s, h, { x: x + 0.15, y: 1.72, w: 2.6, h: 0.32, fontSize: 15, bold: true, color: i === 1 ? C.background1 : C.text1 });
    T(s, d, { x: x + 0.15, y: 2.06, w: 2.6, h: 0.74, fontSize: 9.5, color: i === 1 ? "E9DFD8" : C.text2, valign: "top" });
  });
  const risks = [
    ["AI gives a wrong answer", "AI never picks products or prices; the rules engine does, and the server re-checks every order"],
    ["Forged or mismatched documents", "Check digit, registry status and name/address match; mismatches go to manual review"],
    ["Channel conflict with partners", "Pin-code commission on digital orders; partners get scored hand-offs"],
    ["Fibre not feasible at the site", "AirFiber fallback offered automatically (41 drops last quarter)"],
    ["Low digital comfort", "Voice, three languages, WhatsApp-style chat, a person one tap away"],
  ];
  const head = ["Risk", "Mitigation already in the design"].map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: HEX.ink }, fontSize: 9.5 } }));
  s.addTable([head, ...risks.map((r) => r.map((c, i) => ({ text: c, options: { fontSize: 9.5, bold: i === 0, color: HEX.ink } })))], {
    x: 0.5, y: 3.02, w: 9.0, colW: [2.6, 6.4], border: { type: "solid", color: HEX.line, pt: 0.75 }, fill: { color: "FFFFFF" }, rowH: 0.3, fontFace: "Arial", margin: 0.05, valign: "middle",
  });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
