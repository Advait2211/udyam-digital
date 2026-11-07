"use client";

import { ArrowRight, ChevronDown, Clock3, Info, Lock, Plus, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CATALOGUE, CONTRACTS, PRODUCTS } from "@/lib/catalogue";
import { inr, minContractFor, priceQuote, toggleLine } from "@/lib/engine/pricing";
import { CONNECTIVITY_IDS, contextFor, eligible } from "@/lib/engine/recommend";
import { currentLines, useJourney, useT } from "@/lib/store";
import type { BundleLine, Lang, Profile } from "@/lib/types";
import { ProductTile } from "./bundle";
import { Badge, Button, Card, Chip, cn, Rupees, spring, Stepper, Toggle } from "./ui";

const FIXED_QTY = new Set(["P13", "P14", "P15", "P17", "P18"]);

export function QuotePage() {
  const t = useT();
  const router = useRouter();
  const lang = useJourney((s) => s.lang);
  const profile = useJourney((s) => s.profile);
  const stored = useJourney((s) => s.lines);
  const setLines = useJourney((s) => s.setLines);
  const contract = useJourney((s) => s.contract);
  const setContract = useJourney((s) => s.setContract);
  const nonGstOnly = useJourney((s) => s.nonGstOnly);
  const [showMore, setShowMore] = useState(false);
  const [callback, setCallback] = useState(false);

  // Deep link from the chat bot: /quote?p=<base64 profile>&lang=hi
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("p");
    if (p) {
      try {
        const json = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))) as Profile;
        useJourney.getState().setProfile({ ...json, needs: json.needs ?? [] });
        const l = sp.get("lang") as Lang | null;
        if (l) useJourney.getState().setLang(l);
      } catch {
        /* ignore bad links */
      }
      window.history.replaceState(null, "", "/quote");
    }
  }, []);

  const lines = useMemo(() => currentLines(profile, stored, nonGstOnly), [profile, stored, nonGstOnly]);
  const minC = minContractFor(lines);
  const effContract = Math.max(contract, minC);
  const q = useMemo(() => priceQuote(lines, effContract), [lines, effContract]);
  const q12 = useMemo(() => priceQuote(lines, Math.max(12, minC)), [lines, minC]);
  const ctx = useMemo(() => contextFor(nonGstOnly ? { ...profile, hasGstin: false } : profile), [profile, nonGstOnly]);

  if (!profile.businessType && lines.length === 0)
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-[15px] text-muted">{t("q.empty")}</p>
        <Link href="/advisor"><Button className="mt-4">{t("home.cta")} <ArrowRight className="size-4" /></Button></Link>
      </div>
    );

  const update = (next: BundleLine[]) => setLines(next);
  const onToggle = (id: string, on: boolean) => update(toggleLine(lines, id, on));
  const onQty = (id: string, qty: number) => update(lines.map((l) => (l.id === id ? { ...l, qty } : l)));
  const conn = lines.find((l) => CONNECTIVITY_IDS.includes(l.id));
  const swapConn = (id: string) => {
    if (!conn || conn.id === id) return;
    update(lines.map((l) => (l.id === conn.id ? { ...l, id, reason: `why.${id}` } : l)));
  };
  const addProduct = (id: string) => {
    const units = PRODUCTS[id].unit === "per site" ? ctx.sites : 1;
    const next = [...lines, { id, qty: units, on: true, core: false, reason: `why.${id}` }];
    update(toggleLine(next, id, true));
  };

  const included = lines.filter((l) => l.on);
  const optional = lines.filter((l) => !l.on);
  const extra = CATALOGUE.filter((p) => !lines.some((l) => l.id === p.id) && !CONNECTIVITY_IDS.includes(p.id) && eligible(p.id, ctx).ok);
  const connOptions = CONNECTIVITY_IDS.filter((id) => eligible(id, ctx).ok && (!profile.noFibre || id === "P04" || id === "P05" || id === "P06"));
  const dependants = (id: string) => included.filter((l) => PRODUCTS[l.id].requiresOneOf.includes(id) && !included.some((h) => h.id !== id && PRODUCTS[l.id].requiresOneOf.includes(h.id)));

  const share = () => {
    const txt = `Accel Business quote\n${included.map((l) => `• ${PRODUCTS[l.id].name}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join("\n")}\n${inr(q.monthly)}/month + GST · ${effContract} months`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank", "noopener");
  };
  const requestCallback = async () => {
    setCallback(true);
    await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { ...profile, gstin: undefined }, lang, kind: "callback", stage: "quote" }) });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-40 pt-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">{t("q.title")}</h1>
          <p className="mt-1 text-[14.5px] text-muted">{t("q.sub")}</p>
        </div>

        {/* Contract */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{t("q.contract")}</span>
            {minC > 12 && <span className="flex items-center gap-1 text-[12px] text-muted"><Info className="size-3.5" /> {t("q.minContract", { n: minC })}</span>}
          </div>
          <div className="relative grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1">
            {CONTRACTS.map((c) => {
              const disabled = c < minC;
              const saving = q12.monthly - priceQuote(lines, Math.max(c, minC)).monthly;
              const active = effContract === c;
              return (
                <button key={c} disabled={disabled} onClick={() => setContract(c)} className={cn("relative z-10 rounded-xl px-2 py-2.5 text-center transition-colors disabled:opacity-35", active ? "text-white" : "text-ink")}>
                  {active && <motion.span layoutId="contract-pill" transition={spring} className="absolute inset-0 -z-10 rounded-xl bg-ink shadow-soft" />}
                  <span className="block text-[15px] font-extrabold">{c} {t("c.months")}</span>
                  <span className={cn("block text-[11.5px] font-bold", active ? "text-saffron" : "text-mint")}>{saving > 0 ? t("q.save", { amount: inr(saving) }) : "—"}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Connectivity swap */}
        {conn && connOptions.length > 1 && (
          <div>
            <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{t("q.speed")}</div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {connOptions.map((id) => (
                <Chip key={id} emoji={undefined} selected={conn.id === id} onClick={() => swapConn(id)} className="shrink-0">
                  <span className="block text-[13.5px]">{t(`plain.${id}`)}</span>
                  <span className={cn("block text-[11.5px] font-bold", conn.id === id ? "text-white/75" : "text-muted")}>{inr(priceQuote([{ id, qty: 1, on: true, core: true, reason: "" }], effContract).monthly)}{t("c.perMonth")}</span>
                </Chip>
              ))}
            </div>
          </div>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{t("q.included")}</span>
            <Badge tone="brand">{included.length === 1 ? t("c.item") : t("c.items", { n: included.length })}</Badge>
          </div>
          <motion.div layout className="space-y-2.5">
            <AnimatePresence initial={false}>
              {included.map((l) => (
                <LineRow key={l.id} line={l} unitPrice={q.lines.find((x) => x.id === l.id)!.unitPrice} lockedFor={dependants(l.id)} onToggle={onToggle} onQty={onQty} />
              ))}
            </AnimatePresence>
          </motion.div>
        </section>

        {(optional.length > 0 || extra.length > 0) && (
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.12em] text-[#9a6200]">
              <Sparkles className="size-4" /> {t("q.addons")}
            </div>
            <motion.div layout className="space-y-2.5">
              <AnimatePresence initial={false}>
                {optional.map((l) => (
                  <LineRow key={l.id} line={l} unitPrice={q.lines.find((x) => x.id === l.id)!.unitPrice} lockedFor={[]} onToggle={onToggle} onQty={onQty} />
                ))}
              </AnimatePresence>
            </motion.div>
            {extra.length > 0 && (
              <div className="mt-3">
                <button onClick={() => setShowMore((v) => !v)} className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink-2 hover:text-brand">
                  <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} /> {extra.length} more
                </button>
                <AnimatePresence>
                  {showMore && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid gap-2 pt-2 sm:grid-cols-2">
                        {extra.map((p) => (
                          <button key={p.id} onClick={() => addProduct(p.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-2.5 text-left shadow-card hover:border-brand/40">
                            <ProductTile id={p.id} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-bold">{t(`plain.${p.id}`)}</span>
                              <span className="block text-[11.5px] text-muted">{inr(priceQuote([{ id: p.id, qty: 1, on: true, core: false, reason: "" }], effContract).monthly)} {t(`unit.${p.unit}`)}</span>
                            </span>
                            <Plus className="size-4 text-brand" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>
        )}
      </div>

      <aside>
        <div className="space-y-3 lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <div className="relative overflow-hidden bg-ink p-5 text-white">
              <div className="absolute -right-12 -top-12 size-40 rounded-full bg-brand/40 blur-3xl" />
              <div className="relative">
                <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/50">{t("c.total")}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <Rupees value={q.monthlyWithGst} className="text-[42px] font-extrabold leading-none tracking-tight" />
                  <span className="text-[14px] font-semibold text-white/60">{t("c.perMonth")}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-white/60">{t("c.inclGst")} · {effContract} {t("c.months")}</div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold">
                  <Clock3 className="size-3.5" /> {t("q.ready", { days: q.maxInstallDays <= 1 ? t("c.day") : t("c.days", { n: q.maxInstallDays }) })}
                </div>
              </div>
            </div>
            <div className="space-y-2 p-5 text-[14px]">
              <Row label={t("q.monthly")} value={<Rupees value={q.monthly} />} />
              <Row label={t("c.gst")} value={<Rupees value={q.gst} />} />
              <div className="my-2 border-t border-dashed border-line" />
              <Row label={t("q.setup")} value={q.setup ? <Rupees value={q.setup} /> : <span className="font-bold text-mint">{t("c.free")}</span>} />
              {profile.spend ? (
                <div className="mt-3 rounded-2xl bg-sky-soft/60 px-3 py-2 text-[12.5px] font-semibold text-sky">{t("q.compare", { amount: inr(profile.spend) })}</div>
              ) : null}
              <p className="flex items-start gap-1.5 pt-2 text-[12px] text-muted"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-mint" /> {t("q.noHidden")}</p>
            </div>
          </Card>
          <div className="hidden gap-2 lg:flex">
            <Button variant="secondary" size="sm" onClick={share} className="flex-1"><Share2 className="size-4" /> WhatsApp</Button>
            <Button variant="secondary" size="sm" onClick={requestCallback} disabled={callback} className="flex-1">🙋 {t("c.talkToHuman")}</Button>
          </div>
          <Button size="lg" full onClick={() => router.push("/kyc")} className="hidden lg:flex">
            {t("q.cta")} <ArrowRight className="size-4" />
          </Button>
          <AnimatePresence>
            {callback && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-mint-soft px-3 py-2 text-[12.5px] font-semibold text-mint">
                {t("c.callbackDone")}
              </motion.p>
            )}
          </AnimatePresence>
          <p className="hidden text-center text-[12px] text-muted lg:block">{t("q.ctaSub")}</p>
        </div>
      </aside>

      {/* Mobile sticky checkout */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-cream/90 backdrop-blur-xl lg:hidden">
        <div className="safe-bottom mx-auto max-w-xl px-4 pt-3">
          <div className="mb-2 flex items-center justify-between text-[12.5px]">
            <button onClick={share} className="flex items-center gap-1 font-semibold text-muted"><Share2 className="size-3.5" /> WhatsApp</button>
            <button onClick={requestCallback} disabled={callback} className="font-semibold text-muted">{callback ? "✓" : "🙋"} {t("c.talkToHuman")}</button>
          </div>
          <Button size="lg" full onClick={() => router.push("/kyc")}>
            <span className="flex w-full items-center justify-between gap-3">
              <span className="text-left leading-tight">
                <Rupees value={q.monthlyWithGst} className="block text-[18px] font-extrabold" />
                <span className="block text-[10.5px] font-semibold text-white/70">{t("c.inclGst")}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[14.5px]">{t("c.continue")} <ArrowRight className="size-4" /></span>
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="num font-bold">{value}</span>
    </div>
  );
}

function LineRow({ line, unitPrice, lockedFor, onToggle, onQty }: { line: BundleLine; unitPrice: number; lockedFor: BundleLine[]; onToggle: (id: string, on: boolean) => void; onQty: (id: string, q: number) => void }) {
  const t = useT();
  const p = PRODUCTS[line.id];
  const locked = line.on && lockedFor.length > 0;
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring}>
      <Card className={cn("p-3.5 transition-colors", !line.on && "border-dashed bg-white/60")}>
        <div className="flex gap-3">
          <ProductTile id={line.id} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-bold leading-tight">{t(`plain.${line.id}`)}</div>
                <div className="mt-0.5 text-[11.5px] font-semibold text-muted">{p.name}</div>
              </div>
              <Toggle on={line.on} disabled={locked} onChange={(v) => onToggle(line.id, v)} label={p.name} />
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{t(line.reason)}</p>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {!FIXED_QTY.has(line.id) && line.on ? <Stepper value={line.qty} onChange={(v) => onQty(line.id, v)} max={200} /> : line.qty > 1 && <span className="text-[12px] font-bold text-muted">×{line.qty}</span>}
                <span className="text-[12px] text-muted">{inr(unitPrice)} {t(`unit.${p.unit}`)}</span>
              </div>
              <div className="text-right">
                <span className="num text-[16px] font-extrabold">{inr(unitPrice * line.qty)}</span>
                <span className="text-[11.5px] text-muted">{t("c.perMonth")}</span>
                {p.setup > 0 && <div className="text-[11px] text-muted">+ {inr(p.setup * line.qty)} {t("c.oneTime")}</div>}
              </div>
            </div>
            {locked && (
              <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted">
                <Lock className="size-3" /> {t("q.required", { items: lockedFor.map((d) => t(`plain.${d.id}`)).join(", ") })}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
