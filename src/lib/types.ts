export type UserRole = 'owner' | 'admin' | 'accountant' | 'cashier' | 'viewer'


export interface Organization {
  id: string
  name: string
  slug: string
  owner_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationMembership {
  organization_id: string
  user_id: string
  role: UserRole
  is_active: boolean
  joined_at: string
  updated_at: string
  organization?: Organization
}

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
  phone: string | null
  avatar_url: string | null
  active_organization_id: string | null
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  opening_balance_iqd: number
  is_active: boolean
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  opening_balance_iqd: number
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  sku: string | null
  barcode: string | null
  name: string
  category_id: string | null
  unit: string
  cost_price_iqd: number
  sale_price_iqd: number
  quantity_on_hand: number
  reorder_point: number
  is_active: boolean
  image_url: string | null
}

export type InvoiceStatus = 'draft' | 'confirmed' | 'cancelled'
export type PaymentMethod = 'cash' | 'credit' | 'partial'

export interface SalesInvoice {
  id: string
  invoice_number: string
  customer_id: string | null
  status: InvoiceStatus
  payment_method: PaymentMethod
  subtotal_iqd: number
  discount_iqd: number
  total_iqd: number
  paid_iqd: number
  due_iqd: number
  notes: string | null
  created_at: string
}

export interface SalesInvoiceItem {
  id: string
  invoice_id: string
  product_id: string
  quantity: number
  unit_price_iqd: number
  line_total_iqd: number
}

export interface PurchaseInvoice {
  id: string
  invoice_number: string
  supplier_id: string | null
  status: InvoiceStatus
  payment_method: PaymentMethod
  subtotal_iqd: number
  discount_iqd: number
  total_iqd: number
  paid_iqd: number
  due_iqd: number
  notes: string | null
  created_at: string
}

export interface CustomerBalance {
  customer_id: string
  name: string
  balance_iqd: number
}

export interface SupplierBalance {
  supplier_id: string
  name: string
  balance_iqd: number
}

export interface CartLine {
  product_id: string
  name: string
  unit: string
  quantity: number
  unit_price_iqd: number
  max_stock?: number
}
