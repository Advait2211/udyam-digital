"use client";

import confetti from "canvas-confetti";
import { AlertTriangle, ArrowRight, BadgeCheck, Camera, Check, CheckCircle2, ChevronDown, CircleAlert, CloudDownload, FileText, IdCard, Info, Loader2, Lock, Receipt, RefreshCw, ScanLine, ShieldCheck, Sparkles, Upload, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DOC_TYPES, extractFields, type DocType, type Extracted } from "@/lib/kyc/extract";
import { maskId } from "@/lib/kyc/gstin";
import { getOcr, processDocument, type Quality, type Stage } from "@/lib/kyc/image";
import type { Check as KycCheck, KycResult } from "@/lib/kyc/validate";
import { currentLines, useJourney, useT } from "@/lib/store";
import { Badge, Button, Card, cn, Progress, spring, Toggle } from "./ui";

type Slot = { status: "empty" } | { status: "working"; stage: Stage; progress: number; preview?: string } | { status: "done"; extracted: Extracted; quality: Quality; preview: string; source: "upload" | "sample" | "digilocker" } | { status: "error" };

const ICON: Record<DocType, React.ReactNode> = { gst: <FileText className="size-5" />, udyam: <BadgeCheck className="size-5" />, id: <IdCard className="size-5" />, address: <Receipt className="size-5" /> };
const FILE_NAME: Record<DocType, string> = { gst: "gst_certificate", udyam: "udyam_certificate", id: "signatory_id", address: "address_proof" };
const APPLICANTS = [
  ["K01", "Vindhya Tours & Travels"], ["K02", "Harmony Dental Care"], ["K03", "Ganesh Woodcraft"], ["K04", "Saffron Dental Care LLP"],
  ["K05", "Balaji Realty LLP"], ["K06", "Saffron Unisex Salon"], ["K07", "Neelgiri Physio Clinic"], ["K08", "Green Leaf Legal Associates"],
  ["K09", "Kaveri Insurance Advisors"], ["K10", "Kaveri Stays LLP"], ["K11", "Trinity Bake House Pvt Ltd"], ["K12", "Star Electronics"],
] as const;
const STEPS = ["consent", "docs", "review", "sign"] as const;
type KStep = (typeof STEPS)[number];

export function Kyc() {
  const t = useT();
  const consent = useJourney((s) => s.consent);
  const [step, setStep] = useState<KStep>(consent ? "docs" : "consent");
  const [result, setResult] = useState<KycResult | null>(null);
  const idx = STEPS.indexOf(step);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5">
      <h1 className="text-[26px] font-extrabold tracking-tight">{t("kyc.title")}</h1>
      <p className="mt-1 text-[14.5px] text-muted">{t("kyc.sub")}</p>

      <ol className="mt-5 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-sand">
              <motion.div className="h-full rounded-full bg-brand" initial={false} animate={{ width: i < idx ? "100%" : i === idx ? "55%" : "0%" }} transition={spring} />
            </div>
            <div className={cn("flex items-center gap-1 text-[12px] font-bold", i <= idx ? "text-ink" : "text-muted")}>
              {i < idx && <Check className="size-3.5 text-mint" strokeWidth={3} />}
              {t(`kyc.step.${s}`)}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={spring}>
            {step === "consent" && <Consent onDone={() => setStep("docs")} />}
            {step === "docs" && <Docs onResult={(r) => { setResult(r); setStep("review"); }} />}
            {step === "review" && result && <Review result={result} onBack={() => setStep("docs")} onSign={() => setStep("sign")} onResult={setResult} />}
            {step === "sign" && <Sign business={result?.business} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Consent({ onDone }: { onDone: () => void }) {
  const t = useT();
  const lang = useJourney((s) => s.lang);
  const setConsent = useJourney((s) => s.setConsent);
  const [kyc, setKyc] = useState(true);
  const [digi, setDigi] = useState(false);
  const [mkt, setMkt] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getOcr().catch(() => {}); // warm up on-device OCR while the owner reads
  }, []);

  const agree = async () => {
    setBusy(true);
    const res = await fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purposes: { kyc, digilocker: digi, marketing: mkt }, lang }) });
    const j = await res.json();
    setConsent({ id: j.id, required: kyc, digilocker: digi, marketing: mkt, at: j.at });
    onDone();
  };

  const rows = [
    { k: "what", icon: <FileText className="size-4" /> },
    { k: "why", icon: <Info className="size-4" /> },
    { k: "how", icon: <ScanLine className="size-4" /> },
    { k: "keep", icon: <RefreshCw className="size-4" /> },
    { k: "rights", icon: <ShieldCheck className="size-4" /> },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 bg-ink p-5 text-white">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/10"><Lock className="size-5" /></span>
        <div>
          <div className="text-[17px] font-extrabold">{t("kyc.consent.title")}</div>
          <div className="text-[12px] text-white/60">{t("kyc.consent.version")}</div>
        </div>
      </div>
      <div className="divide-y divide-line/70">
        {rows.map((r, i) => (
          <motion.div key={r.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.05 }} className="flex gap-3 px-5 py-3.5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{r.icon}</span>
            <div>
              <div className="text-[14px] font-bold">{t(`kyc.consent.${r.k}`)}</div>
              <div className="text-[13.5px] leading-snug text-ink-2">{t(`kyc.consent.${r.k}D`)}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="space-y-2 bg-cream/60 p-5">
        <ConsentRow title={t("kyc.consent.required")} sub={t("kyc.consent.requiredD")} on={kyc} onChange={setKyc} required />
        <ConsentRow title={t("kyc.consent.digilocker")} sub={t("kyc.consent.digilockerD")} on={digi} onChange={setDigi} />
        <ConsentRow title={t("kyc.consent.marketing")} sub={t("kyc.consent.marketingD")} on={mkt} onChange={setMkt} />
        <Button size="lg" full disabled={!kyc || busy} onClick={agree} className="mt-3">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} {t("kyc.consent.agree")}
        </Button>
      </div>
    </Card>
  );
}

