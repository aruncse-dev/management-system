import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { getAppDisplayName, getAppManifestUrl, resolveAppArea } from './appPaths'

function bootstrapBranding() {
  const area = resolveAppArea()
  const manifest = document.querySelector<HTMLLinkElement>("link[rel='manifest']")
  if (manifest) manifest.href = getAppManifestUrl(area)
  const title = getAppDisplayName(area)
  document.title = title
  const appleTitle = document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']")
  if (appleTitle) appleTitle.content = title
  const themeColor = document.querySelector<HTMLMetaElement>("meta[name='theme-color']")
  if (themeColor) themeColor.content = '#1E5CC7'
  const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (icon) icon.href = area === 'vault' ? '/vault-192.png' : '/icon-192.png'
}

bootstrapBranding()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
