import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import { StoreProvider } from '../store'
import '../styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider>
      <div className={inter.variable}>
        <Component {...pageProps} />
      </div>
    </StoreProvider>
  )
}
