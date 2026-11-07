"use client";

import { Activity, BarChart3, Bot, Filter, Flame, Inbox, Languages, PhoneCall, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { inr } from "@/lib/engine/pricing";
import { Badge, Button, Card, cn, Logo, spring } from "./ui";

type DatasetLead = {
  id: string; name: string; type: string; segment: string; city: string; tier: number; language: string; employees: number; sites: number;
  source: string; stage: string; reason: string; gstin: boolean; spend: number; interest: string; contact: string; role: string; score: number;
};
type LiveLead = { id: string; created_at: number; lang: string; kind: string; stage: string; profile: { businessType?: string; city?: string; employees?: number; sites?: number; segment?: string; needs?: string[]; businessName?: string }; monthly: number; score: number; status: string; assigned: string | null; note: string | null };
type Stats = {
  insights: typeof import("@/lib/generated/insights.json");
  live: { orders: number; leads: number; consents: number; kycRuns: number; lookups: number; mrr: number; recentOrders: { id: string; created_at: number; business: string | null; monthly: number; lang: string }[]; events: { at: number; type: string; ref: string | null }[] };
  model: { auc: number; baseRate: number; drivers: { feature: string; weight: number }[] };
  ai: { nim: boolean; sarvam: boolean; chatModel: string; visionModel: string; sarvamModel: string };
};

const ACTION: Record<string, string> = {
  "Owner had no time for a visit": "Send self-serve link on WhatsApp — no visit needed",
  "Visit not scheduled by sales": "Send self-serve link; partner visits only if asked",
  "Quote too complex to understand": "Share the one-price digital quote",
  "Quote took too long to arrive": "Share the instant digital quote",
  "Found paperwork too long": "Smart KYC link — 5 minutes on phone",
  "Missing GST or Udyam document": "Udyam/GST lookup — no paper needed",
  "Document details did not match": "Re-run Smart KYC with guided fixes",
  "Authorised signatory not available": "Remote Aadhaar e-sign by signatory",
  "Decided to wait": "Nudge in their language in 2 weeks",
  "Price too high": "Offer 36-month price + drop add-ons",
  "Installation delayed beyond 21 days": "Apologise + priority install slot",
  "Site not feasible for fibre": "Offer 5G AirFiber — live in 2 days",
  "Customer cancelled before install": "Call: confirm slot, offer AirFiber bridge",
  "First payment failed": "Resend UPI AutoPay link",
};
const TEAM = ["Inside sales", "Channel partner", "Field team"];
const SEG_SHORT: Record<string, string> = { "Micro retail & services": "Micro", "Professional offices": "Professional", "Small multi-site businesses": "Multi-site", "Small manufacturers": "Manufacturer" };
const BIZ: Record<string, string> = { kirana: "Kirana / shop", pharmacy: "Pharmacy", salon: "Salon", bakery: "Bakery", boutique: "Boutique", restaurant: "Restaurant", clinic: "Clinic / lab", office: "Office", coaching: "Coaching", chain: "Chain", factory: "Factory" };
const LANG: Record<string, string> = { en: "English", hi: "Hindi", mr: "Marathi" };

export function Partner() {
  const [tab, setTab] = useState<"calls" | "insights" | "live">("calls");
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<{ live: LiveLead[]; dataset: DatasetLead[] } | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/partner/stats").then((r) => r.json()).then(setStats);
      fetch("/api/partner/leads").then((r) => r.json()).then(setLeads);
    };
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const h = stats?.insights.headline;
  return (
    <div className="min-h-screen bg-[#f6f3ef]">
      <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Logo />
          <Badge tone="neutral" className="hidden sm:inline-flex">Partner & sales console</Badge>
          <nav className="ml-auto flex rounded-full bg-sand p-1">
            {([["calls", "Call list", PhoneCall], ["insights", "Insights", BarChart3], ["live", "Live", Activity]] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={cn("relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold", tab === k ? "text-white" : "text-ink-2")}>
                {tab === k && <motion.span layoutId="ptab" transition={spring} className="absolute inset-0 -z-0 rounded-full bg-ink" />}
                <Icon className="relative size-4" /> <span className="relative hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Leads last quarter" value={h ? h.leads.toLocaleString("en-IN") : "—"} sub="smb_leads.csv" />
          <Kpi label="Activated" value={h ? `${h.activationRate}%` : "—"} sub={h ? `${h.activated} of ${h.leads}` : ""} tone="rose" />
          <Kpi label="Blended CAC" value={h ? inr(h.blendedCAC) : "—"} sub="per activated SMB" tone="rose" />
          <Kpi label="Digital orders (live)" value={stats ? String(stats.live.orders) : "—"} sub={stats ? `${inr(stats.live.mrr)} MRR` : ""} tone="mint" />
          <Kpi label="Hand-offs waiting" value={leads ? String(leads.live.filter((l) => l.status === "new").length) : "—"} sub="from advisor, chat, KYC" tone="brand" />
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
              {tab === "calls" && <CallList leads={leads} model={stats?.model} />}
              {tab === "insights" && stats && <Insights s={stats} />}
              {tab === "live" && stats && <Live s={stats} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "rose" | "mint" | "brand" }) {
  return (
    <Card className="p-4">
      <div className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className={cn("num mt-1 text-[26px] font-extrabold tracking-tight", tone === "rose" && "text-rose", tone === "mint" && "text-mint", tone === "brand" && "text-brand")}>{value}</div>
      {sub && <div className="text-[12px] text-muted">{sub}</div>}
    </Card>
  );
}

function ScoreBar({ score, base }: { score: number; base: number }) {
  const lift = score / base;
  const tone = lift >= 2 ? "bg-mint" : lift >= 1.2 ? "bg-saffron" : "bg-[#d9cabd]";
  return (
    <div className="flex items-center gap-2" title={`${(score * 100).toFixed(1)}% likely to activate · ${lift.toFixed(1)}× the average lead`}>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-sand">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, score * 400)}%` }} transition={spring} className={cn("h-full rounded-full", tone)} />
      </div>
      <span className="num w-10 text-[12.5px] font-bold">{(score * 100).toFixed(0)}%</span>
      {lift >= 2 && <Flame className="size-3.5 text-brand" />}
    </div>
  );
}

function CallList({ leads, model }: { leads: { live: LiveLead[]; dataset: DatasetLead[] } | null; model?: Stats["model"] }) {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("All");
  const [seg, setSeg] = useState("All");
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const base = model?.baseRate ?? 0.074;

  const rows = useMemo(() => {
    if (!leads) return [];
    return leads.dataset.filter((l) => (lang === "All" || l.language === lang) && (seg === "All" || SEG_SHORT[l.segment] === seg) && (!q || `${l.name} ${l.city} ${l.type} ${l.reason}`.toLowerCase().includes(q.toLowerCase())));
  }, [leads, q, lang, seg]);
  const langs = useMemo(() => ["All", ...new Set((leads?.dataset ?? []).map((l) => l.language))], [leads]);

  const assign = async (id: string, who: string, live: boolean) => {
    setAssigned((a) => ({ ...a, [id]: who }));
    if (live) await fetch(`/api/partner/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigned: who, status: "assigned" }) });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="size-5 text-brand" />
            <h2 className="text-[17px] font-extrabold">Hand-offs from the digital journey</h2>
            <Badge tone="brand">{leads?.live.length ?? 0}</Badge>
          </div>
          {!leads?.live.length ? (
            <p className="rounded-2xl border border-dashed border-line p-5 text-center text-[13.5px] text-muted">When an owner taps “Talk to a person” in the advisor, quote, KYC or chat, the lead lands here with its bundle and a score.</p>
          ) : (
            <ul className="divide-y divide-line">
              {leads.live.map((l) => (
                <motion.li key={l.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-[12px] font-extrabold text-brand-dark">{l.kind === "chat" ? "💬" : l.kind === "kyc-help" ? "🪪" : "🙋"}</span>
                  <div className="min-w-[180px] flex-1">
                    <div className="text-[14px] font-bold">{l.profile.businessName ?? BIZ[l.profile.businessType ?? ""] ?? "Business"} · {l.profile.city ?? "—"}</div>
                    <div className="text-[12px] text-muted">{l.id} · {LANG[l.lang]} · stalled at {l.stage}{l.note ? ` · ${l.note}` : ""} · {new Date(l.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                  <div className="text-right"><div className="num text-[14px] font-extrabold">{inr(l.monthly)}</div><div className="text-[11px] text-muted">bundle / mo</div></div>
                  <ScoreBar score={l.score} base={base} />
                  <AssignMenu value={assigned[l.id] ?? l.assigned} onPick={(w) => assign(l.id, w, true)} />
                </motion.li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <div className="flex items-center gap-2"><Users className="size-5 text-ink-2" /><h2 className="text-[17px] font-extrabold">Dropped leads worth a call</h2></div>
            <span className="text-[12px] text-muted">ranked by likelihood to activate</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-40 rounded-xl border border-line bg-cream/50 pl-8 pr-2 text-[13px] outline-none focus:border-brand" />
              </div>
              <Select value={seg} onChange={setSeg} options={["All", "Micro", "Professional", "Multi-site", "Manufacturer"]} icon={<Filter className="size-3.5" />} />
              <Select value={lang} onChange={setLang} options={langs} icon={<Languages className="size-3.5" />} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="bg-cream/60 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                <tr><th className="px-4 py-2.5">Business</th><th className="px-2">Language</th><th className="px-2">Dropped at</th><th className="px-2">Next best action</th><th className="px-2">Likelihood</th><th className="px-4">Assign</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.slice(0, 60).map((l) => (
                  <tr key={l.id} className="hover:bg-brand-tint/40">
                    <td className="px-4 py-2.5">
                      <div className="font-bold">{l.name}</div>
                      <div className="text-[11.5px] text-muted">{l.type} · {l.city} (T{l.tier}) · {l.employees} staff{l.sites > 1 ? ` · ${l.sites} sites` : ""}{l.gstin ? " · GST ✓" : ""}</div>
                    </td>
                    <td className="px-2"><Badge tone={l.language === "English" || l.language === "Hindi" ? "neutral" : "sky"}>{l.language}</Badge></td>
                    <td className="px-2"><div className="font-semibold">{l.stage}</div><div className="text-[11.5px] text-muted">{l.reason}</div></td>
                    <td className="max-w-[220px] px-2 text-[12.5px] font-semibold text-ink-2">{ACTION[l.reason] ?? "Call"}</td>
                    <td className="px-2"><ScoreBar score={l.score} base={base} /></td>
                    <td className="px-4"><AssignMenu value={assigned[l.id]} onPick={(w) => assign(l.id, w, false)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-3 text-center text-[12px] text-muted">Showing {Math.min(60, rows.length)} of {rows.length} · scores from a logistic model on lead-time features only</div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2 text-[15px] font-extrabold"><Sparkles className="size-4 text-brand" /> Propensity model</div>
          <p className="text-[12.5px] text-muted">Logistic regression on 5,000 leads, using only what is known when a lead arrives. 5-fold cross-validated AUC <b className="text-ink">{model?.auc ?? "—"}</b>.</p>
          <ul className="mt-3 space-y-1.5">
            {(model?.drivers ?? []).slice(0, 9).map((d) => (
              <li key={d.feature} className="flex items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate font-semibold">{d.feature.replace("=", ": ").replace(/_/g, " ")}</span>
                <span className="relative h-2 w-24 rounded-full bg-sand">
                  <span className={cn("absolute top-0 h-2 rounded-full", d.weight > 0 ? "left-1/2 bg-mint" : "right-1/2 bg-rose")} style={{ width: `${Math.min(50, Math.abs(d.weight) * 45)}%` }} />
                </span>
                <span className={cn("num w-10 text-right font-bold", d.weight > 0 ? "text-mint" : "text-rose")}>{d.weight > 0 ? "+" : ""}{d.weight.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <div className="mb-2 text-[15px] font-extrabold">How partners fit in</div>
          <ul className="space-y-2 text-[12.5px] text-ink-2">
            <li>🧭 <b>Digital first</b> for micro shops: CAC on field visits (₹24k) is ~10× their monthly bill.</li>
            <li>🤝 <b>Partners close the hard 20%</b>: multi-site, leased lines, owners who ask for a person.</li>
            <li>💰 Partner gets the <b>same commission</b> on any digital order from their pin code — no channel conflict.</li>
            <li>🗣️ Calls routed to someone who speaks the owner’s language.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Select({ value, onChange, options, icon }: { value: string; onChange: (v: string) => void; options: string[]; icon: React.ReactNode }) {
  return (
    <label className="relative flex h-9 items-center gap-1 rounded-xl border border-line bg-cream/50 pl-2.5 pr-1 text-[13px] font-semibold">
      {icon}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent pr-1 outline-none">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function AssignMenu({ value, onPick }: { value?: string | null; onPick: (w: string) => void }) {
  const [open, setOpen] = useState(false);
  if (value) return <Badge tone="mint">✓ {value}</Badge>;
  return (
    <div className="relative">
      <Button size="sm" variant="dark" onClick={() => setOpen((v) => !v)}><PhoneCall className="size-3.5" /> Assign</Button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {TEAM.map((w) => <button key={w} onClick={() => { onPick(w); setOpen(false); }} className="block w-full px-3 py-2 text-left text-[13px] font-semibold hover:bg-brand-tint">{w}</button>)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HBars({ rows, max, fmt, highlight, title, note }: { rows: { label: string; value: number; sub?: string; key?: string }[]; max?: number; fmt: (v: number) => string; highlight?: (k: string) => boolean; title: string; note?: string }) {
  const m = max ?? Math.max(...rows.map((r) => r.value));
  return (
    <Card className="p-5">
      <div className="text-[15px] font-extrabold">{title}</div>
      {note && <div className="mb-3 text-[12px] text-muted">{note}</div>}
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.label} className="group" title={`${r.label}: ${fmt(r.value)}${r.sub ? ` · ${r.sub}` : ""}`}>
            <div className="mb-1 flex justify-between gap-2 text-[12.5px]">
              <span className="truncate font-semibold text-ink-2">{r.label}</span>
              <span className="num shrink-0 font-bold">{fmt(r.value)}{r.sub && <span className="font-medium text-muted"> · {r.sub}</span>}</span>
            </div>
            <div className="h-2.5 rounded-full bg-sand">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(r.value / m) * 100}%` }} transition={{ ...spring, delay: i * 0.03 }} className={cn("h-full rounded-[4px]", highlight?.(r.key ?? r.label) ? "bg-brand" : "bg-ink/70 group-hover:bg-ink")} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Insights({ s }: { s: Stats }) {
  const ins = s.insights;
  const fixable = ins.drops.filter((d) => d.fixedBy).reduce((a, d) => a + d.n, 0);
  const totalDrops = ins.drops.reduce((a, d) => a + d.n, 0);
  const FIX: Record<string, string> = { advisor: "Advisor", quote: "Quote", kyc: "Smart KYC", tracker: "Tracker" };
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <HBars title="Funnel, Apr–Jun 2026" note="Steepest drop: needs assessed → quote accepted (44%)" rows={ins.funnel.map((f) => ({ label: f.stage, value: f.count, sub: f.pctPrev ? `${f.pctPrev}% of prev.` : undefined }))} fmt={(v) => v.toLocaleString("en-IN")} highlight={(k) => k === "Quote accepted"} />
        <HBars title="Why leads drop (and which screen fixes it)" note={`${fixable.toLocaleString("en-IN")} of ${totalDrops.toLocaleString("en-IN")} drops (${Math.round((fixable / totalDrops) * 100)}%) are process failures the digital journey removes · red = fixable`} rows={ins.drops.slice(0, 12).map((d) => ({ label: d.reason, key: d.reason, value: d.n, sub: d.fixedBy ? FIX[d.fixedBy] : undefined }))} fmt={(v) => String(v)} highlight={(k) => !!ins.drops.find((d) => d.reason === k)?.fixedBy} />
      </div>
      <Card className="overflow-x-auto p-5">
        <div className="mb-3 text-[15px] font-extrabold">Segments — where to start</div>
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted"><tr><th className="py-2">Segment</th><th>Leads</th><th>Activation</th><th>Median bundle</th><th>CAC</th><th>6-mo churn</th><th>NPS</th><th>Days to live</th></tr></thead>
          <tbody className="divide-y divide-line">
            {ins.segments.map((g) => (
              <tr key={g.segment}>
                <td className="py-2.5 font-bold">{g.segment}</td>
                <td className="num">{g.leads.toLocaleString("en-IN")}</td>
                <td className="num font-bold">{g.rate}%</td>
                <td className="num">{inr(g.medianMRR)}</td>
                <td className={cn("num font-bold", g.cac > g.medianMRR * 4 ? "text-rose" : "")}>{inr(g.cac)}</td>
                <td className={cn("num", g.churn6m > 20 ? "font-bold text-rose" : "")}>{g.churn6m}%</td>
                <td className="num">{g.nps}</td>
                <td className="num">{g.daysToActivate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-muted">Micro shops are 54% of leads but their CAC is ~{Math.round(ins.segments.find((x) => x.segment.startsWith("Micro"))!.cac / ins.segments.find((x) => x.segment.startsWith("Micro"))!.medianMRR)}× their monthly bill — only a near-zero-touch digital journey makes them profitable.</p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <HBars title="CAC by lead source" note="Cost per activated customer" rows={ins.sources.map((x) => ({ label: x.source, value: x.cac, sub: `${x.rate}% activate` }))} fmt={(v) => inr(v)} highlight={(k) => k === "Field sales" || k === "Channel partner"} />
        <HBars title="Status chases → churn" note="6-month churn by follow-up calls made by the customer" rows={ins.followUpCalls.map((x) => ({ label: `${x.calls} call${x.calls > 1 ? "s" : ""}`, value: x.churn6m, sub: `NPS ${x.nps}` }))} fmt={(v) => `${v}%`} highlight={(k) => k.startsWith("4") || k.startsWith("5")} />
        <HBars title="Speed → satisfaction" note="NPS by days from lead to activation" rows={ins.daysToActivate.map((x) => ({ label: `${x.bucket} days`, value: x.nps, sub: `${x.n} customers` }))} fmt={(v) => v.toFixed(1)} max={10} />
      </div>
    </div>
  );
}

function Live({ s }: { s: Stats }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="mb-3 text-[15px] font-extrabold">Recent digital orders</div>
        {s.live.recentOrders.length === 0 ? <p className="text-[13px] text-muted">No orders yet — run the journey from the home page.</p> : (
          <ul className="divide-y divide-line">
            {s.live.recentOrders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                <span className="font-mono font-bold">{o.id}</span>
                <span className="flex-1 truncate">{o.business ?? "—"}</span>
                <Badge>{LANG[o.lang] ?? o.lang}</Badge>
                <span className="num font-bold">{inr(o.monthly)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="GSTIN lookups" v={s.live.lookups} />
          <Mini label="KYC runs" v={s.live.kycRuns} />
          <Mini label="Consents" v={s.live.consents} />
          <Mini label="Hand-offs" v={s.live.leads} />
        </div>
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-extrabold"><Bot className="size-4" /> AI providers</div>
          <ProviderRow name="NVIDIA NIM" on={s.ai.nim} detail={`${s.ai.chatModel} · ${s.ai.visionModel}`} />
          <ProviderRow name="Sarvam" on={s.ai.sarvam} detail={`${s.ai.sarvamModel} · speech`} />
          <p className="mt-2 text-[11.5px] text-muted">Without keys every screen still works: rule-based understanding, template explanations, on-device OCR, browser speech.</p>
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-extrabold"><ShieldCheck className="size-4 text-mint" /> Audit trail (masked)</div>
          <ul className="space-y-1 font-mono text-[11.5px]">
            {s.live.events.map((e, i) => (
              <li key={i} className="flex gap-2"><span className="text-muted">{new Date(e.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><span className="font-bold">{e.type}</span><span className="truncate text-muted">{e.ref}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, v }: { label: string; v: number }) {
  return <div className="rounded-2xl bg-cream/70 p-3"><div className="num text-[22px] font-extrabold">{v}</div><div className="text-[11.5px] font-semibold text-muted">{label}</div></div>;
}

function ProviderRow({ name, on, detail }: { name: string; on: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={cn("size-2.5 rounded-full", on ? "bg-mint" : "bg-[#d9cabd]")} />
      <span className="text-[13.5px] font-bold">{name}</span>
      <span className="ml-auto text-[11px] text-muted">{on ? "connected" : "key not set · fallback"}</span>
      <span className="sr-only">{detail}</span>
    </div>
  );
}
