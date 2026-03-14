export const NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE    ?? 'MI TIENDA',
  nif:       process.env.NEXT_PUBLIC_NEGOCIO_NIF       ?? 'B00000000',
  direccion: process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION ?? 'Calle Mayor, 1',
  cp:        process.env.NEXT_PUBLIC_NEGOCIO_CP        ?? '28001',
  localidad: process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD ?? 'Madrid',
  telefono:  process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO  ?? '',
  email:     process.env.NEXT_PUBLIC_NEGOCIO_EMAIL     ?? '',
  serie:     process.env.NEXT_PUBLIC_NEGOCIO_SERIE     ?? 'A',
}

export const SW_NAME    = 'TPV-Legal-ES'
export const SW_VERSION = '1.0.0'
