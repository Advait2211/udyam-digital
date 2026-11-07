"use client";

import { clsx, type ClassValue } from "clsx";
import { ArrowLeft, Check, Minus, Plus } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { LANGS } from "@/lib/i18n";
import { useJourney, useT } from "@/lib/store";
import type { Lang } from "@/lib/types";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
export const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.8 } as const;
export const softSpring = { type: "spring", stiffness: 260, damping: 28 } as const;

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2", className)} aria-label="Accel Business home">
      <motion.span whileHover={{ rotate: -6, scale: 1.05 }} transition={spring} className="relative grid size-9 place-items-center rounded-[12px] bg-brand shadow-pop">
        <svg viewBox="0 0 64 64" className="size-6">
          <path d="M20 46 32 16l12 30" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M25 36h14" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-saffron ring-2 ring-cream" />
      </motion.span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-extrabold tracking-tight text-ink">Accel</span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Business</span>
        </span>
      )}
    </Link>
  );
}

type BtnProps = HTMLMotionProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "dark" | "soft"; size?: "sm" | "md" | "lg"; full?: boolean };

export function Button({ variant = "primary", size = "md", full, className, children, disabled, ...rest }: BtnProps) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      whileHover={disabled ? undefined : { y: -1 }}
      transition={spring}
      disabled={disabled}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-2xl font-semibold outline-none transition-colors focus-visible:shadow-ring disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" && "h-9 px-3.5 text-[13px]",
        size === "md" && "h-12 px-5 text-[15px]",
        size === "lg" && "h-14 px-6 text-[16px]",
        variant === "primary" && "bg-brand text-white shadow-pop hover:bg-brand-dark",
        variant === "dark" && "bg-ink text-white hover:bg-black",
        variant === "secondary" && "border border-line bg-white text-ink shadow-card hover:border-ink/20",
        variant === "soft" && "bg-brand-soft text-brand-dark hover:bg-brand-soft/70",
        variant === "ghost" && "text-ink-2 hover:bg-sand",
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {variant === "primary" && !disabled && <span className="pointer-events-none absolute inset-0 shimmer opacity-30" />}
      <span className="relative inline-flex items-center gap-2">{children as ReactNode}</span>
    </motion.button>
  );
}

export function Chip({ selected, onClick, children, emoji, className, hint, disabled }: { selected?: boolean; onClick?: () => void; children: ReactNode; emoji?: string; className?: string; hint?: boolean; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.95 }}
      transition={spring}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "relative flex min-h-12 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-[14.5px] font-semibold transition-colors",
        selected ? "border-brand bg-brand text-white shadow-pop" : "border-line bg-white text-ink shadow-card hover:border-brand/40 hover:bg-brand-tint",
        hint && !selected && "border-saffron/60 bg-saffron-soft/60",
        disabled && "opacity-40",
        className,
      )}
    >
      {emoji && <span className="text-[19px] leading-none">{emoji}</span>}
      <span className="flex-1">{children}</span>
      <AnimatePresence>
        {selected && (
          <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring} className="grid size-5 place-items-center rounded-full bg-white/25">
            <Check className="size-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function Card({ className, children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div className={cn("rounded-[26px] border border-line/80 bg-white shadow-card", className)} {...rest}>
      {children}
    </motion.div>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50", on ? "bg-brand" : "bg-[#e3d6cb]")}
    >
      <motion.span layout transition={spring} className={cn("absolute top-1 size-5 rounded-full bg-white shadow", on ? "right-1" : "left-1")} />
    </button>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center rounded-xl border border-line bg-cream">
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="grid size-8 place-items-center text-ink-2 disabled:opacity-30">
        <Minus className="size-3.5" strokeWidth={2.5} />
      </button>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} transition={spring} className="num w-7 text-center text-[14px] font-bold">
          {value}
        </motion.span>
      </AnimatePresence>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="grid size-8 place-items-center text-ink-2 disabled:opacity-30">
        <Plus className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/** Smoothly animated rupee amount. */
export function Rupees({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const s = useSpring(mv, { stiffness: 180, damping: 26 });
  const text = useTransform(s, (v) => "₹" + Math.round(v).toLocaleString("en-IN"));
  useEffect(() => {
    mv.set(value);
  }, [mv, value]);
  return <motion.span className={cn("num", className)}>{text}</motion.span>;
}

export function LangSwitch({ className, dark }: { className?: string; dark?: boolean }) {
  const lang = useJourney((s) => s.lang);
  const setLang = useJourney((s) => s.setLang);
  const t = useT();
  return (
    <div className={cn("relative flex rounded-full p-1", dark ? "bg-white/10" : "bg-sand", className)} role="tablist" aria-label="Language">
      {LANGS.map((l: Lang) => (
        <button key={l} role="tab" aria-selected={lang === l} onClick={() => setLang(l)} className={cn("relative z-10 rounded-full px-2.5 py-1 text-[12.5px] font-bold transition-colors", lang === l ? (dark ? "text-ink" : "text-white") : dark ? "text-white/70" : "text-ink-2")}>
          {lang === l && <motion.span layoutId={dark ? "lang-pill-dark" : "lang-pill"} transition={spring} className={cn("absolute inset-0 -z-10 rounded-full", dark ? "bg-white" : "bg-ink")} />}
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}

export function TopBar({ back, title, right, className }: { back?: string; title?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-line/60 bg-cream/80 backdrop-blur-xl", className)}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        {back ? (
          <Link href={back} aria-label="Back" className="grid size-10 place-items-center rounded-full bg-white shadow-card transition hover:bg-sand">
            <ArrowLeft className="size-[18px]" />
          </Link>
        ) : (
          <Logo />
        )}
        <div className="min-w-0 flex-1 truncate text-[15px] font-bold">{title}</div>
        {right ?? <LangSwitch />}
      </div>
    </header>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-sand", className)}>
      <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-saffron" initial={false} animate={{ width: `${Math.max(4, value * 100)}%` }} transition={softSpring} />
    </div>
  );
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[86vh] max-w-xl overflow-hidden rounded-t-[30px] bg-cream shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={softSpring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line" />
            {title && <div className="px-5 pb-1 pt-3 text-[17px] font-extrabold">{title}</div>}
            <div className="safe-bottom max-h-[78vh] overflow-y-auto px-5 pb-5 pt-2">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "mint" | "amber" | "rose" | "sky" | "saffron"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold",
        tone === "neutral" && "bg-sand text-ink-2",
        tone === "brand" && "bg-brand-soft text-brand-dark",
        tone === "mint" && "bg-mint-soft text-mint",
        tone === "amber" && "bg-amber-soft text-amber",
        tone === "rose" && "bg-rose-soft text-rose",
        tone === "sky" && "bg-sky-soft text-sky",
        tone === "saffron" && "bg-saffron-soft text-[#9a6200]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Translated text for use inside server components. */
export function Tx({ k, p }: { k: string; p?: Record<string, string | number> }) {
  const t = useT();
  return <>{t(k, p)}</>;
}

export function Ready({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useJourney((s) => s.hydrated);
  if (!hydrated) return <>{fallback ?? <PageSkeleton />}</>;
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 pt-6">
      <div className="skeleton h-8 w-2/3 rounded-xl" />
      <div className="skeleton h-24 rounded-3xl" />
      <div className="skeleton h-24 rounded-3xl" />
    </div>
  );
}
