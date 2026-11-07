"use client";

import { Mic, Square } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SPEECH_LOCALE } from "@/lib/i18n";
import { useJourney } from "@/lib/store";
import { cn } from "./ui";

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
  onend: () => void;
  onerror: () => void;
};

/**
 * Voice input: the browser's built-in speech recognition (hi-IN / mr-IN / en-IN),
 * or Sarvam speech-to-text when the browser has none and a key is configured.
 */
export function MicButton({ onText, onInterim, className }: { onText: (t: string) => void; onInterim?: (t: string) => void; className?: string }) {
  const lang = useJourney((s) => s.lang);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const rec = useRef<SR | null>(null);
  const media = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const hasSR = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    const hasRec = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices;
    setSupported(hasSR || hasRec);
  }, []);

  const start = async () => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (Ctor) {
      const r = new Ctor();
      r.lang = SPEECH_LOCALE[lang];
      r.interimResults = true;
      r.continuous = false;
      let finalText = "";
      r.onresult = (e) => {
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += res[0].transcript;
          else interim += res[0].transcript;
        }
        onInterim?.(finalText + interim);
      };
      r.onend = () => {
        setListening(false);
        if (finalText.trim()) onText(finalText.trim());
      };
      r.onerror = () => setListening(false);
      rec.current = r;
      setListening(true);
      r.start();
      return;
    }
    // Fallback: record and send to Sarvam STT
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const fd = new FormData();
        fd.append("audio", new Blob(chunks, { type: "audio/webm" }));
        fd.append("lang", lang);
        const res = await fetch("/api/voice/stt", { method: "POST", body: fd });
        if (res.ok) onText((await res.json()).text);
      };
      media.current = mr;
      setListening(true);
      mr.start();
      setTimeout(() => mr.state === "recording" && mr.stop(), 8000);
    } catch {
      setSupported(false);
    }
  };

  const stop = () => {
    rec.current?.stop();
    if (media.current?.state === "recording") media.current.stop();
  };

  if (!supported) return null;
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={listening ? stop : start}
      aria-label={listening ? "Stop listening" : "Speak"}
      className={cn("relative grid size-11 shrink-0 place-items-center rounded-full transition-colors", listening ? "bg-brand text-white animate-pulse-ring" : "bg-sand text-ink hover:bg-brand-soft", className)}
    >
      {listening ? <Square className="size-4 fill-current" /> : <Mic className="size-[18px]" />}
    </motion.button>
  );
}

/** Speaks text aloud: Sarvam TTS if configured, else the browser's voice. */
export async function speak(text: string, lang: "en" | "hi" | "mr") {
  try {
    const res = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) });
    if (res.ok) {
      const { audio } = await res.json();
      await new Audio(`data:audio/wav;base64,${audio}`).play();
      return;
    }
  } catch {
    /* fall through */
  }
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LOCALE[lang];
    const v = speechSynthesis.getVoices().find((x) => x.lang === u.lang) ?? speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang));
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}
