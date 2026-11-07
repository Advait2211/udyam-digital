import "server-only";
import { DocType, Extracted, normAddr, normName, splitProprietor } from "./extract";
import { GST_STATES, normalizeOcrGstin, ocrCandidates, validateGstin } from "./gstin";
import { gstByBusinessName, gstRecord, GstRecord, udyamByBusinessName, udyamLookup, udyamRecord } from "./registry";

export const KYC_TODAY = "2026-07-15"; // README: use as "today" for date checks
export const ADDRESS_PROOF_MAX_DAYS = 90;

export type CheckStatus = "pass" | "warn" | "fail" | "info";
export type FixAction = "retake" | "upload_recent" | "upload" | "confirm_gstin" | "contact" | "none";

export interface Check {
  id: string;
  doc: DocType | "business";
  status: CheckStatus;
  key: string; // i18n key: kyc.check.<key>
  params?: Record<string, string | number>;
  action?: FixAction;
}

export interface DocInput {
  extracted?: Extracted;
  quality?: { blur: number; blurry: boolean; skewDeg: number; textFound: boolean };
}

export interface KycInput {
  docs: Partial<Record<DocType, DocInput>>;
  expectedGstin?: string; // typed earlier by the owner (advisor / lookup step)
  confirmedGstin?: string; // owner accepted a suggestion
}