function ConsentRow({ title, sub, on, onChange, required }: { title: string; sub: string; on: boolean; onChange: (v: boolean) => void; required?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
      <div className="flex-1">
        <div className="text-[14px] font-bold">{title}</div>
        <div className={cn("text-[12px] font-semibold", required ? "text-brand" : "text-muted")}>{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} label={title} />
    </label>
  );
}

function Docs({ onResult }: { onResult: (r: KycResult) => void }) {
  const t = useT();
  const profile = useJourney((s) => s.profile);
  const consent = useJourney((s) => s.consent);
  const [slots, setSlots] = useState<Record<DocType, Slot>>({ gst: { status: "empty" }, udyam: { status: "empty" }, id: { status: "empty" }, address: { status: "empty" } });
  const [verifying, setVerifying] = useState(false);
  const [applicant, setApplicant] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const inputs = useRef<Partial<Record<DocType, HTMLInputElement | null>>>({});

  const run = async (type: DocType, file: Blob, source: "upload" | "sample" | "digilocker") => {
    setSlots((s) => ({ ...s, [type]: { status: "working", stage: "checking", progress: 0.05 } }));
    try {
      const r = await processDocument(file, (stage, progress) => setSlots((s) => ({ ...s, [type]: { status: "working", stage, progress } })));
      const extracted = extractFields(type, r.text);
      setSlots((s) => ({ ...s, [type]: { status: "done", extracted: { ...extracted, confidence: r.confidence }, quality: r.quality, preview: r.preview, source } }));
    } catch {
      setSlots((s) => ({ ...s, [type]: { status: "error" } }));
    }
  };

  const loadApplicant = async (id: string) => {
    setApplicant(id);
    setOpen(false);
    setSlots({ gst: { status: "empty" }, udyam: { status: "empty" }, id: { status: "empty" }, address: { status: "empty" } });
    for (const type of DOC_TYPES) {
      const res = await fetch(`/samples/${id}_${FILE_NAME[type]}.png`);
      if (!res.ok) continue;
      run(type, await res.blob(), "sample");
    }
  };

  const busy = Object.values(slots).some((s) => s.status === "working");
  const ready = (["gst", "id", "address"] as DocType[]).some((k) => slots[k].status === "done");

  const verify = async () => {
    setVerifying(true);
    const docs: Record<string, { extracted: Extracted; quality: Quality }> = {};
    for (const k of DOC_TYPES) {
      const s = slots[k];
      if (s.status === "done") docs[k] = { extracted: s.extracted, quality: s.quality };
    }
    const res = await fetch("/api/kyc/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docs, expectedGstin: profile.gstin }) });
    const r = (await res.json()) as KycResult;
    sessionStorage.setItem("kyc-docs", JSON.stringify(docs)); // fields only, this tab only — cleared after signing
    setVerifying(false);
    onResult(r);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4 text-left">
          <span className="grid size-10 place-items-center rounded-2xl bg-saffron-soft text-[#9a6200]"><Sparkles className="size-5" /></span>
          <span className="flex-1">
            <span className="block text-[14.5px] font-bold">{t("kyc.sample")}</span>
            <span className="block text-[12.5px] text-muted">{applicant ? `${applicant} · ${APPLICANTS.find((a) => a[0] === applicant)?.[1]}` : t("kyc.sample.sub")}</span>
          </span>
          <ChevronDown className={cn("size-5 text-muted transition-transform", open && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3">
                {APPLICANTS.map(([id, name]) => (
                  <button key={id} onClick={() => loadApplicant(id)} className={cn("rounded-2xl border px-3 py-2 text-left transition hover:border-brand/40", applicant === id ? "border-brand bg-brand-tint" : "border-line bg-cream/60")}>
                    <span className="block font-mono text-[11px] font-bold text-brand">{id}</span>
                    <span className="block truncate text-[12.5px] font-semibold">{name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <div>
        <div className="text-[16px] font-extrabold">{t("kyc.docs.title")}</div>
        <p className="text-[13px] text-muted">{t("kyc.docs.sub")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DOC_TYPES.map((type) => (
          <DocSlot
            key={type}
            type={type}
            slot={slots[type]}
            digilocker={!!consent?.digilocker && (type === "udyam" || type === "id")}
            onPick={() => inputs.current[type]?.click()}
            onDigilocker={async () => {
              const id = applicant ?? "K03";
              const res = await fetch(`/samples/${id}_${FILE_NAME[type]}.png`);
              if (res.ok) run(type, await res.blob(), "digilocker");
            }}
          >
            <input ref={(el) => { inputs.current[type] = el; }} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(type, f, "upload"); e.target.value = ""; }} />
          </DocSlot>
        ))}
      </div>

      <div className="sticky bottom-3 z-10">
        <Button size="lg" full disabled={!ready || busy || verifying} onClick={verify} className="shadow-2xl">
          {verifying ? <><Loader2 className="size-4 animate-spin" /> {t("kyc.verifying")}</> : busy ? <><Loader2 className="size-4 animate-spin" /> {t("kyc.doc.reading")}</> : <><ShieldCheck className="size-4" /> {t("kyc.verify")}</>}
        </Button>
      </div>
    </div>
  );
}

function DocSlot({ type, slot, onPick, onDigilocker, digilocker, children }: { type: DocType; slot: Slot; onPick: () => void; onDigilocker: () => void; digilocker: boolean; children: React.ReactNode }) {
  const t = useT();
  const optional = type === "udyam";
  return (
    <Card layout className="relative overflow-hidden p-4">
      {children}
      <div className="flex items-start gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", slot.status === "done" ? (slot.quality.blurry ? "bg-rose-soft text-rose" : "bg-mint-soft text-mint") : "bg-brand-soft text-brand")}>{ICON[type]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold">{t(`kyc.doc.${type}`)}</span>
            {optional && <Badge>{t("kyc.doc.optional")}</Badge>}
          </div>
          <div className="text-[12.5px] text-muted">{t(`kyc.doc.${type}D`)}</div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {slot.status === "empty" && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 flex gap-2">
            <Button variant="soft" size="sm" onClick={onPick} className="flex-1"><Camera className="size-4" /> {t("kyc.doc.add")}</Button>
            {digilocker && <Button variant="secondary" size="sm" onClick={onDigilocker}><CloudDownload className="size-4" /> DigiLocker</Button>}
          </motion.div>
        )}
        {slot.status === "working" && (
          <motion.div key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
            <div className="relative h-24 overflow-hidden rounded-2xl bg-gradient-to-br from-sand to-cream">
              <div className="absolute inset-x-4 top-4 space-y-2 opacity-60">
                {[80, 60, 70, 45].map((w, i) => <div key={i} className="skeleton h-2.5 rounded-full" style={{ width: `${w}%` }} />)}
              </div>
              <div className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-brand/25 to-transparent animate-scan" />
              <div className="absolute inset-x-0 h-0.5 bg-brand shadow-[0_0_12px_2px_rgba(229,35,43,0.6)] animate-scan" />
            </div>
            <div className="mt-2 flex items-center justify-between text-[12.5px] font-semibold text-ink-2">
              <span className="flex items-center gap-1.5"><ScanLine className="size-4 text-brand" /> {t(`kyc.doc.${slot.stage === "done" ? "reading" : slot.stage}`)}</span>
              <span className="num text-muted">{Math.round(slot.progress * 100)}%</span>
            </div>
            <Progress value={slot.progress} className="mt-1.5 h-1" />
          </motion.div>
        )}
        {slot.status === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slot.preview} alt="" className="h-24 w-[72px] shrink-0 rounded-xl border border-line object-cover object-top" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap gap-1">
                  {slot.quality.blurry ? <Badge tone="rose"><AlertTriangle className="size-3" /> Blurry</Badge> : <Badge tone="mint"><Check className="size-3" /> {t("kyc.doc.done")}</Badge>}
                  {Math.abs(slot.quality.skewDeg) >= 1.5 && <Badge tone="sky">↻ {Math.abs(slot.quality.skewDeg).toFixed(1)}°</Badge>}
                  {slot.source === "digilocker" && <Badge tone="sky">DigiLocker</Badge>}
                </div>
                <FieldList fields={slot.extracted.fields} />
              </div>
            </div>
            <button onClick={onPick} className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-brand"><Upload className="size-3.5" /> {t("kyc.doc.replace")}</button>
          </motion.div>
        )}
        {slot.status === "error" && (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-2xl bg-rose-soft p-3 text-[13px] font-semibold text-rose">
            {t("kyc.check.unreadable")} <button onClick={onPick} className="underline">{t("kyc.fix.retake")}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

const SENSITIVE = new Set(["gstin", "idNo", "consumerNo", "udyamNumber"]);
const LABELS: Record<string, string> = {
  gstin: "GSTIN", legalName: "Legal name", tradeName: "Trade name", constitution: "Constitution", address: "Address", liabilityDate: "Since",
  udyamNumber: "Udyam no.", enterpriseName: "Enterprise", activity: "Activity", city: "City", state: "State", registeredOn: "Registered",
  name: "Name", designation: "Role", business: "For", idNo: "ID no.", validTill: "Valid till", consumerNo: "Consumer no.", billedTo: "Billed to", billDate: "Bill date",
};

function FieldList({ fields }: { fields: Record<string, string> }) {
  const keys = Object.keys(fields).filter((k) => LABELS[k] && !["units", "amount", "regType"].includes(k)).slice(0, 4);
  if (!keys.length) return <div className="text-[12px] text-muted">—</div>;
  return (
    <dl className="space-y-0.5">
      {keys.map((k, i) => (
        <motion.div key={k} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex gap-1.5 text-[11.5px] leading-tight">
          <dt className="shrink-0 font-semibold text-muted">{LABELS[k]}</dt>
          <dd className="truncate font-bold">{SENSITIVE.has(k) ? maskId(fields[k], 4, 3) : fields[k]}</dd>
        </motion.div>
      ))}
    </dl>
  );
}

function Review({ result, onBack, onSign, onResult }: { result: KycResult; onBack: () => void; onSign: () => void; onResult: (r: KycResult) => void }) {
  const t = useT();
  const lang = useJourney((s) => s.lang);
  const profile = useJourney((s) => s.profile);
  const setKyc = useJourney((s) => s.setKyc);
  const setNonGstOnly = useJourney((s) => s.setNonGstOnly);
  const [contacted, setContacted] = useState(false);
  const v = result.verdict;

  useEffect(() => {
    setKyc(v, { gstin: result.business?.gstin, legalName: result.business?.legalName, tradeName: result.business?.tradeName, signatory: result.extractedSummary.id?.name });
    if (v === "verified") confetti({ particleCount: 70, spread: 70, origin: { y: 0.3 }, colors: ["#e5232b", "#ffb020", "#0e9f6e"] });
  }, [v, result, setKyc]);

  const confirmGstin = async (gstin: string) => {
    const docs = JSON.parse(sessionStorage.getItem("kyc-docs") ?? "{}");
    const res = await fetch("/api/kyc/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docs, confirmedGstin: gstin }) });
    onResult(await res.json());
  };

  const groups = useMemo(() => {
    const order: (DocType | "business")[] = ["business", "gst", "udyam", "address", "id"];
    return order.map((d) => ({ d, checks: result.checks.filter((c) => c.doc === d) })).filter((g) => g.checks.length);
  }, [result]);

  const hero = {
    verified: { icon: <CheckCircle2 className="size-9" />, bg: "bg-mint", title: t("kyc.result.verified"), sub: t("kyc.result.verifiedD") },
    action: { icon: <CircleAlert className="size-9" />, bg: "bg-amber", title: t("kyc.result.action"), sub: t("kyc.result.actionD") },
    blocked: { icon: <XCircle className="size-9" />, bg: "bg-rose", title: t("kyc.result.blocked"), sub: t("kyc.result.blockedD") },
  }[v];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className={cn("relative flex items-center gap-4 p-5 text-white", hero.bg)}>
          <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.1 }} className="grid size-14 place-items-center rounded-2xl bg-white/20">
            {hero.icon}
          </motion.span>
          <div>
            <div className="text-[19px] font-extrabold leading-tight">{hero.title}</div>
            <div className="text-[13px] text-white/85">{hero.sub}</div>
          </div>
        </div>
        {result.business?.legalName && (
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Info2 label={t("kyc.business")} value={result.business.tradeName ?? result.business.legalName} sub={result.business.legalName !== result.business.tradeName ? result.business.legalName : result.business.constitution} />
            <Info2 label="GSTIN" value={result.business.gstin ? maskId(result.business.gstin, 4, 3) : "—"} sub={result.business.status ? <Badge tone={result.business.status === "Active" ? "mint" : "rose"}>{result.business.status}</Badge> : null} />
            <Info2 label="Udyam" value={result.business.udyam ? maskId(result.business.udyam, 9, 3) : "—"} sub={result.business.udyamType ? `${result.business.udyamType} enterprise` : undefined} />
            <Info2 label="State" value={result.business.state ?? "—"} sub={<span className="flex items-center gap-1 text-[11px] text-muted"><Lock className="size-3" /> {t("kyc.masked")}</span>} />
          </div>
        )}
      </Card>

      {groups.map(({ d, checks }) => (
        <Card key={d} className="p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
            {d === "business" ? <ShieldCheck className="size-4" /> : ICON[d as DocType]} {d === "business" ? t("kyc.business") : t(`kyc.doc.${d}`)}
          </div>
          <ul className="space-y-2">
            {checks.map((c, i) => (
              <CheckRow key={c.id} c={c} i={i} onFix={(a) => {
                if (a === "confirm_gstin" && c.params?.suggestion) confirmGstin(String(c.params.suggestion));
                else if (a === "contact") {
                  setContacted(true);
                  fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { ...profile, gstin: undefined }, lang, kind: "kyc-help", stage: "kyc", note: c.key }) });
                } else onBack();
              }} />
            ))}
          </ul>
        </Card>
      ))}
      {contacted && <p className="rounded-2xl bg-mint-soft px-4 py-3 text-[13px] font-semibold text-mint">{t("c.callbackDone")}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        {v === "verified" && <Button size="lg" full onClick={onSign}>{t("c.continue")} <ArrowRight className="size-4" /></Button>}
        {v === "blocked" && <Button size="lg" full onClick={() => { setNonGstOnly(true); onSign(); }}>{t("kyc.result.nonGst")} <ArrowRight className="size-4" /></Button>}
        <Button size="lg" variant="secondary" full={v === "action"} onClick={onBack}><RefreshCw className="size-4" /> {t("kyc.fix.upload")}</Button>
      </div>
    </div>
  );
}

