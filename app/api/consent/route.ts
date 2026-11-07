import { db, logEvent, newId } from "@/lib/db";

export async function POST(req: Request) {
  const { purposes, lang, noticeVersion = "1.2" } = (await req.json()) as { purposes: Record<string, boolean>; lang?: string; noticeVersion?: string };
  if (!purposes?.kyc) return Response.json({ error: "KYC consent is required to continue" }, { status: 400 });
  const id = newId("CNS", 8);
  db().prepare("INSERT INTO consents (id, created_at, purposes, notice_version, lang) VALUES (?, ?, ?, ?, ?)").run(id, Date.now(), JSON.stringify(purposes), noticeVersion, lang ?? "en");
  logEvent("consent.given", id, purposes);
  return Response.json({ id, at: new Date().toISOString() });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };
  db().prepare("UPDATE consents SET withdrawn_at = ? WHERE id = ?").run(Date.now(), id);
  logEvent("consent.withdrawn", id);
  return Response.json({ ok: true });
}
