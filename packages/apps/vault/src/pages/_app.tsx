import type { AppProps } from 'next/app'
import { StoreProvider } from '../store'
import VaultNav from '../components/VaultNav'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider>
      <div className="with-app-shell">
        <VaultNav />
        <Component {...pageProps} />
      </div>
    </StoreProvider>
  )
}
