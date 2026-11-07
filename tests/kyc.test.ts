import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DocType, extractFields } from "@/lib/kyc/extract";
import { gstinChecksumOk, ocrCandidates, validateGstin } from "@/lib/kyc/gstin";
import { verifyKyc, type KycInput } from "@/lib/kyc/validate";

const dir = path.join(__dirname, "fixtures", "ocr");
const FILES: Record<DocType, string> = { gst: "gst_certificate", udyam: "udyam_certificate", id: "signatory_id", address: "address_proof" };

// Image-quality signals the browser computes before OCR (blur score / auto-straighten angle)
const QUALITY: Record<string, Partial<Record<DocType, { blurry?: boolean; skewDeg?: number }>>> = {
  K02: { gst: { skewDeg: 4.6 } },
  K04: { gst: { blurry: true } },
};

function applicant(id: string): KycInput {
  const docs: KycInput["docs"] = {};
  for (const [t, f] of Object.entries(FILES) as [DocType, string][]) {
    const p = path.join(dir, `${id}_${f}.txt`);
    if (!fs.existsSync(p)) continue;
    const q = QUALITY[id]?.[t];
    docs[t] = {
      extracted: extractFields(t, fs.readFileSync(p, "utf8")),
      quality: { blur: q?.blurry ? 20 : 400, blurry: !!q?.blurry, skewDeg: q?.skewDeg ?? 0, textFound: true },
    };
  }
  return { docs };
}

const failKeys = (id: string) =>
  verifyKyc(applicant(id))
    .checks.filter((c) => c.status === "fail")
    .map((c) => c.key)
    .sort();

describe("GSTIN", () => {
  it("validates checksum on every registry-style id", () => {
    expect(gstinChecksumOk("37IHKXV5167L1ZS")).toBe(true);
    expect(validateGstin("08YKZXS8189L1Z0")).toMatchObject({ ok: false, reason: "checksum" });
  });
  it("repairs OCR confusions but not real typos", () => {
    expect(ocrCandidates("27QHIXKO658U1ZL")).toContain("27QHJXK0658U1ZL");
    expect(ocrCandidates("08YKZXS8189L1Z0")).not.toContain("08YKZXS5189L1ZO");
  });
});

describe("Smart KYC — 12 specimen applicants", () => {
  it("K01: cancelled GSTIN blocks GST products; Udyam certificate has no number", () => {
    const r = verifyKyc(applicant("K01"));
    expect(r.verdict).toBe("blocked");
    expect(failKeys("K01")).toEqual(["gstCancelled", "udyamNumberMissing"]);
  });
  it("K02: tilted scan is straightened and matched by name", () => {
    const r = verifyKyc(applicant("K02"));
    expect(r.business?.gstin).toBe("19EOGXH4115Y1ZL");
    expect(r.verdict).toBe("verified");
  });
  it("K03: clean", () => expect(verifyKyc(applicant("K03")).verdict).toBe("verified"));
  it("K04: blurry GST certificate → retake", () => {
    expect(failKeys("K04")).toContain("blurry");
    expect(verifyKyc(applicant("K04")).verdict).toBe("action");
  });
  it("K05: no Udyam certificate → fetched from registry, no upload needed", () => {
    const r = verifyKyc(applicant("K05"));
    expect(r.checks.find((c) => c.id === "udyam.lookup")?.key).toBe("udyamFetched");
    expect(r.verdict).not.toBe("blocked");
  });
  it("K06: GSTIN on certificate fails its check digit (typo / edited)", () => {
    const r = verifyKyc(applicant("K06"));
    expect(failKeys("K06")).toContain("gstinChecksum");
    expect(r.suggestions?.gstin).toBe("08YKZXS5189L1ZO");
  });
  it("K07: legal name on certificate differs from GST records", () => {
    expect(failKeys("K07")).toContain("gstNameMismatch");
  });
  it("K08: clean", () => expect(verifyKyc(applicant("K08")).verdict).toBe("verified"));
  it("K09: clean", () => expect(verifyKyc(applicant("K09")).verdict).toBe("verified"));
  it("K10: OCR misread corrected by registry", () => {
    const r = verifyKyc(applicant("K10"));
    expect(r.business?.gstin).toBe("27QHJXK0658U1ZL");
    expect(failKeys("K10")).toEqual([]);
  });
  it("K11: address proof older than 90 days", () => {
    expect(failKeys("K11")).toContain("addrStale");
  });
  it("K12: clean", () => expect(verifyKyc(applicant("K12")).verdict).toBe("verified"));
});
