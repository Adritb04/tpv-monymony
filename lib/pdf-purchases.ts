// ── PDF generators for purchases, REBU and deposits ──────────────
// Opens a print window with the formatted document

const NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE    || 'MI TIENDA',
  nif:       process.env.NEXT_PUBLIC_NEGOCIO_NIF       || 'B00000000',
  direccion: process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION || 'Calle Mayor, 1',
  cp:        process.env.NEXT_PUBLIC_NEGOCIO_CP        || '28001',
  localidad: process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD || 'Madrid',
  telefono:  process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO  || '',
  email:     process.env.NEXT_PUBLIC_NEGOCIO_EMAIL     || '',
}

const fmtN = (n: number) => (n || 0).toFixed(2).replace('.', ',')

function printDoc(title: string, html: string) {
  const w = window.open('', '_blank', 'width=800,height=900')!
  w.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 30px; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #000; }
      .header-left { }
      .header-right { text-align: right; font-size: 11px; color: #555; }
      .ref { font-size: 20px; font-weight: 700; color: #1a1a2e; }
      .doc-type { font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
      .field { margin-bottom: 8px; }
      .field-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #888; margin-bottom: 2px; }
      .field-value { font-size: 13px; font-weight: 500; }
      .field-value.mono { font-family: 'Courier New', monospace; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #f5f5f5; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; border: 1px solid #ddd; }
      td { padding: 7px 8px; border: 1px solid #eee; font-size: 11px; }
      tr:nth-child(even) td { background: #fafafa; }
      .total-row td { font-weight: 700; background: #f0f0f0; border-top: 2px solid #999; }
      .box { border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 14px; }
      .box.warn { border-color: #f59f00; background: #fffbeb; }
      .box.info { border-color: #4dabf7; background: #e7f5ff; }
      .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
      .sign-box { border: 1px solid #999; border-radius: 4px; padding: 8px 16px; min-height: 60px; text-align: center; }
      .sign-label { font-size: 9px; color: #888; margin-bottom: 4px; }
      .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
      .badge-green { background: #d3f9d8; color: #2b8a3e; }
      .badge-blue  { background: #d0ebff; color: #1864ab; }
      .badge-amber { background: #fff3bf; color: #e67700; }
      .badge-red   { background: #ffe3e3; color: #c92a2a; }
      @media print { body { padding: 15px; } }
    </style>
  </head><body>${html}</body></html>`)
  w.document.close()
  setTimeout(() => { w.print() }, 500)
}

// ── 1. FACTURA DE COMPRA (artículos nuevos) ──────────────────────
export function printPurchasePDF(purchase: any, items: any[]) {
  const totalCost = items.reduce((a: number, b: any) => a + b.unit_cost * b.qty, 0)
  const itemRows  = items.map((i: any) => `
    <tr>
      <td>${i.emoji || '📦'} ${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">${fmtN(i.unit_cost)} €</td>
      <td style="text-align:right">${fmtN(i.unit_cost * i.qty)} €</td>
      <td style="text-align:center">${i.iva_rate}%</td>
      <td style="text-align:right">${fmtN(i.sale_price)} €</td>
    </tr>`).join('')

  printDoc(`Compra ${purchase.ref}`, `
    <div class="header">
      <div class="header-left">
        <div class="doc-type">Registro de Compra con Factura</div>
        <div class="ref">${purchase.ref}</div>
        <div style="font-size:11px;color:#555;margin-top:4px">${purchase.created_at ? new Date(purchase.created_at).toLocaleString('es-ES') : ''}</div>
      </div>
      <div class="header-right">
        <div style="font-weight:700;font-size:14px">${NEGOCIO.nombre}</div>
        <div>NIF: ${NEGOCIO.nif}</div>
        <div>${NEGOCIO.direccion}</div>
        <div>${NEGOCIO.cp} ${NEGOCIO.localidad}</div>
        <div>${NEGOCIO.telefono}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <h2 style="margin-top:0;border:none;font-size:11px;color:#888;text-transform:uppercase">Proveedor</h2>
        <div class="field"><div class="field-label">Nombre / Razón Social</div><div class="field-value">${purchase.supplier_name}</div></div>
        <div class="field"><div class="field-label">NIF / CIF</div><div class="field-value mono">${purchase.supplier_nif}</div></div>
      </div>
      <div class="box">
        <h2 style="margin-top:0;border:none;font-size:11px;color:#888;text-transform:uppercase">Factura del Proveedor</h2>
        <div class="field"><div class="field-label">Nº Factura</div><div class="field-value mono">${purchase.supplier_invoice}</div></div>
        <div class="field"><div class="field-label">Fecha Factura</div><div class="field-value">${purchase.invoice_date}</div></div>
        <div class="field"><div class="field-label">Importe Total Factura</div><div class="field-value mono" style="font-size:16px;color:#1a1a2e">${fmtN(purchase.invoice_total)} €</div></div>
      </div>
    </div>

    <h2>Artículos registrados (${items.length})</h2>
    <table>
      <thead><tr><th>Artículo</th><th>Uds.</th><th>Coste unit.</th><th>Coste total</th><th>IVA</th><th>P. Venta</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tr class="total-row">
        <td colspan="3">TOTAL COSTE</td>
        <td style="text-align:right">${fmtN(totalCost)} €</td>
        <td colspan="2"></td>
      </tr>
    </table>

    ${purchase.notes ? `<div class="box" style="margin-top:14px"><div class="field-label">Observaciones</div><div>${purchase.notes}</div></div>` : ''}

    <div class="signs">
      <div><div class="sign-label">Registrado por</div><div class="sign-box">${purchase.created_by_name}</div></div>
      <div><div class="sign-label">Sello / Firma responsable</div><div class="sign-box"></div></div>
    </div>

    <div class="footer">
      <span>Documento interno · ${NEGOCIO.nombre} · NIF ${NEGOCIO.nif}</span>
      <span>TPV-Legal-ES · ${new Date().toLocaleDateString('es-ES')}</span>
    </div>`)
}

// ── 2. DOCUMENTO DE COMPRA REBU ──────────────────────────────────
export function printRebuPDF(purchase: any) {
  printDoc(`Compra REBU ${purchase.ref}`, `
    <div class="header">
      <div class="header-left">
        <div class="doc-type">Documento de Compra — Régimen Especial Bienes Usados (REBU)</div>
        <div class="ref">${purchase.ref}</div>
        <div style="font-size:11px;color:#555;margin-top:4px">${purchase.created_at ? new Date(purchase.created_at).toLocaleString('es-ES') : ''}</div>
      </div>
      <div class="header-right">
        <div style="font-weight:700;font-size:14px">${NEGOCIO.nombre}</div>
        <div>NIF: ${NEGOCIO.nif}</div>
        <div>${NEGOCIO.direccion}</div>
        <div>${NEGOCIO.cp} ${NEGOCIO.localidad}</div>
      </div>
    </div>

    <div class="box info" style="margin-bottom:16px">
      <strong>Base legal:</strong> Este documento acredita la compra de un bien usado a un particular conforme al
      Régimen Especial de Bienes Usados (Arts. 135-139 LIVA). El IVA se calculará sobre el margen de beneficio.
      El vendedor declara ser el legítimo propietario del artículo.
    </div>

    <div class="grid2">
      <div class="box">
        <h2 style="margin-top:0;border:none;font-size:11px;color:#888;text-transform:uppercase">Vendedor (Particular)</h2>
        <div class="field"><div class="field-label">Nombre completo</div><div class="field-value">${purchase.seller_name}</div></div>
        <div class="field"><div class="field-label">DNI / NIE</div><div class="field-value mono" style="font-size:15px">${purchase.seller_dni}</div></div>
        ${purchase.seller_address ? `<div class="field"><div class="field-label">Dirección</div><div class="field-value">${purchase.seller_address}</div></div>` : ''}
        ${purchase.seller_phone ? `<div class="field"><div class="field-label">Teléfono</div><div class="field-value">${purchase.seller_phone}</div></div>` : ''}
      </div>
      <div class="box">
        <h2 style="margin-top:0;border:none;font-size:11px;color:#888;text-transform:uppercase">Artículo Comprado</h2>
        <div class="field"><div class="field-label">Descripción</div><div class="field-value">${purchase.description}</div></div>
        <div class="field"><div class="field-label">Precio de compra</div><div class="field-value mono" style="font-size:18px;color:#1a1a2e">${fmtN(purchase.buy_price)} €</div></div>
        <div class="field"><div class="field-label">Precio de venta previsto</div><div class="field-value mono">${fmtN(purchase.sale_price)} €</div></div>
      </div>
    </div>

    ${purchase.notes ? `<div class="box"><div class="field-label">Observaciones</div><div>${purchase.notes}</div></div>` : ''}

    <div class="box warn" style="margin-top:14px;font-size:11px">
      <strong>Declaración del vendedor:</strong> El abajo firmante declara ser el legítimo propietario del artículo descrito,
      que no está sujeto a ninguna carga o gravamen, y que no proviene de actividad delictiva. Autoriza su reventa
      por parte de ${NEGOCIO.nombre}.
    </div>

    <div class="signs">
      <div>
        <div class="sign-label">Firma del vendedor (DNI: ${purchase.seller_dni})</div>
        <div class="sign-box" style="min-height:80px"></div>
        <div style="font-size:10px;color:#888;margin-top:4px;text-align:center">${purchase.seller_name}</div>
      </div>
      <div>
        <div class="sign-label">Firma del comprador / Sello tienda</div>
        <div class="sign-box" style="min-height:80px"></div>
        <div style="font-size:10px;color:#888;margin-top:4px;text-align:center">${NEGOCIO.nombre} · NIF ${NEGOCIO.nif}</div>
      </div>
    </div>

    <div class="footer">
      <span>Documento REBU obligatorio · Conservar mínimo 4 años (LGT Art. 66-68)</span>
      <span>TPV-Legal-ES · ${new Date().toLocaleDateString('es-ES')}</span>
    </div>`)
}

// ── 3. DOCUMENTO DE EMPEÑO / DEPÓSITO ───────────────────────────
export function printDepositPDF(deposit: any) {
  const isEmpeno = deposit.deposit_type === 'empeno'
  const commission = (deposit.agreed_price * deposit.commission_pct / 100).toFixed(2).replace('.', ',')
  const clientReceives = (deposit.agreed_price * (1 - deposit.commission_pct / 100)).toFixed(2).replace('.', ',')

  printDoc(`${isEmpeno ? 'Empeño' : 'Depósito'} ${deposit.ref}`, `
    <div class="header">
      <div class="header-left">
        <div class="doc-type">${isEmpeno ? 'Contrato de Empeño' : 'Contrato de Depósito en Venta'}</div>
        <div class="ref">${deposit.ref}</div>
        <div style="font-size:11px;color:#555;margin-top:4px">Entrada: ${deposit.entry_date} · Caducidad: ${deposit.expiry_date}</div>
      </div>
      <div class="header-right">
        <div style="font-weight:700;font-size:14px">${NEGOCIO.nombre}</div>
        <div>NIF: ${NEGOCIO.nif}</div>
        <div>${NEGOCIO.direccion}</div>
        <div>${NEGOCIO.cp} ${NEGOCIO.localidad}</div>
        <div>${NEGOCIO.telefono}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <h2 style="margin-top:0;border:none;font-size:11px;color:#888;text-transform:uppercase">Cliente / Depositante</h2>
        <div class="field"><div class="field-label">Nombre completo</div><div class="field-value">${deposit.client_name}</div></div>
        <div class="field"><div class="field-label">DNI / NIE</div><div class="field-value mono" style="font-size:15px">${deposit.client_dni}</div></div>
        ${deposit.client_phone ? `<div class="field"><div class="field-label">Teléfono</div><div class="field-value">${deposit.client_phone}</div></div>` : ''}
        ${deposit.client_address ? `<div class="field"><div class="field-label">Dirección</div><div class="field-value">${deposit.client_address}</div></div>` : ''}
      </div>
      <div class="box">
        <h2 style="margin-top:0;border:none;font-size:11px;color:#888;text-transform:uppercase">Artículo</h2>
        <div class="field"><div class="field-label">Descripción</div><div class="field-value">${deposit.description}</div></div>
        <div class="field"><div class="field-label">Valor tasado</div><div class="field-value mono">${fmtN(deposit.appraised_value)} €</div></div>
        <div class="field"><div class="field-label">${isEmpeno ? 'Importe prestado' : 'Precio de venta acordado'}</div>
          <div class="field-value mono" style="font-size:18px;color:#1a1a2e">${fmtN(deposit.agreed_price)} €</div></div>
      </div>
    </div>

    <div class="box" style="margin-bottom:14px">
      <h2 style="margin-top:0;border:none;font-size:11px;color:#888;text-transform:uppercase">Condiciones económicas</h2>
      <div class="grid2" style="margin-bottom:0">
        <div>
          <div class="field"><div class="field-label">Comisión tienda</div><div class="field-value mono">${deposit.commission_pct}% = ${commission} €</div></div>
          <div class="field"><div class="field-label">${isEmpeno ? 'Importe a devolver al cliente' : 'Cliente recibe (si se vende)'}</div>
            <div class="field-value mono" style="font-size:16px">${clientReceives} €</div></div>
        </div>
        <div>
          <div class="field"><div class="field-label">Fecha de entrada</div><div class="field-value">${deposit.entry_date}</div></div>
          <div class="field"><div class="field-label">Fecha límite de recogida</div><div class="field-value" style="color:#c92a2a;font-weight:700">${deposit.expiry_date}</div></div>
        </div>
      </div>
    </div>

    ${deposit.notes ? `<div class="box"><div class="field-label">Observaciones</div><div>${deposit.notes}</div></div>` : ''}

    <div class="box warn" style="font-size:11px;margin-bottom:14px">
      ${isEmpeno
        ? `<strong>Condiciones del empeño:</strong> El cliente deberá recoger y pagar el artículo antes del <strong>${deposit.expiry_date}</strong>.
           Pasada dicha fecha sin recogida, ${NEGOCIO.nombre} queda autorizado a proceder a su venta.
           El importe del empeño es de <strong>${fmtN(deposit.agreed_price)} €</strong>.`
        : `<strong>Condiciones del depósito:</strong> El artículo permanecerá en depósito hasta el <strong>${deposit.expiry_date}</strong>.
           Si se vende antes, el cliente recibirá <strong>${clientReceives} €</strong> (${100 - deposit.commission_pct}% del precio de venta).
           Si no se vende antes de la fecha límite, el cliente podrá recogerlo sin cargo.`}
    </div>

    <div class="signs">
      <div>
        <div class="sign-label">Firma del cliente (DNI: ${deposit.client_dni})</div>
        <div class="sign-box" style="min-height:80px"></div>
        <div style="font-size:10px;color:#888;margin-top:4px;text-align:center">${deposit.client_name}</div>
      </div>
      <div>
        <div class="sign-label">Firma del responsable / Sello tienda</div>
        <div class="sign-box" style="min-height:80px"></div>
        <div style="font-size:10px;color:#888;margin-top:4px;text-align:center">${NEGOCIO.nombre} · NIF ${NEGOCIO.nif}</div>
      </div>
    </div>

    <div class="footer">
      <span>Original para la tienda · Copia para el cliente</span>
      <span>TPV-Legal-ES · ${new Date().toLocaleDateString('es-ES')}</span>
    </div>`)
}
