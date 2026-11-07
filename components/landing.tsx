"use client";

import { ArrowRight, BadgeCheck, Building2, FileCheck2, Lock, MessageCircle, PackageCheck, ShieldCheck, Sparkles, Store, Timer, Truck, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import insights from "@/lib/generated/insights.json";
import { useJourney, useT } from "@/lib/store";
import { PERSONAS } from "./personas";
import { Badge, Button, Card, cn, LangSwitch, Logo, Rupees, softSpring, spring } from "./ui";

const fade = (d = 0) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...softSpring, delay: d } });

export function Landing() {
  const t = useT();
  const router = useRouter();
  const reset = useJourney((s) => s.reset);
  const h = insights.headline;

  const start = (persona?: string) => {
    reset();
    router.push(persona ? `/advisor?persona=${persona}` : "/advisor");
  };

  return (
    <div className="grain min-h-screen overflow-x-hidden">
      <header className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Logo />
        <nav className="ml-auto hidden items-center gap-1 text-[13.5px] font-semibold text-ink-2 sm:flex">
          <Link href="/track" className="rounded-full px-3 py-2 hover:bg-white">{t("home.track")}</Link>
          <Link href="/chat" className="rounded-full px-3 py-2 hover:bg-white">Chat</Link>
          <Link href="/partner" className="rounded-full px-3 py-2 hover:bg-white">{t("home.partner")}</Link>
        </nav>
        <LangSwitch className="ml-auto sm:ml-2" />
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-14">
        <div>
          <motion.div {...fade(0)}>
            <Badge tone="brand" className="px-3 py-1 text-[12px]">
              <Sparkles className="size-3.5" /> {t("home.badge")}
            </Badge>
          </motion.div>
          <motion.h1 {...fade(0.05)} className="mt-4 text-[38px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-[54px]">
            {t("home.title")}
            <span className="mt-1 block bg-gradient-to-r from-brand via-[#ff4d3d] to-saffron bg-clip-text text-transparent">{t("home.titleAccent")}</span>
          </motion.h1>
          <motion.p {...fade(0.1)} className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-2">
            {t("home.sub")}
          </motion.p>
          <motion.div {...fade(0.15)} className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={() => start()} className="text-[17px]">
              {t("home.cta")} <ArrowRight className="size-5" />
            </Button>
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-muted">
              <Timer className="size-4" /> {t("home.ctaSub")}
            </span>
          </motion.div>
          <motion.div {...fade(0.2)} className="mt-6">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-muted">{t("home.try")}</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PERSONAS).map(([k, p]) => (
                <motion.button key={k} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} transition={spring} onClick={() => start(k)} className="flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[13.5px] font-semibold shadow-card hover:border-brand/40">
                  <span className="text-[16px]">{p.emoji}</span> {t(`persona.${k}`)}
                </motion.button>
              ))}
            </div>
          </motion.div>
          <motion.p {...fade(0.25)} className="mt-6 flex items-start gap-2 text-[13px] text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" /> {t("home.privacy")}
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.94, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ ...softSpring, delay: 0.1 }} className="relative mx-auto w-full max-w-[340px]">
          <HeroPhone />
          <FloatingCard className="-left-6 top-20 sm:-left-16" delay={0.6} icon={<BadgeCheck className="size-4 text-mint" />} text="GSTIN · Active" />
          <FloatingCard className="-right-4 top-48 sm:-right-14" delay={0.9} icon={<Wand2 className="size-4 text-brand" />} text="हिंदी · मराठी · English" />
          <FloatingCard className="-left-4 bottom-24 sm:-left-12" delay={1.2} icon={<Truck className="size-4 text-sky" />} text="Live in 5 days" />
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Store className="size-5" />, k: "1" },
            { icon: <Sparkles className="size-5" />, k: "2" },
            { icon: <FileCheck2 className="size-5" />, k: "3" },
            { icon: <PackageCheck className="size-5" />, k: "4" },
          ].map((s, i) => (
            <motion.div key={s.k} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...softSpring, delay: i * 0.06 }}>
              <Card whileHover={{ y: -4 }} transition={spring} className="h-full p-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">{s.icon}</span>
                  <span className="num text-[28px] font-extrabold text-sand">0{s.k}</span>
                </div>
                <div className="mt-4 text-[16px] font-extrabold">{t(`home.step${s.k}`)}</div>
                <div className="mt-1 text-[13.5px] text-muted">{t(`home.step${s.k}d`)}</div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <div className="bg-ink p-6 text-white sm:p-8">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/50">Today · field sales journey</div>
              <div className="mt-5 grid grid-cols-2 gap-5">
                <Stat big={`${h.activationRate}%`} small="of leads activate" dark />
                <Stat big={`${h.avgDaysToActivate} d`} small="lead to live" dark />
                <Stat big={`${h.avgFollowUpCalls}×`} small="status chases" dark />
                <Stat big={`₹${(h.blendedCAC / 1000).toFixed(0)}k`} small="to acquire one SMB" dark />
              </div>
              <p className="mt-6 text-[13px] leading-relaxed text-white/60">From 5,000 leads (Apr–Jun 2026). All 273 drops between “quote accepted” and “KYC complete” were paperwork: missing documents, mismatched details, no signatory, “too long”.</p>
            </div>
            <div className="p-6 sm:p-8">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand">With Accel Business, digital</div>
              <div className="mt-5 grid grid-cols-2 gap-5">
                <Stat big={t("home.stat1")} small={t("home.stat1d")} />
                <Stat big={t("home.stat2")} small={t("home.stat2d")} />
                <Stat big={t("home.stat3")} small={t("home.stat3d")} />
                <Stat big="1" small="bill & support number" />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/chat"><Button variant="secondary" size="sm"><MessageCircle className="size-4" /> {t("home.chat")}</Button></Link>
                <Link href="/partner"><Button variant="secondary" size="sm"><Building2 className="size-4" /> {t("home.partner")}</Button></Link>
                <Link href="/track"><Button variant="secondary" size="sm"><Truck className="size-4" /> {t("home.track")}</Button></Link>
              </div>
            </div>
          </div>
        </Card>
        <p className="mt-6 text-center text-[12px] text-muted">Accel Business is the fictional operator from the YTL Hackathon 2026 case. All data is synthetic. · <ShieldCheck className="inline size-3.5" /> DPDP-first design</p>
      </section>
    </div>
  );
}