export interface KycResult {
  checks: Check[];
  verdict: "verified" | "action" | "blocked";
  business?: {
    gstin?: string;
    legalName?: string;
    tradeName?: string;
    constitution?: string;
    status?: string;
    state?: string;
    udyam?: string;
    udyamType?: string;
  };
  suggestions?: { gstin?: string; udyam?: string };
  extractedSummary: Partial<Record<DocType, Record<string, string>>>;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function verifyKyc(input: KycInput): KycResult {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const f = (t: DocType) => input.docs[t]?.extracted?.fields ?? {};
  const present = (t: DocType) => !!input.docs[t]?.extracted || !!input.docs[t]?.quality;

  // ---------- 0. Image quality / presence ----------
  for (const t of ["gst", "udyam", "id", "address"] as DocType[]) {
    const d = input.docs[t];
    if (!d) continue;
    if (d.quality?.blurry) add({ id: `${t}.blur`, doc: t, status: "fail", key: "blurry", action: "retake" });
    else if (d.quality && Math.abs(d.quality.skewDeg) >= 1.5)
      add({ id: `${t}.skew`, doc: t, status: "info", key: "straightened", params: { deg: Math.abs(Math.round(d.quality.skewDeg)) } });
    const det = d.extracted?.detectedType;
    if (det && det !== t) add({ id: `${t}.wrongtype`, doc: t, status: "fail", key: "wrongType", params: { found: det }, action: "upload" });
    if (d.extracted && Object.keys(d.extracted.fields).length < 2 && !d.quality?.blurry)
      add({ id: `${t}.unreadable`, doc: t, status: "fail", key: "unreadable", action: "retake" });
  }

  // ---------- 1. GSTIN ----------
  const g = f("gst");
  let gstin: string | undefined;
  let rec: GstRecord | undefined;
  let suggestion: string | undefined;
  const certState = stateFromAddress(g.address) ?? stateFromAddress(f("address").address);

  if (input.confirmedGstin) {
    gstin = input.confirmedGstin;
    rec = gstRecord(gstin);
    if (g.gstin && normalizeOcrGstin(g.gstin) !== gstin)
      add({ id: "gst.format", doc: "gst", status: "warn", key: "gstinConfirmed", params: { read: g.gstin, gstin } });
  } else if (g.gstin) {
    const v = validateGstin(normalizeOcrGstin(g.gstin));
    if (v.ok && gstRecord(v.gstin)) {
      gstin = v.gstin;
      rec = gstRecord(v.gstin);
      add({ id: "gst.format", doc: "gst", status: "pass", key: "gstinValid" });
    } else {
      // OCR misreads (I↔J, O↔0…) — accept only if it lands on a registry entry with the same name
      const cands = ocrCandidates(g.gstin).filter((c) => {
        const r = gstRecord(c);
        return r && (sameName(r.legalName, g.legalName) || sameName(r.tradeName, g.tradeName));
      });
      if (cands.length === 1) {
        gstin = cands[0];
        rec = gstRecord(gstin);
        add({ id: "gst.format", doc: "gst", status: "info", key: "gstinOcrCorrected", params: { read: g.gstin, gstin } });
      } else {
        const byName = g.legalName ? gstByBusinessName(g.legalName, certState) : [];
        suggestion = byName.length === 1 ? byName[0] : undefined;
        const lowQuality = input.docs.gst?.quality?.blurry || Math.abs(input.docs.gst?.quality?.skewDeg ?? 0) >= 1.5;
        if (lowQuality && suggestion) {
          // We could not read the number from a poor photo, but name + address match exactly one registration
          gstin = suggestion;
          rec = gstRecord(gstin);
          add({ id: "gst.format", doc: "gst", status: "info", key: "gstinMatchedByName", params: { gstin } });
          suggestion = undefined;
        } else {
          const reason = v.ok ? "notFound" : v.reason;
          add({
            id: "gst.format",
            doc: "gst",
            status: "fail",
            key: reason === "checksum" ? "gstinChecksum" : reason === "notFound" ? "gstinNotFound" : "gstinFormat",
            params: { read: g.gstin, ...(suggestion ? { suggestion } : {}) },
            action: suggestion ? "confirm_gstin" : "upload",
          });
        }
      }
    }
  } else if (present("gst")) {
    const byName = g.legalName ? gstByBusinessName(g.legalName, certState) : [];
    if (byName.length === 1) {
      gstin = byName[0];
      rec = gstRecord(gstin);
      add({ id: "gst.format", doc: "gst", status: "info", key: "gstinMatchedByName", params: { gstin } });
    } else if (!input.docs.gst?.quality?.blurry) {
      add({ id: "gst.format", doc: "gst", status: "fail", key: "gstinMissing", action: "retake" });
    }
  } else if (input.expectedGstin) {
    add({ id: "gst.doc", doc: "gst", status: "fail", key: "docMissing", params: { doc: "gst" }, action: "upload" });
  }

  if (gstin && input.expectedGstin && input.expectedGstin !== gstin)
    add({ id: "gst.expected", doc: "gst", status: "warn", key: "gstinDiffers", params: { typed: input.expectedGstin, gstin } });

  if (rec && gstin) {
    if (rec.status === "Active") add({ id: "gst.status", doc: "business", status: "pass", key: "gstActive" });
    else
      add({
        id: "gst.status",
        doc: "business",
        status: "fail",
        key: rec.status === "Cancelled" ? "gstCancelled" : "gstSuspended",
        action: "contact",
      });

    // Name on the certificate vs registry (edited / outdated certificate)
    if (g.legalName || g.tradeName) {
      const legalOk = !g.legalName || sameName(g.legalName, rec.legalName);
      const tradeOk = !g.tradeName || sameName(g.tradeName, rec.tradeName);
      if (legalOk && tradeOk) add({ id: "gst.name", doc: "gst", status: "pass", key: "gstNameMatch" });
      else
        add({
          id: "gst.name",
          doc: "gst",
          status: "fail",
          key: "gstNameMismatch",
          params: { onDoc: !legalOk ? g.legalName : g.tradeName, inRecords: !legalOk ? rec.legalName : rec.tradeName },
          action: "upload",
        });
    }
    if (g.address && !sameAddr(g.address, rec.address))
      add({ id: "gst.addr", doc: "gst", status: "warn", key: "gstAddrDiffers" });
  }

  const bizName = rec?.tradeName ?? g.tradeName ?? f("udyam").enterpriseName;
  const bizState = rec?.state ?? certState ?? f("udyam").state;

  // ---------- 2. Udyam ----------
  const u = f("udyam");
  let udyam: string | undefined;
  let uSuggestion: string | undefined;
  if (present("udyam") && u.udyamNumber) {
    const l = udyamLookup(u.udyamNumber);
    if (!l.valid) add({ id: "udyam.format", doc: "udyam", status: "fail", key: "udyamFormat", params: { read: u.udyamNumber }, action: "retake" });
    else if (!l.record) add({ id: "udyam.registry", doc: "udyam", status: "fail", key: "udyamNotFound", action: "upload" });
    else {
      udyam = l.number;
      const nameOk = sameName(l.record.name, u.enterpriseName ?? l.record.name) && (!bizName || sameName(l.record.name, bizName));
      add(
        nameOk
          ? { id: "udyam.registry", doc: "udyam", status: "pass", key: "udyamFound", params: { type: l.record.type } }
          : { id: "udyam.registry", doc: "udyam", status: "fail", key: "udyamNameMismatch", params: { onDoc: l.record.name }, action: "upload" },
      );
    }
  } else if (bizName) {
    // Missing certificate or a certificate without a number: look it up instead of asking for paper
    const hits = udyamByBusinessName(bizName, bizState);
    if (hits.length === 1) {
      uSuggestion = hits[0];
      udyam = hits[0];
      add({
        id: "udyam.lookup",
        doc: "udyam",
        status: present("udyam") ? "warn" : "info",
        key: present("udyam") ? "udyamNumberMissingFound" : "udyamFetched",
        params: { udyam: hits[0] },
      });
    } else if (present("udyam")) {
      add({ id: "udyam.number", doc: "udyam", status: "fail", key: "udyamNumberMissing", action: "upload" });
    } else {
      add({ id: "udyam.optional", doc: "udyam", status: "info", key: "udyamNone" });
    }
  }
  const uRec = udyam ? udyamRecord(udyam) : undefined;

  // ---------- 3. Address proof ----------
  const a = f("address");
  if (present("address")) {
    if (a.billedTo && bizName)
      add(
        sameName(a.billedTo, bizName) || (rec && sameName(a.billedTo, rec.legalName))
          ? { id: "addr.name", doc: "address", status: "pass", key: "addrNameMatch" }
          : { id: "addr.name", doc: "address", status: "fail", key: "addrNameMismatch", params: { onDoc: a.billedTo }, action: "upload" },
      );
    if (a.address && rec)
      add(
        sameAddr(a.address, rec.address)
          ? { id: "addr.match", doc: "address", status: "pass", key: "addrMatch" }
          : { id: "addr.match", doc: "address", status: "warn", key: "addrDiffers" },
      );
    if (a.billDate && /^\d{4}-\d{2}-\d{2}$/.test(a.billDate)) {
      const age = daysBetween(a.billDate, KYC_TODAY);
      if (age < 0) add({ id: "addr.date", doc: "address", status: "fail", key: "addrFuture", params: { date: a.billDate }, action: "upload_recent" });
      else if (age > ADDRESS_PROOF_MAX_DAYS)
        add({ id: "addr.date", doc: "address", status: "fail", key: "addrStale", params: { date: a.billDate, days: age }, action: "upload_recent" });
      else add({ id: "addr.date", doc: "address", status: "pass", key: "addrRecent", params: { days: age } });
    } else if (!input.docs.address?.quality?.blurry) {
      add({ id: "addr.date", doc: "address", status: "warn", key: "addrNoDate" });
    }
  } else {
    add({ id: "addr.doc", doc: "address", status: "fail", key: "docMissing", params: { doc: "address" }, action: "upload" });
  }

  // ---------- 4. Signatory ----------
  const s = f("id");
  if (present("id")) {
    const constitution = rec?.constitution ?? g.constitution ?? "";
    const prop = splitProprietor(rec?.legalName ?? g.legalName);
    if (s.name) {
      if (/proprietor/i.test(constitution) && prop) {
        add(
          sameName(s.name, prop.person)
            ? { id: "sig.name", doc: "id", status: "pass", key: "sigIsProprietor" }
            : { id: "sig.name", doc: "id", status: "fail", key: "sigNotProprietor", params: { onDoc: s.name, owner: prop.person }, action: "upload" },
        );
      } else if (/partner|director/i.test(s.designation ?? "")) {
        add({ id: "sig.name", doc: "id", status: "pass", key: "sigRoleOk", params: { role: s.designation } });
      } else if (constitution) {
        add({ id: "sig.name", doc: "id", status: "warn", key: "sigNeedsAuthority", params: { constitution } });
      }
    }
    if (s.business && bizName && !sameName(s.business, bizName) && !(rec && sameName(s.business, rec.legalName)))
      add({ id: "sig.biz", doc: "id", status: "fail", key: "sigOtherBusiness", params: { onDoc: s.business }, action: "upload" });
    if (s.validTill && /^\d{4}-\d{2}-\d{2}$/.test(s.validTill)) {
      add(
        daysBetween(KYC_TODAY, s.validTill) >= 0
          ? { id: "sig.valid", doc: "id", status: "pass", key: "sigValid", params: { date: s.validTill } }
          : { id: "sig.valid", doc: "id", status: "fail", key: "sigExpired", params: { date: s.validTill }, action: "upload" },
      );
    }
  } else {
    add({ id: "sig.doc", doc: "id", status: "fail", key: "docMissing", params: { doc: "id" }, action: "upload" });
  }

  // ---------- Verdict ----------
  const fails = checks.filter((c) => c.status === "fail");
  const blocked = fails.some((c) => c.id === "gst.status");
  const verdict = blocked ? "blocked" : fails.length ? "action" : "verified";

  return {
    checks,
    verdict,
    business: {
      gstin,
      legalName: rec?.legalName ?? g.legalName,
      tradeName: rec?.tradeName ?? g.tradeName,
      constitution: rec?.constitution ?? g.constitution,
      status: rec?.status,
      state: bizState,
      udyam,
      udyamType: uRec?.type,
    },
    suggestions: { gstin: suggestion, udyam: uSuggestion },
    extractedSummary: Object.fromEntries(
      Object.entries(input.docs).map(([k, v]) => [k, v?.extracted?.fields ?? {}]),
    ) as KycResult["extractedSummary"],
  };
}

function sameName(a?: string, b?: string) {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  return x === y || (x.length > 6 && y.length > 6 && (x.includes(y) || y.includes(x)) && Math.min(x.length, y.length) / Math.max(x.length, y.length) > 0.8);
}

function sameAddr(a?: string, b?: string) {
  const x = normAddr(a), y = normAddr(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // tolerate OCR noise: compare PIN + house/unit number + city tokens
  const pin = (s: string) => s.match(/\d{6}$/)?.[0];
  const unit = (s: string) => s.match(/unit(\d+)/)?.[1];
  return pin(x) === pin(y) && unit(x) === unit(y);
}

function stateFromAddress(addr?: string): string | undefined {
  if (!addr) return undefined;
  const states = Object.values(GST_STATES).sort((p, q) => q.length - p.length);
  const flat = addr.toLowerCase().replace(/\s+/g, "");
  return states.find((s) => flat.includes(s.toLowerCase().replace(/\s+/g, "")));
}
