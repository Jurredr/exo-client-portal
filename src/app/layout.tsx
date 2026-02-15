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

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://portal.exo.black");

const seoTitle =
  "EXO Client Portal – Access Your Projects, Deliverables & Documents";
const seoDescription =
  "Access your EXO projects, deliverables, and documents in one place. The client portal keeps you informed and in control of your project progress.";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: seoTitle,
  description: seoDescription,
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
    apple: "/exo.svg",
  },
  openGraph: {
    type: "website",
    url: baseUrl,
    siteName: "EXO Client Portal",
    title: seoTitle,
    description: seoDescription,
    images: [
      {
        url: "/seo.jpg",
        width: 1200,
        height: 675,
        alt: "EXO - Digital Experiences don't have to be boring.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seoTitle,
    description: seoDescription,
    images: ["/seo.jpg"],
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
