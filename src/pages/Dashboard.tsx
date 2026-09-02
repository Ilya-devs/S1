import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import { Wallet, TrendingUp, TrendingDown, PackageX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, StatCard } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/primitives'
import { formatIQD, formatDateTime, extractName } from '@/lib/format'

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13)
      twoWeeksAgo.setHours(0, 0, 0, 0)

      const [todaySales, recentInvoices, customerBalances, supplierBalances, lowStock, chartRange] =
        await Promise.all([
          supabase
            .from('sales_invoices')
            .select('total_iqd')
            .gte('created_at', todayStart.toISOString())
            .eq('status', 'confirmed'),
          supabase
            .from('sales_invoices')
            .select('id, invoice_number, total_iqd, payment_method, created_at, customers(name)')
            .order('created_at', { ascending: false })
            .limit(6),
          supabase.from('customer_balances').select('balance_iqd'),
          supabase.from('supplier_balances').select('balance_iqd'),
          supabase.from('products').select('id').lte('quantity_on_hand', 5).eq('is_active', true),
          supabase
            .from('sales_invoices')
            .select('total_iqd, created_at')
            .gte('created_at', twoWeeksAgo.toISOString())
            .eq('status', 'confirmed'),
        ])

      const todayTotal = (todaySales.data ?? []).reduce((s, r) => s + Number(r.total_iqd), 0)
      const totalReceivable = (customerBalances.data ?? []).reduce(
        (s, r) => s + Math.max(0, Number(r.balance_iqd)),
        0
      )
      const totalPayable = (supplierBalances.data ?? []).reduce(
        (s, r) => s + Math.max(0, Number(r.balance_iqd)),
        0
      )

      const byDay = new Map<string, number>()
      for (let i = 0; i < 14; i++) {
        const d = new Date(twoWeeksAgo)
        d.setDate(d.getDate() + i)
        byDay.set(d.toISOString().slice(0, 10), 0)
      }
      for (const row of chartRange.data ?? []) {
        const key = row.created_at.slice(0, 10)
        byDay.set(key, (byDay.get(key) ?? 0) + Number(row.total_iqd))
      }
      const chartData = Array.from(byDay.entries()).map(([date, total]) => ({
        date: date.slice(5),
        total,
      }))

      return {
        todayTotal,
        totalReceivable,
        totalPayable,
        lowStockCount: lowStock.data?.length ?? 0,
        recentInvoices: recentInvoices.data ?? [],
        chartData,
      }
    },
    refetchInterval: 60_000,
  })

  return (
    <div>
      <PageHeader title="لوحة التحكم" subtitle="نظرة سريعة على أداء عملك اليوم" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="مبيعات اليوم"
          value={isLoading ? '...' : formatIQD(data?.todayTotal ?? 0)}
          tone="brass"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="لنا عند الزبائن (دين)"
          value={isLoading ? '...' : formatIQD(data?.totalReceivable ?? 0)}
          tone="success"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="علينا للموردين"
          value={isLoading ? '...' : formatIQD(data?.totalPayable ?? 0)}
          tone="danger"
          icon={<TrendingDown className="h-5 w-5" />}
        />
        <StatCard
          label="منتجات قاربت على النفاد"
          value={isLoading ? '...' : String(data?.lowStockCount ?? 0)}
          tone={data && data.lowStockCount > 0 ? 'danger' : 'neutral'}
          icon={<PackageX className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="mb-4 text-sm font-medium text-ink-300">حركة المبيعات — آخر 14 يوم</p>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.chartData ?? []}>
                <XAxis dataKey="date" stroke="#71747c" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#121417', border: '1px solid #212328', borderRadius: 12 }}
                  labelStyle={{ color: '#c4c6cb' }}
                  formatter={(v) => [formatIQD(Number(v)), 'المبيعات']}
                />
                <Line type="monotone" dataKey="total" stroke="#c9a227" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-4 text-sm font-medium text-ink-300">آخر الفواتير</p>
          <div className="space-y-3">
            {(data?.recentInvoices ?? []).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-ink-200">{extractName(inv.customers) ?? 'زبون نقدي'}</p>
                  <p className="text-[11px] text-ink-600">{formatDateTime(inv.created_at)}</p>
                </div>
                <p className="tabular-nums-ltr text-brass-400">{formatIQD(Number(inv.total_iqd))}</p>
              </div>
            ))}
            {(data?.recentInvoices ?? []).length === 0 && (
              <p className="text-xs text-ink-600">لا توجد فواتير بعد</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
