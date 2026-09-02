import type { Metadata, Viewport } from 'next'
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

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
          <header className="shrink-0 flex justify-between items-center px-4 py-2.5 sm:py-3.5 sm:px-6 border-b border-stone-200/40 dark:border-stone-900/40 bg-white/70 dark:bg-black/70 backdrop-blur-md z-40">
            <h1 className="text-sm sm:text-lg uppercase tracking-[0.18em] sm:tracking-[0.25em] text-[#8f6d3d] dark:text-[#c4a06d] font-semibold shrink-0">
              Backstage Chat.me
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <Show when="signed-out">
                <SignInButton>
                  <button className="border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-full font-medium text-xs sm:text-sm h-9 sm:h-10 px-3.5 sm:px-4 cursor-pointer whitespace-nowrap">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="bg-[#8f6d3d] hover:bg-[#7a5c32] text-white rounded-full font-medium text-xs sm:text-sm h-9 sm:h-10 px-3.5 sm:px-4 transition-all duration-200 active:scale-95 cursor-pointer shadow-sm hover:shadow-md whitespace-nowrap">
                    Sign Up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}