import { launchLogScript } from '@fintracker-vault/ui'
import Document, { DocumentContext, DocumentProps, Head, Html, Main, NextScript } from 'next/document'
import type { ClientAuthEnv } from '../clientAuthEnv'

type Props = DocumentProps & { authEnv: ClientAuthEnv }

export default class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx)
    const authEnv: ClientAuthEnv = {
      googleClientId: String(
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
          process.env.VITE_GOOGLE_CLIENT_ID ||
          process.env.GOOGLE_CLIENT_ID ||
          '',
      ).trim(),
    }
    return { ...initialProps, authEnv }
  }

  render() {
    const safeAuthEnv = this.props.authEnv
    const payload = JSON.stringify(safeAuthEnv).replace(/</g, '\\u003c')
    return (
      <Html lang="en" className="with-app-shell">
        <Head>
          {/* First thing on the page: records each launch step so a hang can be diagnosed. */}
          <script dangerouslySetInnerHTML={{ __html: launchLogScript('fintracker') }} />
          <link rel="manifest" href="/manifest.json" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
          <meta name="color-scheme" content="light" />
          <meta name="theme-color" content="#FFFFFF" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="FinTracker" />
        </Head>
        <body className="with-app-shell">
          <script dangerouslySetInnerHTML={{ __html: `window.__FT_AUTH_ENV=${payload}` }} />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
