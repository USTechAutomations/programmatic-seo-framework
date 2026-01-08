import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'US Tech Automations - AI Automation for Business Growth',
    template: '%s | US Tech Automations',
  },
  description: 'Expert AI automation solutions for real estate professionals and businesses. Lead nurturing, content generation, and intelligent automation systems.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ustechautomations.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'US Tech Automations',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="border-b">
          <nav className="max-w-6xl mx-auto px-4 py-4">
            <a href="/" className="text-xl font-bold text-blue-600">
              US Tech Automations
            </a>
          </nav>
        </header>
        {children}
        <footer className="border-t mt-16 py-8 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} US Tech Automations. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
