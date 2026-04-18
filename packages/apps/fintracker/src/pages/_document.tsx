import Document, { DocumentContext, DocumentProps, Head, Html, Main, NextScript } from 'next/document'
import type { ClientAuthEnv } from '../clientAuthEnv'

type Props = DocumentProps & { authEnv: ClientAuthEnv }

export default class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx)
    // Auth snapshot from process.env (populated by next.config → resolve-google-env at build/dev startup).
    const authEnv: ClientAuthEnv = {
      googleClientId: String(
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
          process.env.VITE_GOOGLE_CLIENT_ID ||
          process.env.GOOGLE_CLIENT_ID ||
          '',
      ).trim(),
      appPassword: (process.env.NEXT_PUBLIC_APP_PASSWORD || process.env.VITE_APP_PASSWORD || '').trim() || '1234',
      allowedEmailsRaw: String(
        process.env.NEXT_PUBLIC_ALLOWED_EMAILS || process.env.VITE_ALLOWED_EMAILS || process.env.ALLOWED_EMAILS || '',
      ),
    }
    return { ...initialProps, authEnv }
  }

  render() {
    const payload = JSON.stringify(this.props.authEnv).replace(/</g, '\\u003c')
    return (
      <Html lang="en" className="with-app-shell">
        <Head>
          <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;600&display=swap" rel="stylesheet" />
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
