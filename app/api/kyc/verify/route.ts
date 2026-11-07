import { logEvent } from "@/lib/db";
import { maskId } from "@/lib/kyc/gstin";
import { verifyKyc, type KycInput } from "@/lib/kyc/validate";

/** Server-side KYC verification. The client sends only extracted fields + image-quality signals — never images. */
export async function POST(req: Request) {
  const input = (await req.json()) as KycInput;
  const result = verifyKyc(input);
  logEvent("kyc.verify", maskId(result.business?.gstin, 4, 3), {
    verdict: result.verdict,
    fails: result.checks.filter((c) => c.status === "fail").map((c) => c.key),
  });
  return Response.json(result);
}
