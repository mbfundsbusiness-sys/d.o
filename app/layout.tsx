import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/provider';
import { SiteBackdrop } from '@/components/site-backdrop';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dedication Optimiser',
  description: 'Your personal life operating system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <SiteBackdrop />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
