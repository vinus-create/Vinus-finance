import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { getServerTranslations } from '@/lib/i18n/server'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import PushNotificationManager from '@/components/PushNotificationManager'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Vinus Finance',
  description: 'Malaysian Personal Finance & Wallet — Zero-Friction Automation',
  applicationName: 'Vinus Finance',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vinus Finance',
  },
  manifest: '/manifest.json',
  icons: {
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#10b981',
  interactiveWidget: 'resizes-content',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { t, lang } = await getServerTranslations()

  return (
    <html lang={lang} className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <LanguageProvider initialLang={lang} initialT={t}>
          <PushNotificationManager />
          {children}
        </LanguageProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
