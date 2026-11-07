"""Lead-data analysis + propensity model for Project Udyam Digital.

Run:  python3 -I analysis/analyze.py
Writes lib/generated/insights.json and lib/generated/propensity.json
(the app reads both; nothing else is needed at runtime).
"""
import json
import math
import os
import sys

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "lib", "generated")
os.makedirs(OUT, exist_ok=True)

d = pd.read_csv(os.path.join(ROOT, "data", "smb_leads.csv"))
d["act"] = (d.outcome == "Activated").astype(int)
acts = d[d.act == 1].copy()

STAGES = ["Lead", "Contacted", "Needs assessed", "Quote accepted", "KYC complete", "Activated"]
order = {s: i for i, s in enumerate(STAGES)}
d["stage_idx"] = d.stage_reached.map(order)


def pct(x):
    return round(float(x) * 100, 1)


def rate_by(col):
    g = d.groupby(col).act.agg(["mean", "size", "sum"]).reset_index()
    g = g.sort_values("mean", ascending=False)
    return [
        {"key": str(r[col]), "rate": pct(r["mean"]), "leads": int(r["size"]), "activated": int(r["sum"])}
        for _, r in g.iterrows()
    ]


funnel = []
for i, s in enumerate(STAGES):
    n = int((d.stage_idx >= i).sum())
    funnel.append({"stage": s, "count": n})
for i in range(1, len(funnel)):
    funnel[i]["pctPrev"] = pct(funnel[i]["count"] / funnel[i - 1]["count"])

drops = (
    d[d.drop_reason.notna()]
    .groupby(["stage_reached", "drop_reason"])
    .size()
    .reset_index(name="n")
    .sort_values("n", ascending=False)
)
FIXABLE = {
    "Owner had no time for a visit": "advisor",
    "Visit not scheduled by sales": "advisor",
    "Quote too complex to understand": "quote",
    "Quote took too long to arrive": "quote",
    "Found paperwork too long": "kyc",
    "Missing GST or Udyam document": "kyc",
    "Document details did not match": "kyc",
    "Authorised signatory not available": "kyc",
    "Installation delayed beyond 21 days": "tracker",
    "Customer cancelled before install": "tracker",
    "Site not feasible for fibre": "advisor",
    "Unreachable after 3 attempts": "advisor",
}
drop_rows = [
    {"stage": r.stage_reached, "reason": r.drop_reason, "n": int(r.n), "fixedBy": FIXABLE.get(r.drop_reason)}
    for r in drops.itertuples()
]

seg = []
for s, g in acts.groupby("segment"):
    all_s = d[d.segment == s]
    seg.append(
        {
            "segment": s,
            "leads": int(len(all_s)),
            "activated": int(len(g)),
            "rate": pct(len(g) / len(all_s)),
            "medianMRR": int(g.monthly_bundle_value_inr.median()),
            "meanMRR": int(g.monthly_bundle_value_inr.mean()),
            "daysToActivate": round(float(g.days_lead_to_activation.mean()), 1),
            "churn6m": pct((g.churned_within_6_months == "Y").mean()),
            "nps": round(float(g.nps_score.mean()), 1),
            "cac": int(all_s.acquisition_cost_inr.sum() / max(len(g), 1)),
        }
    )

src = []
for s, g in d.groupby("lead_source"):
    a = int(g.act.sum())
    src.append(
        {
            "source": s,
            "leads": int(len(g)),
            "activated": a,
            "rate": pct(a / len(g)),
            "cac": int(g.acquisition_cost_inr.sum() / max(a, 1)),
        }
    )
src.sort(key=lambda r: r["cac"])

calls = [
    {
        "calls": int(k),
        "n": int(len(g)),
        "churn6m": pct((g.churned_within_6_months == "Y").mean()),
        "nps": round(float(g.nps_score.mean()), 1),
    }
    for k, g in acts.groupby("customer_follow_up_calls")
]

acts["dbin"] = pd.cut(acts.days_lead_to_activation, [0, 14, 18, 22, 60], labels=["≤14", "15–18", "19–22", "23+"])
days = [
    {"bucket": str(k), "n": int(len(g)), "nps": round(float(g.nps_score.mean()), 1), "churn6m": pct((g.churned_within_6_months == "Y").mean())}
    for k, g in acts.groupby("dbin", observed=True)
]

# Top products bought per segment
top_products = {}
for s, g in acts.groupby("segment"):
    counts = {}
    for b in g.bundle_products.dropna():
        for part in b.split(";"):
            pid = part.split("x")[0]
            counts[pid] = counts.get(pid, 0) + 1
    top = sorted(counts.items(), key=lambda kv: -kv[1])[:6]
    top_products[s] = [{"product": p, "share": pct(c / len(g))} for p, c in top]

# Language x channel (vernacular signal)
d["lang_group"] = np.where(d.preferred_language.isin(["English", "Hindi"]), "English/Hindi", "Regional")
lang_channel = [
    {"source": s, "langGroup": l, "rate": pct(g.act.mean()), "leads": int(len(g))}
    for (s, l), g in d.groupby(["lead_source", "lang_group"])
]

headline = {
    "leads": int(len(d)),
    "activated": int(d.act.sum()),
    "activationRate": pct(d.act.mean()),
    "avgDaysToActivate": round(float(acts.days_lead_to_activation.mean()), 1),
    "avgFollowUpCalls": round(float(acts.customer_follow_up_calls.mean()), 1),
    "blendedCAC": int(d.acquisition_cost_inr.sum() / d.act.sum()),
    "gstinRate": pct(d[d.has_gstin == "Y"].act.mean()),
    "noGstinRate": pct(d[d.has_gstin == "N"].act.mean()),
    "medianMRR": int(acts.monthly_bundle_value_inr.median()),
    "churn6m": pct((acts.churned_within_6_months == "Y").mean()),
    "nps": round(float(acts.nps_score.mean()), 1),
}

