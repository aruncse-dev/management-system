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
      appPassword: (process.env.NEXT_PUBLIC_APP_PASSWORD || process.env.VITE_APP_PASSWORD || '').trim(),
      allowedEmailsRaw: String(
        process.env.NEXT_PUBLIC_ALLOWED_EMAILS || process.env.VITE_ALLOWED_EMAILS || process.env.ALLOWED_EMAILS || '',
      ),
    }
    return { ...initialProps, authEnv }
  }

  render() {
    const { appPassword: _unused, ...safeAuthEnv } = this.props.authEnv
    const payload = JSON.stringify(safeAuthEnv).replace(/</g, '\\u003c')
    return (
      <Html lang="en" className="with-app-shell">
        <Head>
          <link rel="manifest" href="/manifest.json" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="theme-color" content="#1E5CC7" />
          <link
            href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;600&display=swap"
            rel="stylesheet"
          />
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
