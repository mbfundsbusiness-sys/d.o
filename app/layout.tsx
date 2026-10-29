import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'D.O.',
  description: 'Your EA, schedule and money, in one chat',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
