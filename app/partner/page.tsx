import type { Metadata } from "next";
import { Partner } from "@/components/partner";

export const metadata: Metadata = { title: "Accel Business — partner console" };

export default function PartnerPage() {
  return <Partner />;
}
