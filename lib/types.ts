export type Lang = "en" | "hi" | "mr";
export type Segment = "micro" | "prof" | "multi" | "mfg";

export type Need =
  | "payments"
  | "whatsapp"
  | "email"
  | "backup"
  | "cctv"
  | "calls"
  | "tollfree"
  | "website"
  | "security"
  | "wifi"
  | "machines"
  | "fleet"
  | "uptime"
  | "sms"
  | "remote";

export type InternetNow = "hotspot" | "home" | "business" | "leased" | "mixed" | "none";
export type GstStatus = "Active" | "Cancelled" | "Suspended" | "NotFound" | "Invalid";

export interface Profile {
  businessType?: string; // key of BUSINESS_TYPES
  segment?: Segment;
  employees?: number;
  sites?: number;
  city?: string;
  tier?: 1 | 2;
  internet?: InternetNow;
  noFibre?: boolean;
  needs: Need[];
  needsAnswered?: boolean;
  hasGstin?: boolean;
  gstin?: string;
  gstStatus?: GstStatus;
  businessName?: string;
  spend?: number;
  vehicles?: number;
  cameras?: number;
}

export interface Product {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  priceMin: number;
  priceMax: number;
  setup: number;
  minContract: number;
  tiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGstin: boolean;
  requiresOneOf: string[];
  installDays: number;
  segments: string[];
}

export interface BundleLine {
  id: string;
  qty: number;
  on: boolean; // toggled into the quote
  core: boolean; // recommended as part of the base bundle
  reason: string; // i18n key for "why"
  need?: Need;
  lockedBy?: string[]; // other line ids that depend on this one
}

export interface Blocked {
  id: string;
  reason: string; // i18n key
  params?: Record<string, string | number>;
  alt?: string; // alternative product id included instead
}

export interface Recommendation {
  lines: BundleLine[];
  blocked: Blocked[];
  segment: Segment;
}

export interface PricedLine extends BundleLine {
  unitPrice: number;
  monthly: number;
  setupTotal: number;
}

export interface Quote {
  lines: PricedLine[];
  contract: number;
  monthly: number;
  setup: number;
  gst: number;
  monthlyWithGst: number;
  maxInstallDays: number;
}
