"use client";

import confetti from "canvas-confetti";
import { ArrowRight, Check, Copy, FastForward, Headphones, Loader2, MessageCircle, PhoneOff, Search, ShieldCheck, Star, Wrench } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PRODUCTS } from "@/lib/catalogue";
import { inr } from "@/lib/engine/pricing";
import type { OrderView } from "@/lib/orders";
import { useJourney, useT } from "@/lib/store";
import { ProductTile } from "./bundle";
import { Badge, Button, Card, cn, softSpring, spring } from "./ui";

const LOCALE = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" } as const;

export function TrackFind() {
  const t = useT();
  const router = useRouter();
  const orders = useJourney((s) => s.orderIds);
  const [id, setId] = useState("");
  const [err, setErr] = useState(false);
  const go = async () => {
    const res = await fetch(`/api/orders/${id.trim().toUpperCase()}`);
    if (res.ok) router.push(`/track/${id.trim().toUpperCase()}`);
    else setErr(true);
  };
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-[26px] font-extrabold tracking-tight">{t("t.find")}</h1>
      <p className="mt-1 text-[14.5px] text-muted">{t("t.findSub")}</p>
      <form onSubmit={(e) => { e.preventDefault(); go(); }} className="mt-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={id} onChange={(e) => { setId(e.target.value); setErr(false); }} placeholder="ACC-XXXXXX" className="h-12 w-full rounded-2xl border border-line bg-white pl-10 pr-3 font-mono text-[15px] font-bold uppercase shadow-card outline-none focus:border-brand focus:shadow-ring" />
        </div>
        <Button type="submit" disabled={!id.trim()}>{t("t.findCta")}</Button>
      </form>
      {err && <p className="mt-2 text-[13px] font-semibold text-rose">{t("t.notFound")}</p>}
      {orders.length > 0 && (
        <div className="mt-6 space-y-2">
          {orders.map((o) => (
            <Link key={o} href={`/track/${o}`} className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 font-mono text-[14px] font-bold shadow-card hover:border-brand/40">
              {o} <ArrowRight className="size-4 text-brand" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Tracker({ id }: { id: string }) {
  const t = useT();
  const lang = useJourney((s) => s.lang);
  const [o, setO] = useState<OrderView | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ticket, setTicket] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
    if (!res.ok) return setMissing(true);
    setO(await res.json());
  }, [id]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000); // live status — the owner never has to call
    if (new URLSearchParams(window.location.search).get("new")) {
      setIsNew(true);
      window.history.replaceState(null, "", `/track/${id}`);
      setTimeout(() => confetti({ particleCount: 120, spread: 100, origin: { y: 0.35 }, colors: ["#e5232b", "#ffb020", "#0e9f6e"] }), 250);
    }
    return () => clearInterval(poll);
  }, [id, load]);

  const patch = async (body: object) => {
    const res = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    setO(j);
    return j;
  };

  if (missing) return <div className="mx-auto max-w-md px-4 py-16 text-center text-muted">{t("t.notFound")} <Link href="/track" className="font-bold text-brand">{t("t.find")}</Link></div>;
  if (!o) return <div className="mx-auto max-w-2xl space-y-3 px-4 pt-6"><div className="skeleton h-40 rounded-3xl" /><div className="skeleton h-64 rounded-3xl" /></div>;

  const fmt = (ms: number, opts: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleString(LOCALE[lang], opts);
  const liveCount = o.services.filter((s) => s.status === "live").length;
  const pct = liveCount / Math.max(1, o.services.length);
  const done = o.current === "active";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-5">
      <AnimatePresence>
        {isNew && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 flex items-center gap-3 rounded-3xl bg-mint px-5 py-4 text-white shadow-soft">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.2 }} className="grid size-10 place-items-center rounded-2xl bg-white/20"><Check className="size-6" strokeWidth={3} /></motion.span>
            <div className="flex-1">
              <div className="text-[17px] font-extrabold">{t("t.confetti")}</div>
              <div className="text-[13px] text-white/85">{t("t.noCalls")}</div>
            </div>
            <button onClick={() => setIsNew(false)} className="text-[12px] font-bold text-white/80">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="relative overflow-hidden bg-ink p-5 text-white sm:p-6">
              <div className="absolute -right-16 -top-16 size-56 rounded-full bg-brand/40 blur-3xl" />
              <div className="relative flex items-center gap-5">
                <Ring pct={pct} done={done} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/50">{t("t.title")}</div>
                  <div className="truncate text-[21px] font-extrabold leading-tight">{o.business ?? t("app.name")}</div>
                  <div className="mt-1 text-[14px] font-semibold text-saffron">{done ? t("t.active") : t("t.eta", { date: fmt(o.eta, { weekday: "short", day: "numeric", month: "short" }) })}</div>
                  <button onClick={() => { navigator.clipboard?.writeText(o.id); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-mono text-[12px] font-bold hover:bg-white/20">
                    {o.id} {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-brand-tint px-5 py-3 text-[13px] font-semibold text-brand-dark">
              <PhoneOff className="size-4 shrink-0" /> {t("t.noCalls")}
            </div>
          </Card>

          <Card className="p-5">
            <ol className="relative">
              {o.stages.map((s, i) => {
                const isCurrent = s.key === o.current && !done;
                const isDone = s.done;
                return (
                  <motion.li key={s.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: i * 0.06 }} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < o.stages.length - 1 && (
                      <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-0.5 bg-sand">
                        <motion.span className="block w-full bg-mint" initial={{ height: 0 }} animate={{ height: o.stages[i + 1].done ? "100%" : "0%" }} transition={softSpring} />
                      </span>
                    )}
                    <motion.span
                      animate={isDone ? { backgroundColor: "#0e9f6e", color: "#fff", scale: 1 } : { backgroundColor: "#f7ece2", color: "#8a7f78", scale: 1 }}
                      className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full", isCurrent && "animate-pulse-ring")}
                    >
                      {isDone ? <Check className="size-4" strokeWidth={3} /> : <span className="size-2 rounded-full bg-current" />}
                    </motion.span>
                    <div className="pt-1">
                      <div className={cn("text-[15px] font-bold", !isDone && "text-muted")}>{t(`t.${s.key}`)}</div>
                      <div className="text-[12.5px] text-muted">{fmt(s.at, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
                      {s.key === "scheduled" && o.slot && <Badge tone="sky" className="mt-1">{o.slot.date} · {t(`t.${o.slot.window}`)}</Badge>}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{t("t.services")}</div>
            <ul className="space-y-3">
              {o.services.map((s) => {
                const span = s.installDays * 86400000;
                const prog = Math.min(1, Math.max(0.04, (o.now - o.createdAt) / span));
                const tone = s.status === "live" ? "mint" : s.status === "installing" ? "amber" : s.status === "scheduled" ? "sky" : "neutral";
                return (
                  <li key={s.id} className="flex items-center gap-3">
                    <ProductTile id={s.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[14px] font-bold">{t(`plain.${s.id}`)}{s.qty > 1 && <span className="text-muted"> ×{s.qty}</span>}</span>
                        <Badge tone={tone as "mint"}>{t(`t.status.${s.status}`)}</Badge>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
                        <motion.div className={cn("h-full rounded-full", s.status === "live" ? "bg-mint" : "bg-gradient-to-r from-brand to-saffron")} initial={false} animate={{ width: `${prog * 100}%` }} transition={softSpring} />
                      </div>
                      <div className="mt-1 text-[11.5px] text-muted">{PRODUCTS[s.id].name} · {fmt(s.due, { day: "numeric", month: "short" })}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <SlotPicker o={o} onPick={(slot) => patch({ slot })} />

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-sky-soft text-sky"><Wrench className="size-5" /></span>
              <div className="flex-1">
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{t("t.tech")}</div>
                <div className="text-[15px] font-bold">{o.technician.name}</div>
                <div className="flex items-center gap-1 text-[12px] text-muted"><Star className="size-3 fill-saffron text-saffron" /> {o.technician.rating} · {o.technician.phoneMasked}</div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{t("q.breakdown")}</span>
              <span className="text-[12px] text-muted">{o.contract} {t("c.months")}</span>
            </div>
            <div className="num text-[26px] font-extrabold">{inr(o.monthly)}<span className="text-[13px] font-semibold text-muted">{t("c.perMonth")} + GST</span></div>
            {o.setup > 0 && <div className="text-[12.5px] text-muted">+ {inr(o.setup)} {t("c.oneTime")}</div>}
          </Card>

          <Card className="p-5">
            <div className="mb-2 flex items-center gap-2 text-[14px] font-bold"><Headphones className="size-4 text-brand" /> {t("t.help")}</div>
            {ticketId ? (
              <p className="rounded-2xl bg-mint-soft px-3 py-2 text-[13px] font-semibold text-mint">{t("t.helpSent", { id: ticketId })}</p>
            ) : (
              <form onSubmit={async (e) => { e.preventDefault(); const j = await patch({ ticket }); setTicketId(j.ticketId); }} className="space-y-2">
                <textarea value={ticket} onChange={(e) => setTicket(e.target.value)} rows={2} placeholder={t("t.helpPlaceholder")} className="w-full resize-none rounded-2xl border border-line bg-cream/60 p-3 text-[14px] outline-none focus:border-brand" />
                <Button size="sm" variant="dark" disabled={!ticket.trim()}><MessageCircle className="size-4" /> {t("c.continue")}</Button>
              </form>
            )}
          </Card>

          <Card className="border-dashed p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-muted"><FastForward className="size-3.5" /> {t("t.demo")}</div>
            <div className="flex flex-wrap gap-2">
              {[["+1 day", 24], ["+3 days", 72], ["+7 days", 168]].map(([l, h]) => (
                <Button key={l} size="sm" variant="secondary" onClick={() => patch({ advanceHours: h })}>{l}</Button>
              ))}
            </div>
          </Card>

          <YourData o={o} />
        </div>
      </div>
    </div>
  );
}

function YourData({ o }: { o: OrderView }) {
  const t = useT();
  const consent = useJourney((s) => s.consent);
  const [withdrawn, setWithdrawn] = useState(false);
  const download = () => {
    const blob = new Blob([JSON.stringify({ order: o, consent }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${o.id}-my-data.json`;
    a.click();
  };
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2 text-[14px] font-bold"><ShieldCheck className="size-4 text-mint" /> {t("t.yourData")}</div>
      <p className="text-[12px] leading-snug text-muted">{t("kyc.consent.keepD")}</p>
      {consent && <p className="mt-1 font-mono text-[11px] text-muted">{consent.id} · {new Date(consent.at).toLocaleDateString("en-IN")}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={download}>{t("t.download")}</Button>
        <Button size="sm" variant="ghost" disabled={!consent || withdrawn} onClick={async () => { await fetch("/api/consent", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: consent?.id }) }); setWithdrawn(true); }}>{t("t.withdraw")}</Button>
      </div>
      {withdrawn && <p className="mt-2 rounded-xl bg-mint-soft px-3 py-2 text-[12px] font-semibold text-mint">{t("t.withdrawn")}</p>}
    </Card>
  );
}

function Ring({ pct, done }: { pct: number; done: boolean }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 72 72" className="size-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="7" />
        <motion.circle cx="36" cy="36" r={r} fill="none" stroke={done ? "#0e9f6e" : "#ffb020"} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0.04, pct)) }} transition={softSpring} />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-[17px] font-extrabold">{done ? <Check className="size-7 text-mint" strokeWidth={3} /> : `${Math.round(pct * 100)}%`}</span>
    </div>
  );
}

function SlotPicker({ o, onPick }: { o: OrderView; onPick: (s: { date: string; window: string }) => Promise<unknown> }) {
  const t = useT();
  const lang = useJourney((s) => s.lang);
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState(!o.slot);
  const days = [1, 2, 3].map((d) => new Date(o.createdAt + d * 86400000));
  const windows = ["morning", "afternoon", "evening"];
  if (!editing && o.slot)
    return (
      <Card className="p-5">
        <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{t("t.slot")}</div>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <div className="text-[17px] font-extrabold">{o.slot.date}</div>
            <div className="text-[13px] text-muted">{t(`t.${o.slot.window}`)}</div>
          </div>
          <Badge tone="mint"><Check className="size-3" /> {t("t.slotSaved")}</Badge>
        </div>
        <button onClick={() => setEditing(true)} className="mt-2 text-[12.5px] font-bold text-muted hover:text-brand">{t("t.reschedule")}</button>
      </Card>
    );
  return (
    <Card className="p-5">
      <div className="mb-3 text-[14px] font-bold">{t("t.pickSlot")}</div>
      <div className="space-y-2">
        {days.map((d) => {
          const label = d.toLocaleDateString({ en: "en-IN", hi: "hi-IN", mr: "mr-IN" }[lang], { weekday: "short", day: "numeric", month: "short" });
          return (
            <div key={label}>
              <div className="mb-1 text-[12px] font-bold text-muted">{label}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {windows.map((w) => {
                  const key = `${label}-${w}`;
                  return (
                    <motion.button key={w} whileTap={{ scale: 0.95 }} onClick={async () => { setSaving(key); await onPick({ date: label, window: w }); setSaving(null); setEditing(false); }} className="rounded-xl border border-line bg-cream/60 px-1 py-2 text-[11.5px] font-bold hover:border-brand/50 hover:bg-brand-tint">
                      {saving === key ? <Loader2 className="mx-auto size-4 animate-spin" /> : t(`t.${w}`)}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
