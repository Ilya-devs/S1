import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Users,
  Package,
  Wallet,
  Undo2,
  BarChart3,
  Settings,
  DatabaseBackup,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles?: string[] // undefined = everyone
}

export const navItems: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/sales', label: 'المبيعات', icon: ShoppingCart },
  { to: '/purchases', label: 'المشتريات', icon: Truck },
  { to: '/customers', label: 'الزبائن', icon: Users },
  { to: '/suppliers', label: 'الموردين', icon: Truck },
  { to: '/products', label: 'المخزون', icon: Package },
  { to: '/debts', label: 'الديون', icon: Wallet },
  { to: '/returns', label: 'المرتجعات', icon: Undo2 },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/backup', label: 'النسخ الاحتياطي', icon: DatabaseBackup },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]

// Compact primary set for mobile bottom tab bar
export const mobileTabItems: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/sales', label: 'المبيعات', icon: ShoppingCart },
  { to: '/customers', label: 'الزبائن', icon: Users },
  { to: '/debts', label: 'الديون', icon: Wallet },
]
