type GoogleTagArguments = [command: string, ...values: unknown[]]

declare global {
  interface Window {
    dataLayer?: GoogleTagArguments[]
    gtag?: (...args: GoogleTagArguments) => void
  }
}

const googleTagId = import.meta.env.VITE_GOOGLE_TAG_ID?.trim()

export const initializeGoogleTag = () => {
  if (!googleTagId) return
  if (document.querySelector(`[data-google-tag-id="${googleTagId}"]`)) return

  window.dataLayer = window.dataLayer ?? []
  window.gtag = (...args: GoogleTagArguments) => {
    window.dataLayer?.push(args)
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    googleTagId,
  )}`
  script.dataset.googleTagId = googleTagId
  document.head.appendChild(script)

  window.gtag('js', new Date())
  window.gtag('config', googleTagId)
}
