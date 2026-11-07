"use client";

import { BadgeCheck, CheckCheck, ChevronLeft, ExternalLink, List, SendHorizonal, Volume2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { BotMsg } from "@/lib/chatbot";
import { useJourney } from "@/lib/store";
import type { Lang } from "@/lib/types";
import { MicButton, speak } from "./mic";
import { Badge, Card, cn, LangSwitch, Logo, spring } from "./ui";

type Msg = { id: number; from: "me" | "bot"; text: string; options?: BotMsg["options"]; style?: BotMsg["style"]; link?: BotMsg["link"]; at: number; used?: boolean };
let n = 0;

export function Chat() {
  const appLang = useJourney((s) => s.lang);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [session, setSession] = useState<string | undefined>();
  const [lang, setLang] = useState<Lang>(appLang);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [typing, setTyping] = useState(false);
  const [list, setList] = useState<Msg | null>(null);
  const [last, setLast] = useState<{ req: object; res: object } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const send = async (payload: { text?: string; optionId?: string; label?: string; silent?: boolean }, sid = session) => {
    if (!payload.silent && (payload.text || payload.label)) setMsgs((m) => [...m.map((x) => ({ ...x, used: x.used || !!payload.optionId })), { id: ++n, from: "me", text: payload.label ?? payload.text ?? "", at: Date.now() }]);
    setTyping(true);
    const req = { from: sid, text: payload.text, optionId: payload.optionId };
    const res = await fetch("/api/whatsapp/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
    const j = (await res.json()) as { from: string; lang: Lang; replies: BotMsg[] };
    setLast({ req, res: j });
    setSession(j.from);
    setLang(j.lang);
    try { localStorage.setItem("accel-chat", j.from); } catch { /* private mode */ }
    // stagger replies like a real chat, but fast
    for (const [i, r] of j.replies.entries()) {
      await new Promise((ok) => setTimeout(ok, i === 0 ? 120 : 280));
      setMsgs((m) => [...m, { id: ++n, from: "bot", ...r, at: Date.now() }]);
    }
    setTyping(false);
  };

  useEffect(() => {
    let sid: string | undefined;
    try { sid = localStorage.getItem("accel-chat") ?? undefined; } catch { /* ignore */ }
    send({ text: "restart", silent: true }, sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, typing]);

  const time = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const value = interim || text;

  return (
    <div className="grain min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Logo />
        <Badge tone="neutral" className="hidden sm:inline-flex">WhatsApp-style front end · simulated</Badge>
        <LangSwitch className="ml-auto" />
      </header>
      <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 pb-10 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="relative mx-auto w-full max-w-[400px] rounded-[48px] bg-ink p-3 shadow-[0_40px_80px_-30px_rgba(31,26,23,0.6)]">
          <div className="relative flex h-[min(780px,calc(100vh-110px))] flex-col overflow-hidden rounded-[38px] bg-[#efe7dd]">
            <div className="flex items-center gap-2.5 bg-[#1f2c2a] px-3 pb-3 pt-8 text-white">
              <ChevronLeft className="size-5 opacity-70" />
              <span className="grid size-9 place-items-center rounded-full bg-brand"><svg viewBox="0 0 64 64" className="size-5"><path d="M20 46 32 16l12 30" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><path d="M25 36h14" stroke="#fff" strokeWidth="6" strokeLinecap="round" /></svg></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[15px] font-bold">Accel Business <BadgeCheck className="size-4 fill-[#25d366] text-[#1f2c2a]" /></div>
                <div className="text-[11.5px] text-white/60">{typing ? "typing…" : "Business account"}</div>
              </div>
            </div>

            <div ref={scroller} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3" style={{ backgroundImage: "radial-gradient(rgb(31 26 23 / 0.05) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
              <div className="mx-auto mb-2 w-fit rounded-lg bg-[#fff6d6] px-3 py-1.5 text-center text-[11px] text-ink-2 shadow-sm">🔒 Messages are end-to-end encrypted. Your documents are never asked for in chat.</div>
              <AnimatePresence initial={false}>
                {msgs.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                    <div className="max-w-[85%]">
                      <div className={cn("relative whitespace-pre-line rounded-2xl px-3 py-2 text-[14px] leading-snug shadow-sm", m.from === "me" ? "rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-white")}>
                        {m.text.split(/(\*[^*]+\*)/g).map((part, i) => (part.startsWith("*") ? <b key={i}>{part.slice(1, -1)}</b> : <span key={i}>{part}</span>))}
                        <span className="ml-2 inline-flex translate-y-1 items-center gap-0.5 float-right text-[10px] text-muted">
                          {time(m.at)} {m.from === "me" && <CheckCheck className="size-3.5 text-sky" />}
                        </span>
                        {m.from === "bot" && (
                          <button onClick={() => speak(m.text.replace(/[*•🎉🔒✅⚠️👍🙋↺]/g, ""), lang)} aria-label="Listen" className="ml-1 inline-grid size-5 translate-y-0.5 place-items-center rounded-full text-muted hover:bg-sand hover:text-brand">
                            <Volume2 className="size-3" />
                          </button>
                        )}
                      </div>
                      {m.link && (
                        <a href={m.link.href} className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-[13.5px] font-bold text-[#027eb5] shadow-sm hover:bg-[#f4f8fb]">
                          <ExternalLink className="size-4" /> {m.link.label}
                        </a>
                      )}
                      {m.options && !m.used && m.style === "buttons" && (
                        <div className="mt-1 grid gap-1">
                          {m.options.map((o) => (
                            <motion.button key={o.id} whileTap={{ scale: 0.97 }} onClick={() => send({ optionId: o.id, label: o.label })} className="rounded-xl bg-white py-2 text-[13.5px] font-bold text-[#027eb5] shadow-sm hover:bg-[#f4f8fb]">
                              {o.label}
                            </motion.button>
                          ))}
                        </div>
                      )}
                      {m.options && !m.used && m.style === "list" && (
                        <button onClick={() => setList(m)} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-[13.5px] font-bold text-[#027eb5] shadow-sm hover:bg-[#f4f8fb]">
                          <List className="size-4" /> {lang === "hi" ? "विकल्प देखें" : lang === "mr" ? "पर्याय पहा" : "Choose an option"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {typing && (
                <div className="flex w-fit gap-1 rounded-2xl rounded-tl-sm bg-white px-3 py-3 shadow-sm">
                  {[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-muted" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.12 }} />)}
                </div>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) { send({ text: value.trim() }); setText(""); setInterim(""); } }} className="flex items-center gap-2 bg-[#efe7dd] px-2 pb-4 pt-2">
              <input value={value} onChange={(e) => { setInterim(""); setText(e.target.value); }} placeholder={lang === "hi" ? "संदेश लिखें" : lang === "mr" ? "संदेश लिहा" : "Message"} className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-[14.5px] outline-none" />
              {value.trim() ? (
                <button aria-label="Send" className="grid size-11 place-items-center rounded-full bg-[#1f8f6f] text-white"><SendHorizonal className="size-[18px]" /></button>
              ) : (
                <MicButton onText={(s) => send({ text: s })} onInterim={setInterim} className="bg-[#1f8f6f] text-white hover:bg-[#187a5e]" />
              )}
            </form>

            <AnimatePresence>
              {list && (
                <>
                  <motion.div className="absolute inset-0 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setList(null)} />
                  <motion.div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto rounded-t-3xl bg-white pb-4" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={spring}>
                    <div className="sticky top-0 flex items-center gap-2 border-b border-line bg-white px-4 py-3">
                      <button onClick={() => setList(null)} aria-label="Close"><X className="size-5" /></button>
                      <span className="text-[15px] font-bold">{list.text.split("\n")[0]}</span>
                    </div>
                    {list.options!.map((o) => (
                      <button key={o.id} onClick={() => { setList(null); send({ optionId: o.id, label: o.label }); }} className="flex w-full items-center justify-between border-b border-line/60 px-5 py-3.5 text-left text-[14.5px] hover:bg-cream">
                        {o.label} <span className="size-4 rounded-full border-2 border-[#1f8f6f]" />
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="hidden space-y-4 lg:block">
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">The same advisor,<br /><span className="text-brand">where owners already are.</span></h1>
          <p className="max-w-lg text-[15px] text-ink-2">Type, tap or send a voice note in English, हिंदी or मराठी. The bot asks a few questions, builds the bundle with the same rules engine and hands over a link to the full quote — or a person, if the owner asks.</p>
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">Webhook contract</span>
              <Badge tone="sky">POST /api/whatsapp/webhook</Badge>
            </div>
            <pre className="max-h-[360px] overflow-auto rounded-2xl bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-[#f5e9df]">{last ? JSON.stringify({ request: last.req, response: last.res }, null, 2) : "…"}</pre>
            <p className="mt-2 text-[12px] text-muted">Wiring to Meta’s WhatsApp Cloud API needs only a thin adapter: map their message/button payloads to {"{ from, text | optionId }"} and send replies as text, reply buttons (≤3) or list messages (≤10 rows).</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
