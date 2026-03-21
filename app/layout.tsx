import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TPV MONY MONY',
  description: '',
  icons: {
    icon: '/logos/ICONO_CORPORATIVO.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{height:'100vh',overflow:'hidden'}}>{children}</body>
    </html>
  )
}