// ── QZ Tray integration for direct thermal printing ──────────────
// QZ Tray must be running on the local machine (qz.io)

declare global {
  interface Window {
    qz: any
  }
}

let qzLoaded = false

// Load QZ Tray script dynamically
export async function loadQZ(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (window.qz) return true
  if (qzLoaded) return !!window.qz

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js'
    script.onload = () => { qzLoaded = true; resolve(true) }
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

// Connect to QZ Tray websocket
export async function connectQZ(): Promise<boolean> {
  try {
    const loaded = await loadQZ()
    if (!loaded || !window.qz) return false
    if (window.qz.websocket.isActive()) return true

    // Disable certificate check for local use
    window.qz.security.setCertificatePromise(() => Promise.resolve())
    window.qz.security.setSignatureAlgorithm('SHA512')
    window.qz.security.setSignaturePromise(() => Promise.resolve())

    await window.qz.websocket.connect({ retries: 1, delay: 1 })
    return true
  } catch {
    return false
  }
}

// Get default printer or first available
export async function getDefaultPrinter(): Promise<string | null> {
  try {
    const connected = await connectQZ()
    if (!connected) return null
    const printer = await window.qz.printers.getDefault()
    return printer || null
  } catch {
    return null
  }
}

// Print ESC/POS ticket directly to thermal printer
export async function printThermal(ticketLines: string[]): Promise<boolean> {
  try {
    const connected = await connectQZ()
    if (!connected) return false

    const printer = await window.qz.printers.getDefault()
    if (!printer) return false

    const config = window.qz.configs.create(printer, {
      encoding: 'UTF-8',
      copies: 1,
    })

    // ESC/POS commands
    const ESC = '\x1B'
    const GS  = '\x1D'
    const NL  = '\n'

    const data = [
      { type: 'raw', format: 'plain', data:
        ESC + '@' +                    // Initialize printer
        ESC + 'a' + '\x01' +           // Center align
        ESC + 'E' + '\x01' +           // Bold on
        ticketLines[0] + NL +          // Business name
        ESC + 'E' + '\x00' +           // Bold off
        ticketLines.slice(1).join(NL) +
        NL + NL + NL +                 // Feed paper
        GS + 'V' + '\x41' + '\x03'    // Cut paper (partial)
      }
    ]

    await window.qz.print(config, data)
    return true
  } catch {
    return false
  }
}

// Check if QZ Tray is available and connected
export async function isQZAvailable(): Promise<boolean> {
  try {
    const loaded = await loadQZ()
    if (!loaded || !window.qz) return false
    if (window.qz.websocket.isActive()) return true
    window.qz.security.setCertificatePromise(() => Promise.resolve())
    window.qz.security.setSignaturePromise(() => Promise.resolve())
    await window.qz.websocket.connect({ retries: 1, delay: 1 })
    return window.qz.websocket.isActive()
  } catch {
    return false
  }
}
