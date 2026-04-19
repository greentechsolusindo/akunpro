import '../styles/globals.css'

export const metadata = {
  title: 'AkunPro',
  description: 'Aplikasi Akuntansi',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
