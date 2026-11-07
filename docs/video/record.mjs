// Records the ≤3-minute demo video by driving the running app inside stage.html.
//
//   npm run build && npm start            (in the repo root; a fresh data/app.db gives a clean partner console)
//   cd docs/video && npm install && APP_URL=http://localhost:3000 OUT=./demo-video.mp4 npm run record
//
// Frames come from Chrome's screencast at 2× pixel density (crisp text), then ffmpeg encodes 1080p H.264.
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT || path.join(HERE, "demo-video.mp4"));
const FRAMES = path.join(HERE, "frames");
const MAX_SECONDS = 175;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- browser + stage ----------
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome", headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
const ctx = await browser.newContext({ viewport: { width: 1664, height: 936 }, deviceScaleFactor: 2, locale: "en-IN", timezoneId: "Asia/Kolkata" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.warn("page error:", e.message));

// Warm the server and the browser cache (pages, OCR worker + language data) so nothing waits on camera.
const warm = await ctx.newPage();
for (const p of ["/", "/advisor", "/quote", "/partner", "/kyc"]) await warm.goto(BASE + p, { waitUntil: "networkidle" });
await warm.waitForTimeout(4000); // the consent screen preloads OCR
await warm.close();
await page.evaluate(() => localStorage.clear()).catch(() => {});

await page.route(`${BASE}/__stage`, (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: fs.readFileSync(path.join(HERE, "stage.html"), "utf8") }));
await page.goto(`${BASE}/__stage`);
await page.evaluate(() => document.fonts.ready);
const app = await (await page.$("#app")).contentFrame();
const desk = await (await page.$("#deskapp")).contentFrame();
await app.goto(`${BASE}/`);
await app.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await app.goto(`${BASE}/`, { waitUntil: "networkidle" });

const stage = {
  caption: (c) => page.evaluate((c) => window.stage.caption(c), c),
  card: (c) => page.evaluate((c) => window.stage.card(c), c),
  hideCard: () => page.evaluate(() => window.stage.hideCard()),
  mode: (m) => page.evaluate((m) => window.stage.mode(m), m),
};

// ---------- helpers ----------
/** Eased scroll inside a frame; y may be a number or "bottom". */
const glide = (frame, y, ms = 1100) =>
  frame.evaluate(([y, ms]) => new Promise((res) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const to = Math.max(0, Math.min(y === "bottom" ? max : y, max));
    const from = scrollY;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      scrollTo({ top: from + (to - from) * ease(p), behavior: "instant" });
      p < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  }), [y, ms]);

/** Document y that puts the element at `frac` of the viewport height. */
const yOf = (loc, frac = 0.4) => loc.evaluate((el, frac) => el.getBoundingClientRect().top + scrollY - innerHeight * frac, frac);

/** Scroll the element into view smoothly, show a tap ripple on the stage, then click. */
async function tap(frame, loc, { scroll = true, frac = 0.45, glideMs = 800, after = 400 } = {}) {
  await loc.waitFor({ state: "visible", timeout: 20_000 });
  if (scroll) {
    const inView = await loc.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 150; });
    if (!inView) { await glide(frame, await yOf(loc, frac), glideMs); await sleep(150); }
  }
  const b = await loc.boundingBox();
  if (b) await page.evaluate(([x, y]) => window.stage.tap(x, y), [b.x + b.width / 2, b.y + b.height / 2]);
  await sleep(230);
  await loc.click({ timeout: 10_000 });
  await sleep(after);
}

const readyToVerify = () =>
  app.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Verify now/.test(b.textContent) && !b.disabled), null, { timeout: 60_000 });

// ---------- capture ----------
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
const frames = [];
const cdp = await ctx.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const file = path.join(FRAMES, `${String(frames.length).padStart(6, "0")}.jpg`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000, recv: Date.now() / 1000 });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

