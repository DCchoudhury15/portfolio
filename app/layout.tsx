import type { Metadata, Viewport } from "next";
import { Gloock, Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const display = Gloock({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-body", display: "swap" });
const ui = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  title: "Divyanshu Choudhury · Systems engineer",
  description:
    "Systems engineer from Jabalpur. Guardrails for AI agents, telemetry pipelines, package managers and HPC build tooling. Code merged into CPython, OpenTelemetry, Jaeger and conda.",
  openGraph: {
    title: "Divyanshu Choudhury · Systems engineer",
    description: "I build the plumbing other engineers stand on.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0a0d",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