insights = {
    "headline": headline,
    "funnel": funnel,
    "drops": drop_rows,
    "segments": seg,
    "sources": src,
    "followUpCalls": calls,
    "daysToActivate": days,
    "topProducts": top_products,
    "langChannel": lang_channel,
    "byLanguage": rate_by("preferred_language"),
    "byTurnover": rate_by("annual_turnover_band"),
    "byInternet": rate_by("current_internet"),
    "byProvider": rate_by("current_provider"),
    "byTier": rate_by("city_tier"),
    "byUdyam": rate_by("has_udyam"),
}

# ---------------- Propensity model (features known at lead time only) ----------------
CATS = [
    "lead_source",
    "segment",
    "preferred_language",
    "annual_turnover_band",
    "current_internet",
    "current_provider",
    "contact_role",
]
d["log_emp"] = np.log1p(d.employee_count)
d["log_sites"] = np.log1p(d.num_sites)
d["log_spend"] = np.log1p(d.monthly_telecom_spend_inr.fillna(0))
d["tier1"] = (d.city_tier == 1).astype(int)
d["gstin"] = (d.has_gstin == "Y").astype(int)
d["udyam"] = (d.has_udyam == "Y").astype(int)
d["n_interest"] = d.products_of_interest.fillna("").apply(lambda s: len([x for x in s.split(";") if x]))
NUMS = ["log_emp", "log_sites", "log_spend", "tier1", "gstin", "udyam", "n_interest"]

X_cat = pd.get_dummies(d[CATS].astype(str), prefix_sep="=", dtype=float)
means = d[NUMS].mean()
stds = d[NUMS].std().replace(0, 1)
X_num = (d[NUMS] - means) / stds
X = pd.concat([X_num, X_cat], axis=1)
y = d.act.values

aucs = []
for tr, te in StratifiedKFold(5, shuffle=True, random_state=7).split(X, y):
    m = LogisticRegression(C=0.5, max_iter=2000, class_weight="balanced").fit(X.iloc[tr], y[tr])
    aucs.append(roc_auc_score(y[te], m.predict_proba(X.iloc[te])[:, 1]))
model = LogisticRegression(C=0.5, max_iter=2000, class_weight="balanced").fit(X, y)

# Calibrate raw (balanced) scores back to real conversion odds with a prior shift
prior = y.mean()
shift = math.log(prior / (1 - prior))  # balanced weights assume 50/50

coef = dict(zip(X.columns, model.coef_[0].round(4).tolist()))
propensity = {
    "intercept": round(float(model.intercept_[0]) + shift, 4),
    "numeric": {k: {"mean": round(float(means[k]), 4), "std": round(float(stds[k]), 4), "w": coef[k]} for k in NUMS},
    "categorical": {c: {col.split("=", 1)[1]: coef[col] for col in X.columns if col.startswith(c + "=")} for c in CATS},
    "cvAUC": round(float(np.mean(aucs)), 3),
    "baseRate": round(float(prior), 4),
    "trainedOn": "smb_leads.csv (5,000 leads, Apr–Jun 2026)",
}

# Top drivers for the deck / UI
drivers = sorted(coef.items(), key=lambda kv: -abs(kv[1]))[:12]
propensity["topDrivers"] = [{"feature": k, "weight": v} for k, v in drivers]

# Score every dropped lead (for the back office "call list")
raw = model.decision_function(X) + shift
d["score"] = 1 / (1 + np.exp(-raw))
dropped = d[(d.act == 0)].copy()
callable_reasons = {
    "Owner had no time for a visit",
    "Visit not scheduled by sales",
    "Quote too complex to understand",
    "Quote took too long to arrive",
    "Found paperwork too long",
    "Missing GST or Udyam document",
    "Document details did not match",
    "Authorised signatory not available",
    "Decided to wait",
    "Price too high",
    "Installation delayed beyond 21 days",
    "Site not feasible for fibre",
    "Customer cancelled before install",
    "First payment failed",
}
dropped = dropped[dropped.drop_reason.isin(callable_reasons)].sort_values("score", ascending=False).head(400)
call_list = [
    {
        "id": r.lead_id,
        "name": r.business_name,
        "type": r.business_type,
        "segment": r.segment,
        "city": r.city,
        "tier": int(r.city_tier),
        "language": r.preferred_language,
        "employees": int(r.employee_count),
        "sites": int(r.num_sites),
        "source": r.lead_source,
        "stage": r.stage_reached,
        "reason": r.drop_reason,
        "gstin": r.has_gstin == "Y",
        "spend": int(r.monthly_telecom_spend_inr) if not pd.isna(r.monthly_telecom_spend_inr) else 0,
        "interest": r.products_of_interest if isinstance(r.products_of_interest, str) else "",
        "contact": r.contact_name,
        "role": r.contact_role,
        "score": round(float(r.score), 3),
    }
    for r in dropped.itertuples()
]

with open(os.path.join(OUT, "insights.json"), "w") as f:
    json.dump(insights, f, ensure_ascii=False, indent=1)
with open(os.path.join(OUT, "propensity.json"), "w") as f:
    json.dump(propensity, f, ensure_ascii=False, indent=1)
with open(os.path.join(OUT, "call_list.json"), "w") as f:
    json.dump(call_list, f, ensure_ascii=False)

print("cv AUC", propensity["cvAUC"], "| call list", len(call_list))
print("top drivers", propensity["topDrivers"][:8])
sys.exit(0)
