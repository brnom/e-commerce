import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import localFont from 'next/font/local'

export const display = localFont({
  src: [
    { path: '../fonts/ArchivoExpanded-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/ArchivoExpanded-Black.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
})

export const sans = GeistSans
export const mono = GeistMono

export const fontClassNames = [display.variable, sans.variable, mono.variable].join(' ')