function Info2({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-cream/70 p-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[14.5px] font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function CheckRow({ c, i, onFix }: { c: KycCheck; i: number; onFix: (a: string) => void }) {
  const t = useT();
  const tone = { pass: "text-mint bg-mint-soft", fail: "text-rose bg-rose-soft", warn: "text-amber bg-amber-soft", info: "text-sky bg-sky-soft" }[c.status];
  const icon = { pass: <Check className="size-3.5" strokeWidth={3} />, fail: <XCircle className="size-3.5" />, warn: <AlertTriangle className="size-3.5" />, info: <Info className="size-3.5" /> }[c.status];
  const params = Object.fromEntries(Object.entries(c.params ?? {}).map(([k, v]) => [k, ["gstin", "read", "typed", "suggestion", "udyam"].includes(k) ? String(v) : v]));
  return (
    <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.15 + i * 0.06 }} className="flex items-start gap-2.5">
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.2 + i * 0.06 }} className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", tone)}>{icon}</motion.span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold leading-snug">{t(`kyc.check.${c.key}`, params as Record<string, string>)}</div>
        {c.action && c.action !== "none" && (
          <button onClick={() => onFix(c.action!)} className="mt-1 rounded-full bg-ink px-3 py-1 text-[12px] font-bold text-white hover:bg-black">
            {t(`kyc.fix.${c.action}`, { gstin: String(c.params?.suggestion ?? "") })}
          </button>
        )}
      </div>
    </motion.li>
  );
}