function Stat({ big, small, dark }: { big: string; small: string; dark?: boolean }) {
  return (
    <div>
      <div className={cn("num text-[30px] font-extrabold leading-none tracking-tight", dark ? "text-white" : "text-ink")}>{big}</div>
      <div className={cn("mt-1.5 text-[12.5px] font-semibold", dark ? "text-white/60" : "text-muted")}>{small}</div>
    </div>
  );
}

function FloatingCard({ className, delay, icon, text }: { className?: string; delay: number; icon: React.ReactNode; text: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay }} className={cn("absolute z-10 hidden items-center gap-2 rounded-2xl border border-line bg-white/95 px-3 py-2 text-[12.5px] font-bold shadow-soft backdrop-blur animate-float sm:flex", className)}>
      {icon} {text}
    </motion.div>
  );
}

/** A looping, self-playing preview of the journey. */
function HeroPhone() {
  const [f, setF] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setF((x) => (x + 1) % 9), 1100);
    return () => clearInterval(id);
  }, []);
  const items = [
    { e: "⚡", n: "Office fibre · 100 Mbps", p: 1099, at: 3 },
    { e: "📱", n: "2× Business mobile line", p: 698, at: 4 },
    { e: "💳", n: "Billing & UPI tablet", p: 749, at: 5 },
  ];
  const total = items.filter((i) => f >= i.at).reduce((s, i) => s + i.p, 0);
  return (
    <div className="relative rounded-[46px] bg-ink p-2.5 shadow-[0_40px_80px_-30px_rgba(31,26,23,0.6)]">
      <div className="absolute left-1/2 top-2.5 z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink" />
      <div className="relative h-[600px] overflow-hidden rounded-[38px] bg-cream">
        <div className="flex items-center gap-2 border-b border-line/60 px-4 pb-3 pt-9">
          <span className="grid size-7 place-items-center rounded-lg bg-brand"><svg viewBox="0 0 64 64" className="size-4"><path d="M20 46 32 16l12 30" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <span className="text-[13px] font-extrabold">Accel advisor</span>
          <span className="ml-auto rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">हिं</span>
        </div>
        <div className="space-y-2.5 p-3.5">
          <Bubble show>What kind of business do you run?</Bubble>
          <div className="grid grid-cols-2 gap-1.5">
            {["🛒 Kirana", "💊 Pharmacy", "🩺 Clinic", "🏭 Factory"].map((c, i) => (
              <motion.div key={c} animate={f >= 1 && i === 0 ? { backgroundColor: "#e5232b", color: "#fff", scale: [1, 0.94, 1] } : { backgroundColor: "#ffffff", color: "#1f1a17" }} className="rounded-xl border border-line px-2.5 py-2 text-[11.5px] font-bold">
                {c}
              </motion.div>
            ))}
          </div>
          <AnimatePresence>
            {f >= 2 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="ml-auto w-fit rounded-2xl rounded-br-sm bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white">
                Pune · 3 staff · UPI billing 🎤
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>{f >= 2 && <Bubble show>✨ Got it — building your bundle…</Bubble>}</AnimatePresence>
        </div>
        <motion.div layout className="absolute inset-x-3 bottom-3 rounded-3xl border border-line bg-white p-3.5 shadow-soft">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Your bundle</span>
            <span className="flex items-baseline gap-1">
              <Rupees value={total} className="text-[22px] font-extrabold" />
              <span className="text-[10px] font-semibold text-muted">/month</span>
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            <AnimatePresence initial={false}>
              {items.filter((i) => f >= i.at).map((i) => (
                <motion.div key={i.n} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={spring} className="flex items-center gap-2 rounded-xl bg-cream px-2 py-1.5">
                  <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-[14px]">{i.e}</span>
                  <span className="flex-1 text-[11.5px] font-bold">{i.n}</span>
                  <span className="num text-[11.5px] font-bold">₹{i.p.toLocaleString("en-IN")}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {f >= 6 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-mint-soft px-2.5 py-2 text-[11px] font-bold text-mint">
                  <BadgeCheck className="size-4" /> Business verified · GSTIN active
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div animate={{ backgroundColor: f >= 7 ? "#0e9f6e" : "#e5232b" }} className="mt-2.5 rounded-xl py-2.5 text-center text-[12px] font-bold text-white">
            {f >= 7 ? "✓ Order placed · live in 5 days" : "See price & customise →"}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function Bubble({ children, show }: { children: React.ReactNode; show: boolean }) {
  if (!show) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm border border-line bg-white px-3 py-2 text-[11.5px] font-semibold shadow-card">
      {children}
    </motion.div>
  );
}
