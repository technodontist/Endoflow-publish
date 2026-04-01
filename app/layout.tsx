import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { Toaster } from 'sonner';
import { VoiceManagerProvider } from '@/lib/contexts/voice-manager-context';
import { ThemeProvider } from '@/lib/contexts/theme-context';
import { SidebarProvider } from '@/lib/contexts/sidebar-context';

export const metadata: Metadata = {
  title: 'ENDOFLOW - Dental Clinic Management',
  description: 'AI-powered SaaS application for dental clinics that automates workflows and improves patient care.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { url: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }
    ],
    apple: '/favicon.svg'
  },
  // Session 18: iOS PWA support
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EndoFlow',
  },
};

export const viewport: Viewport = {
  maximumScale: 1,
  // Session 18: iOS mobile optimization
  viewportFit: 'cover',
  userScalable: false,
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
      className={`dark ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-background text-foreground">
        <ThemeProvider>
          <VoiceManagerProvider>
            <SidebarProvider>
              {children}
              <Toaster position="top-right" />
            </SidebarProvider>
          </VoiceManagerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