function Sign({ business }: { business?: KycResult["business"] }) {
  const t = useT();
  const router = useRouter();
  const lang = useJourney((s) => s.lang);
  const profile = useJourney((s) => s.profile);
  const stored = useJourney((s) => s.lines);
  const contract = useJourney((s) => s.contract);
  const consent = useJourney((s) => s.consent);
  const kycVerdict = useJourney((s) => s.kycVerdict);
  const kycBusiness = useJourney((s) => s.kycBusiness);
  const nonGstOnly = useJourney((s) => s.nonGstOnly);
  const addOrder = useJourney((s) => s.addOrder);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const signer = kycBusiness?.signatory ?? business?.legalName?.replace(/\s*\(.*$/, "") ?? "the signatory";

  const place = async () => {
    setBusy(true);
    const lines = currentLines(profile, stored, nonGstOnly);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, lines, contract, consentId: consent?.id, kycVerdict, business: business?.tradeName ?? kycBusiness?.tradeName, gstin: business?.gstin ?? kycBusiness?.gstin, lang, nonGstOnly }),
    });
    const j = await res.json();
    sessionStorage.removeItem("kyc-docs");
    if (j.id) {
      addOrder(j.id);
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: ["#e5232b", "#ffb020", "#0e9f6e", "#ffffff"] });
      setTimeout(() => router.push(`/track/${j.id}?new=1`), 700);
    } else setBusy(false);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Sparkles className="size-6" /></span>
        <div>
          <div className="text-[18px] font-extrabold">{t("kyc.sign.title")}</div>
          <div className="text-[13px] text-muted">{t("kyc.sign.sub", { name: signer })}</div>
        </div>
      </div>
      <label className="mt-5 block text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{t("kyc.sign.otp")}</label>
      <div className="relative mt-2">
        <input value={otp} inputMode="numeric" autoFocus maxLength={6} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="absolute inset-0 opacity-0" aria-label="OTP" />
        <div className="grid grid-cols-6 gap-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} animate={{ scale: otp.length === i ? 1.04 : 1, borderColor: otp.length === i ? "#e5232b" : "#efe2d6" }} className="grid h-14 place-items-center rounded-2xl border-2 bg-white font-mono text-[22px] font-extrabold">
              {otp[i] ?? ""}
            </motion.div>
          ))}
        </div>
      </div>
      <Button size="lg" full className="mt-5" disabled={otp.length < 6 || busy} onClick={place}>
        {busy ? <><Loader2 className="size-4 animate-spin" /> {t("kyc.sign.signing")}</> : <>{t("kyc.sign.cta")} <ArrowRight className="size-4" /></>}
      </Button>
      <p className="mt-3 text-center text-[12px] text-muted">{t("c.demoDate")}</p>
    </Card>
  );
}