const log = [];
let t0 = 0;
// Planned end of each scene (s). If the machine is slow and a scene overruns, later caption holds
// shrink (never below 60%) so the video still fits the cap; on a fast machine they stay as written.
const PLAN = { intro: 12, advisor: 33, quote: 52, kyc: 94, tracker: 116, chat: 133, partner: 151, close: 158 };
let pace = 1;
const hold = (ms) => sleep(ms * pace);
async function scene(name, fn) {
  const start = Date.now();
  try {
    await fn();
  } catch (e) {
    await page.screenshot({ path: path.join(HERE, "failure.png") }).catch(() => {});
    console.error(`Scene "${name}" failed — see docs/video/failure.png`);
    await browser.close();
    throw e;
  }
  log.push([name, (Date.now() - start) / 1000, (Date.now() - t0) / 1000]);
  const left = PLAN.close - PLAN[name];
  if (left > 0) pace = Math.max(0.6, Math.min(1, (MAX_SECONDS - 4 - (Date.now() - t0) / 1000) / left));
  console.log(`${name.padEnd(9)} ${((Date.now() - start) / 1000).toFixed(1).padStart(5)} s   ends at ${((Date.now() - t0) / 1000).toFixed(1)} s   pace ${pace.toFixed(2)}`);
}

// ---------- the walkthrough ----------
await stage.card({
  kick: "YTL Hackathon 2026 · Track A · Accel Business",
  title: "Udyam <em>Digital</em>",
  sub: "Get a small business online in one sitting — discover, buy, verify and track on a phone, in its own language.",
  foot: "A walkthrough of the working prototype",
});
await hold(900);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
t0 = Date.now();

await scene("intro", async () => {
  await hold(5000);
  await stage.caption({ n: "!", label: "The problem", title: "Only <em>7 in 100</em> small-business leads ever go live", sub: "Each one takes 17.6 days, 3 follow-up calls and ₹15,053 to win. 54% of drops are our own process, not the customer’s choice." });
  await stage.hideCard();
  await hold(6800);
});

let toQuote;
await scene("advisor", async () => {
  await stage.caption({ n: 1, label: "Advisor", rail: 0, title: "The owner just talks — in <em>English, हिंदी or मराठी</em>", sub: "No salesperson needed. Tap, type or speak. Here: a kirana owner in Pune, in Marathi." });
  await hold(1700);
  await tap(app, app.getByRole("tab", { name: "मराठी" }), { scroll: false });
  await hold(900);
  await tap(app, app.getByRole("button", { name: /किराणा/ }).first());
  await app.waitForURL(/advisor/);
  const hotspot = app.getByRole("button", { name: /फोन हॉटस्पॉट/ });
  await hotspot.waitFor();
  await hold(900);
  await stage.caption({ n: 1, label: "Advisor", rail: 0, title: "One sentence, <em>understood instantly</em>", sub: "Business, staff, city, needs and GST — parsed on the phone, even offline. One question left." });
  await hold(4200);
  await tap(app, hotspot, { scroll: false });
  await hold(1300);
  await stage.caption({ n: 1, label: "Advisor", rail: 0, title: "Rules pick the products. <em>AI only explains.</em>", sub: "Every item is checked against the catalogue: city tier, staff, GSTIN and dependencies." });
  await hold(1400);
  toQuote = app.getByRole("button", { name: /किंमत पहा आणि बदला/ }).first();
  await glide(app, await yOf(toQuote, 0.72), 3600);
  await hold(2000);
});

await scene("quote", async () => {
  await tap(app, toQuote);
  await app.waitForURL(/quote/);
  await stage.caption({ n: 2, label: "Quote", rail: 1, title: "One monthly price. <em>No product codes.</em>", sub: "Switch language anytime. The owner sees plain names and controls every add-on." });
  await hold(1200);
  await tap(app, app.getByRole("tab", { name: "English" }), { scroll: false });
  await hold(1700);
  await tap(app, app.getByRole("button", { name: /36 months/ }));
  await stage.caption({ n: 2, label: "Quote", rail: 1, title: "Longer contract, add CCTV, faster fibre — <em>priced instantly</em>", sub: "The server re-prices every order, so nobody can tamper with the price." });
  await hold(1000);
  await tap(app, app.getByRole("switch", { name: /CCTV/ }), { glideMs: 1300 });
  await hold(1100);
  await tap(app, app.getByRole("button", { name: /300 Mbps/ }).first(), { glideMs: 1100 });
  await hold(1300);
  await stage.caption({ n: 2, label: "Quote", rail: 1, title: "Want a person? <em>One tap</em> hands off to a partner", sub: "The lead reaches the partner console with the bundle, language and where the owner paused." });
  await hold(1000);
  await tap(app, app.getByRole("button", { name: /Talk to a person/ }).first(), { scroll: false });
  await hold(2000);
});

