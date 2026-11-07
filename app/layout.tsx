import type { Metadata, Viewport } from "next";
import { Mukta, Plus_Jakarta_Sans } from "next/font/google";
import { Hydrate } from "@/components/hydrate";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const mukta = Mukta({ variable: "--font-mukta", subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Accel Business — get online in one sitting",
  description: "Discover the right bundle, verify your business and track activation — on your phone, in your language.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#e5232b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mukta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Hydrate />
        {children}
      </body>
    </html>
  );
}
