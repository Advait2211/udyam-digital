"use client";

import { Lock, ShoppingBag, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { PRODUCTS, PRODUCT_EMOJI } from "@/lib/catalogue";
import { inr, priceQuote } from "@/lib/engine/pricing";
import { useT } from "@/lib/store";
import type { Profile, Recommendation } from "@/lib/types";
import { Badge, cn, Rupees, Sheet, spring } from "./ui";

const TILE: Record<string, string> = {
  Connectivity: "from-[#ffe1dc] to-[#ffd0c7]",
  Communication: "from-[#e5f0ff] to-[#d6e5ff]",
  "Cloud & Productivity": "from-[#e8f7ef] to-[#d3f0e0]",
  Security: "from-[#efe9ff] to-[#e1d7ff]",
  "IoT & Physical": "from-[#fff1d4] to-[#ffe5ad]",
};

export function ProductTile({ id, size = "md" }: { id: string; size?: "sm" | "md" | "lg" }) {
  const p = PRODUCTS[id];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br", TILE[p.category], size === "sm" && "size-9 rounded-xl text-[17px]", size === "md" && "size-11 text-[20px]", size === "lg" && "size-14 text-[26px]")}>
      {PRODUCT_EMOJI[id]}
    </span>
  );
}

export function LiveBundle({ rec, profile, compact }: { rec: Recommendation; profile: Profile; compact?: boolean }) {
  const t = useT();
  const on = rec.lines.filter((l) => l.on);
  const addons = rec.lines.filter((l) => !l.on);
  const q = useMemo(() => priceQuote(rec.lines, 12), [rec.lines]);
  const blocked = rec.blocked.filter((b) => !b.alt);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{t("adv.liveBundle")}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <Rupees value={q.monthly} className="text-[30px] font-extrabold leading-none" />
            <span className="text-[13px] font-semibold text-muted">{t("c.perMonth")}</span>
          </div>
        </div>
        <Badge tone="brand">{on.length === 1 ? t("c.item") : t("c.items", { n: on.length })}</Badge>
      </div>
      {q.setup > 0 && <div className="mt-1 text-[12.5px] text-muted">+ {inr(q.setup)} {t("c.oneTime")}</div>}

      {on.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-5 text-center text-[13.5px] text-muted">
          <ShoppingBag className="mx-auto mb-2 size-6 text-brand/60" />
          {t("adv.liveBundle.empty")}
        </div>
      ) : (
        <motion.ul layout className="mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {on.map((l) => {
              const line = q.lines.find((x) => x.id === l.id)!;
              return (
                <motion.li
                  key={l.id}
                  layout
                  initial={{ opacity: 0, x: 24, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -24, scale: 0.96 }}
                  transition={spring}
                  className="flex items-center gap-3 rounded-2xl bg-cream/80 p-2.5"
                >
                  <ProductTile id={l.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold">{t(`plain.${l.id}`)}</div>
                    {!compact && <div className="truncate text-[11.5px] text-muted">{PRODUCTS[l.id].name}{l.qty > 1 ? ` · ×${l.qty}` : ""}</div>}
                    {compact && l.qty > 1 && <div className="text-[11.5px] text-muted">×{l.qty}</div>}
                  </div>
                  <div className="num text-[13.5px] font-bold">{inr(line.monthly)}</div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      {addons.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-saffron-soft/70 px-3 py-2 text-[12.5px] font-semibold text-[#8a5800]">
          <Sparkles className="size-4" /> {t("adv.addons")}: {addons.map((a) => t(`plain.${a.id}`)).slice(0, 3).join(", ")}
        </div>
      )}
      {blocked.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {blocked.map((b) => (
            <li key={b.id} className="flex items-start gap-2 text-[12px] text-muted">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <b className="text-ink-2">{t(`plain.${b.id}`)}</b> — {t(`blocked.${b.reason}`, { ...b.params, city: profile.city ?? "" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BundlePill({ rec, profile }: { rec: Recommendation; profile: Profile }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const on = rec.lines.filter((l) => l.on);
  const q = useMemo(() => priceQuote(rec.lines, 12), [rec.lines]);
  if (on.length === 0) return null;
  return (
    <>
      <motion.button
        layout
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-soft lg:hidden"
      >
        <span className="relative grid size-8 place-items-center rounded-xl bg-white/10">
          <ShoppingBag className="size-4" />
          <motion.span key={on.length} initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={spring} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold">
            {on.length}
          </motion.span>
        </span>
        <span className="flex-1 text-left text-[13.5px] font-semibold text-white/80">{t("adv.liveBundle")}</span>
        <Rupees value={q.monthly} className="text-[17px] font-extrabold" />
        <span className="text-[12px] text-white/60">{t("c.perMonth")}</span>
      </motion.button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <LiveBundle rec={rec} profile={profile} />
      </Sheet>
    </>
  );
}
