import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/provider';
import { BACKDROP_INIT_SCRIPT } from '@/lib/backdrop';

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: BACKDROP_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