await scene("kyc", async () => {
  await tap(app, app.getByRole("button", { name: /Continue/ }).last(), { scroll: false });
  await app.waitForURL(/kyc/);
  await stage.caption({ n: 3, label: "Smart KYC", rail: 2, title: "Consent <em>per purpose</em>", sub: "Marketing is off by default. Documents are read on the phone — the images never leave it." });
  await hold(2000);
  const agree = app.getByRole("button", { name: /I agree/ });
  await glide(app, await yOf(agree, 0.7), 1700);
  await hold(600);
  await tap(app, agree, { scroll: false });

  await stage.caption({ n: 3, label: "Smart KYC", rail: 2, title: "Read on the phone, <em>checked against GST & Udyam records</em>", sub: "Sample applicant K07: blur check, auto-straighten and OCR run on the device in seconds." });
  await tap(app, app.getByRole("button", { name: /K07/ }));
  await readyToVerify();
  await hold(1200);
  await tap(app, app.getByRole("button", { name: /Verify now/ }), { scroll: false });
  await app.getByText("A couple of things to fix").waitFor();
  await stage.caption({ n: 3, label: "Smart KYC", rail: 2, title: "Edited certificate? <em>Flagged.</em>", sub: "The name on K07’s GST certificate doesn’t match GST records." });
  await hold(900);
  await glide(app, await yOf(app.getByText(/differs from GST records/).first(), 0.42), 1500);
  await hold(2800);

  await tap(app, app.getByRole("button", { name: /Upload again/ }).last(), { glideMs: 900 });
  await hold(500);
  if (!(await app.getByRole("button", { name: /K06/ }).isVisible())) await tap(app, app.getByRole("button", { name: /Demo: load a sample/ }));
  await stage.caption({ n: 3, label: "Smart KYC", rail: 2, title: "A typo in the GSTIN? <em>Fixed in one tap.</em>", sub: "Applicant K06: the check digit fails, so we offer the registered GSTIN from GST records." });
  await tap(app, app.getByRole("button", { name: /K06/ }));
  await readyToVerify();
  await hold(600);
  await tap(app, app.getByRole("button", { name: /Verify now/ }), { scroll: false });
  const fix = app.getByRole("button", { name: /^Use / });
  await fix.waitFor();
  await hold(900);
  await tap(app, fix, { glideMs: 1300 });
  await app.getByText("Business verified").waitFor();
  await glide(app, 0, 700);
  await stage.caption({ n: 3, label: "Smart KYC", rail: 2, title: "<em>Verified</em> — no visit, no paperwork", sub: "Then Aadhaar e-sign with an OTP, and the order is placed." });
  await hold(2600);
  await tap(app, app.getByRole("button", { name: /^Continue/ }).first(), { glideMs: 1300 });
  const otp = app.getByLabel("OTP");
  await otp.waitFor();
  await hold(500);
  await otp.pressSequentially("482916", { delay: 150 });
  await hold(600);
  await tap(app, app.getByRole("button", { name: /Sign & place order/ }), { scroll: false });
  await app.waitForURL(/track\//, { timeout: 20_000 });
});

await scene("tracker", async () => {
  await stage.caption({ n: 4, label: "Tracker", rail: 3, title: "No follow-up calls — <em>the owner sees everything</em>", sub: "Live stages, the install slot and the status of every service, in one place." });
  await app.getByText("Pick a slot").waitFor();
  await hold(3600);
  await tap(app, app.getByRole("button", { name: /Morning/ }).first(), { glideMs: 1600, frac: 0.5 });
  await hold(1200);
  await stage.caption({ n: 4, label: "Tracker", rail: 3, title: "Fast-forward <em>three days</em>", sub: "A demo control: watch the stages and services go live." });
  await tap(app, app.getByRole("button", { name: "+3 days" }), { glideMs: 1500, frac: 0.6 });
  await hold(600);
  await glide(app, 0, 1500);
  await hold(2800);
  await stage.caption({ n: 4, label: "Tracker", rail: 3, title: "Their data, <em>their control</em>", sub: "Download everything or withdraw consent from the same screen. IDs are masked everywhere." });
  await glide(app, "bottom", 2200);
  await hold(2600);
});

await scene("chat", async () => {
  await stage.caption({ n: 5, label: "WhatsApp", rail: 4, title: "Or the same advisor <em>on WhatsApp</em>", sub: "The same rules engine behind a WhatsApp Cloud API–style webhook. Voice notes work too." });
  await app.goto(`${BASE}/chat`);
  const box = app.getByPlaceholder("Message");
  await box.waitFor();
  await hold(1300);
  await tap(app, box, { scroll: false, after: 200 });
  await box.pressSequentially("Dental clinic in Kochi, 8 people, no GST yet. Need WhatsApp reminders", { delay: 30 });
  await hold(350);
  await tap(app, app.getByRole("button", { name: "Send" }), { scroll: false });
  await app.getByText("How many locations do you have?").first().waitFor();
  await hold(3800);
  await desk.goto(`${BASE}/partner`);
  await desk.getByText(/Hand-offs from the digital journey/).waitFor();
});

await scene("partner", async () => {
  await stage.caption({ n: 6, label: "Partners", rail: 5, title: "Warm, scored hand-offs", sub: "The kirana owner who tapped “Talk to a person” — with bundle, language and the step where they paused." });
  await stage.mode("desk");
  await hold(4600);
  await stage.caption({ n: 6, label: "Partners", rail: 5, title: "Dropped leads, <em>ranked</em>", sub: "A propensity model (AUC 0.71) with a next best action for each. Partners keep their commission on digital orders." });
  await glide(desk, 330, 1500);
  await hold(3600);
  await glide(desk, 0, 600);
  await tap(desk, desk.getByRole("button", { name: /Insights/ }), { scroll: false });
  await stage.caption({ n: 6, label: "Partners", rail: 5, title: "<em>54%</em> of drops are process failures", sub: "Unreachable, no time for a visit, quote too slow — each one mapped to the screen that removes it." });
  await hold(4600);
});

await scene("close", async () => {
  await stage.card({
    kick: "Udyam Digital · Accel Business",
    title: "Same spend. <em>+55% to +130%</em> activations a quarter.",
    stats: [
      { v: "−35% to −57%", l: "cost to acquire an SMB" },
      { v: "17.6 → ~5 days", l: "from lead to live" },
      { v: "3 → 0.2", l: "status-chase calls per customer" },
    ],
    foot: "github.com/Advait2211/udyam-digital",
  });
  await hold(6800);
});

const stopWall = Date.now() / 1000;
await cdp.send("Page.stopScreencast");
await sleep(300);
await browser.close();

// ---------- encode ----------
if (frames.length < 2) throw new Error("No frames captured");
const total = frames[frames.length - 1].t - frames[0].t + (stopWall - frames[frames.length - 1].recv);
console.log(`\n${frames.length} frames · ${total.toFixed(1)} s`);
if (total > MAX_SECONDS) {
  console.error(`Too long: ${total.toFixed(1)} s > ${MAX_SECONDS} s. Shorten the holds above; scenes:`, log);
  process.exit(1);
}
// Resample to constant 30 fps ourselves: frame k shows the latest capture at or before k/30 s.
// (ffmpeg's concat demuxer stretches very short per-frame durations, so it can't be trusted here.)
frames.sort((a, b) => a.t - b.t);
const FPS = 30;
const count = Math.round(total * FPS);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const enc = spawn(ffmpeg, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-r", String(FPS), "-movflags", "+faststart",
  OUT,
], { stdio: ["pipe", "inherit", "inherit"] });
let j = 0;
let cur = -1;
let buf;
for (let k = 0; k < count; k++) {
  const at = frames[0].t + k / FPS;
  while (j + 1 < frames.length && frames[j + 1].t <= at) j++;
  if (cur !== j) { buf = fs.readFileSync(frames[j].file); cur = j; }
  if (!enc.stdin.write(buf)) await once(enc.stdin, "drain");
}
enc.stdin.end();
const [code] = await once(enc, "close");
if (code !== 0) process.exit(code ?? 1);

// Measure the finished file, not our own arithmetic.
const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", OUT], { encoding: "utf8" }).stderr;
const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe);
const seconds = m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : Infinity;
if (seconds > 180) {
  fs.rmSync(OUT, { force: true });
  console.error(`Encoded video is ${seconds.toFixed(1)} s — over 3 minutes, deleted.`);
  process.exit(1);
}
if (!process.env.KEEP_FRAMES) fs.rmSync(FRAMES, { recursive: true, force: true });
console.log(`Video length ${seconds.toFixed(1)} s`);
console.log(`Saved ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
