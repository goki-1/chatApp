import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { InAppBrowserNotice } from '@/components/InAppBrowserNotice'
import { InAppBrowserProvider } from '@/context/InAppBrowserContext'
import { HeaderAuth } from '@/components/HeaderAuth'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'BackstageChat.me',
  description: 'Chat anything fun',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full overscroll-none">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden overscroll-none`}>
        <ClerkProvider>
          <InAppBrowserProvider>
            <InAppBrowserNotice />
            <header className="shrink-0 flex justify-between items-center px-4 py-2.5 sm:py-3.5 sm:px-6 border-b border-stone-200/40 dark:border-stone-900/40 bg-white/70 dark:bg-black/70 backdrop-blur-md z-40">
              <h1 className="text-sm sm:text-lg uppercase tracking-[0.18em] sm:tracking-[0.25em] text-[#8f6d3d] dark:text-[#c4a06d] font-semibold shrink-0">
                Backstage Chat.me
              </h1>
              <HeaderAuth />
            </header>
            {children}
          </InAppBrowserProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}