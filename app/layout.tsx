import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portfolio Risk & Diversification Engine",
  description:
    "Motore quantitativo di analisi del rischio di portafoglio basato su Modern Portfolio Theory, correlazione di Pearson, Diversification Ratio e indice HHI.",
  keywords: [
    "Modern Portfolio Theory",
    "portfolio risk",
    "diversification",
    "HHI",
    "correlation matrix",
    "quantitative finance",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="dark">
      <body
        className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
