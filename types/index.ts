export type UserRole = 'cajero' | 'encargado' | 'admin'

export interface User {
  id: number
  username: string
  name: string
  role: UserRole
  active: boolean
  last_login?: string
  created_at?: string
}

export interface Category {
  id: number
  name: string
  icon: string
  created_at?: string
}

export type Regime = 'iva' | 'rebu'

export interface Product {
  id: number
  name: string
  emoji: string
  category_id: number
  price: number
  regime: Regime
  iva_rate: number
  cost_price: number
  stock: number
  active: boolean
  created_at?: string
  category?: Category
}

export interface SaleItem {
  product_id: number
  name: string
  emoji: string
  price: number
  qty: number
  regime: Regime
  iva_rate: number
  cost_price: number
  line_total: number
  line_base: number
  line_iva: number
}

export interface IvaGroup {
  base: number
  iva: number
  total: number
}

export interface RebuGroup {
  margin: number
  iva: number
  total: number
}

export interface IvaBreakdown {
  [key: string]: IvaGroup | RebuGroup
}

export type SaleType = 'venta' | 'rectificativo'
export type PayMethod = 'efectivo' | 'tarjeta'

export interface Sale {
  id: number
  ticket_id: string
  type: SaleType
  date: string
  time: string
  ts: number
  items: SaleItem[]
  iva_breakdown: IvaBreakdown
  base: number
  iva_total: number
  total: number
  pay: PayMethod
  cashier_id: number
  cashier_name: string
  nif: string
  razon_social: string
  rect_of?: string
  rect_reason?: string
  rectified?: boolean
  rectified_by?: string
  rectified_at?: string
  hash: string
  prev_hash: string
  sw_name: string
  sw_version: string
  created_at?: string
}

export interface OpLog {
  id: number
  ts: number
  dt: string
  type: 'venta' | 'rect' | 'auth' | 'admin' | 'system'
  action: string
  detail: string
  user_id?: number
  username: string
  created_at?: string
}

export interface AuthPayload {
  userId: number
  username: string
  role: UserRole
  name: string
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
}
