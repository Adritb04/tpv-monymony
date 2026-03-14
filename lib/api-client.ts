const base = '/api'

function headers(token?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function req<T>(method: string, url: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(base + url, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Error de servidor')
  return json
}

export const api = {
  login: (username: string, password: string) =>
    req<{ token: string; user: { id: number; username: string; name: string; role: string } }>(
      'POST', '/auth/login', { username, password }),

  products: {
    list:   (t: string) => req<{ data: any[] }>('GET', '/products', undefined, t),
    create: (t: string, b: any) => req<{ data: any }>('POST', '/products', b, t),
    update: (t: string, b: any) => req<{ data: any }>('PUT', '/products', b, t),
    delete: (t: string, id: number) => req<{ ok: boolean }>('DELETE', `/products?id=${id}`, undefined, t),
  },

  categories: {
    list:   (t: string) => req<{ data: any[] }>('GET', '/categories', undefined, t),
    create: (t: string, b: any) => req<{ data: any }>('POST', '/categories', b, t),
    update: (t: string, b: any) => req<{ data: any }>('PUT', '/categories', b, t),
    delete: (t: string, id: number) => req<{ ok: boolean }>('DELETE', `/categories?id=${id}`, undefined, t),
  },

  sales: {
    list: (t: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return req<{ data: any[]; count: number }>('GET', `/sales${qs}`, undefined, t)
    },
    create:  (t: string, b: any) => req<{ data: any }>('POST', '/sales', b, t),
    rectify: (t: string, b: any) => req<{ data: any }>('POST', '/sales/rectify', b, t),
  },

  users: {
    list:   (t: string) => req<{ data: any[] }>('GET', '/users', undefined, t),
    create: (t: string, b: any) => req<{ data: any }>('POST', '/users', b, t),
    update: (t: string, b: any) => req<{ data: any }>('PUT', '/users', b, t),
    delete: (t: string, id: number) => req<{ ok: boolean }>('DELETE', `/users?id=${id}`, undefined, t),
  },

  log:       (t: string) => req<{ data: any[] }>('GET', '/log', undefined, t),
  integrity: (t: string) => req<{ data: any }>('GET', '/integrity', undefined, t),
  export:    (t: string, format: string) => `${base}/export?format=${format}&token=${t}`,
}
