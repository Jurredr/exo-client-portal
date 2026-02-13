import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ReactQueryProvider } from "@/lib/react-query";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const perfectlyNineties = localFont({
  src: [
    {
      path: "../../public/font/perfectly-nineties/perfectly-nineties-regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/font/perfectly-nineties/perfectly-nineties-semibold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/font/perfectly-nineties/perfectly-nineties-bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-perfectly-nineties",
});

export const metadata: Metadata = {
  title: "EXO Client Portal",
  description: "Client portal for EXO projects",
  icons: {
    icon: [
      {
        url: "/exo.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/exo-white.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${perfectlyNineties.variable} antialiased`}
      >
        <ReactQueryProvider>
          {children}
          <Toaster />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
