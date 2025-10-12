import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { Toaster } from 'sonner';
import { VoiceManagerProvider } from '@/lib/contexts/voice-manager-context';

export const metadata: Metadata = {
  title: 'ENDOFLOW - Dental Clinic Management',
  description: 'AI-powered SaaS application for dental clinics that automates workflows and improves patient care.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { url: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }
    ],
    apple: '/favicon.svg'
  }
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ subsets: ['latin'] });

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-gray-50">
        <VoiceManagerProvider>
          {children}
          <Toaster position="top-right" />
        </VoiceManagerProvider>
      </body>
    </html>
  );
}
