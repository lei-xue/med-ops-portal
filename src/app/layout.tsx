import type { Metadata } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";

import Header from "@/components/Header";

import "./globals.css";

const grotesk = Schibsted_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "MedOps Portal",
    template: "%s · MedOps Portal",
  },
  description:
    "Medication operations portal demo — order workflow, inventory and audit trails. All data fictional.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${grotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-ink-3 sm:px-6">
          <span className="label-mono">MedOps Portal · demo build</span>
          <span className="label-mono">
            No PHI · no real patients · no dosing advice
          </span>
        </footer>
      </body>
    </html>
  );
}
