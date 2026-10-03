import type { Metadata, Viewport } from "next";
import { Gloock, Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const display = Gloock({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-body", display: "swap" });
const ui = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  title: "Divyanshu Choudhury · Systems & DevOps engineer",
  description:
    "Systems and DevOps engineer and open-source contributor from Jabalpur. Linux, containers, Kubernetes, CI/CD and observability.",
  openGraph: {
    title: "Divyanshu Choudhury · Systems & DevOps engineer",
    description: "Computer science student and open-source contributor, interested in DevOps, distributed systems and backend infrastructure.",
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
