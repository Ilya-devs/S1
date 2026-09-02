import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import { supabase } from '@/lib/supabase'
import { PageHeader, StatCard } from '@/components/ui/PageHeader'
import { Card, Input, Label } from '@/components/ui/primitives'
import { formatIQD } from '@/lib/format'

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function Reports() {
  const [from, setFrom] = useState(isoDaysAgo(29).slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data, isLoading } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: async () => {
      const fromISO = new Date(from).toISOString()
      const toISO = new Date(new Date(to).getTime() + 86400000).toISOString()

      const [sales, purchases, expenses, salesReturns, purchaseReturns] = await Promise.all([
        supabase.from('sales_invoices').select('total_iqd, created_at').gte('created_at', fromISO).lt('created_at', toISO).eq('status', 'confirmed'),
        supabase.from('purchase_invoices').select('total_iqd, created_at').gte('created_at', fromISO).lt('created_at', toISO).eq('status', 'confirmed'),
        supabase.from('expenses').select('amount_iqd, spent_at').gte('spent_at', from).lte('spent_at', to),
        supabase.from('sales_returns').select('total_iqd, created_at').gte('created_at', fromISO).lt('created_at', toISO),
        supabase.from('purchase_returns').select('total_iqd, created_at').gte('created_at', fromISO).lt('created_at', toISO),
      ])

      const salesTotal = (sales.data ?? []).reduce((s, r) => s + Number(r.total_iqd), 0)
      const purchasesTotal = (purchases.data ?? []).reduce((s, r) => s + Number(r.total_iqd), 0)
      const expensesTotal = (expenses.data ?? []).reduce((s, r) => s + Number(r.amount_iqd), 0)
      const salesReturnsTotal = (salesReturns.data ?? []).reduce((s, r) => s + Number(r.total_iqd), 0)
      const purchaseReturnsTotal = (purchaseReturns.data ?? []).reduce((s, r) => s + Number(r.total_iqd), 0)

      const netSales = salesTotal - salesReturnsTotal
      const netPurchases = purchasesTotal - purchaseReturnsTotal
      const grossProfit = netSales - netPurchases
      const netProfit = grossProfit - expensesTotal

      const byDay = new Map<string, { sales: number; purchases: number }>()
      for (const r of sales.data ?? []) {
        const k = r.created_at.slice(0, 10)
        byDay.set(k, { sales: (byDay.get(k)?.sales ?? 0) + Number(r.total_iqd), purchases: byDay.get(k)?.purchases ?? 0 })
      }
      for (const r of purchases.data ?? []) {
        const k = r.created_at.slice(0, 10)
        byDay.set(k, { sales: byDay.get(k)?.sales ?? 0, purchases: (byDay.get(k)?.purchases ?? 0) + Number(r.total_iqd) })
      }
      const chartData = Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date: date.slice(5), ...v }))

      return { salesTotal, purchasesTotal, expensesTotal, salesReturnsTotal, purchaseReturnsTotal, netSales, netPurchases, grossProfit, netProfit, chartData }
    },
  })

  return (
    <div>
      <PageHeader title="التقارير" subtitle="ملخص الأداء المالي خلال فترة محددة" />

      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <Label>من تاريخ</Label>
          <Input dir="ltr" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>إلى تاريخ</Label>
          <Input dir="ltr" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="صافي المبيعات" value={isLoading ? '...' : formatIQD(data?.netSales ?? 0)} tone="brass" />
        <StatCard label="صافي المشتريات" value={isLoading ? '...' : formatIQD(data?.netPurchases ?? 0)} tone="neutral" />
        <StatCard label="المصاريف" value={isLoading ? '...' : formatIQD(data?.expensesTotal ?? 0)} tone="danger" />
        <StatCard
          label="صافي الربح"
          value={isLoading ? '...' : formatIQD(data?.netProfit ?? 0)}
          tone={(data?.netProfit ?? 0) >= 0 ? 'success' : 'danger'}
        />
      </div>

      <Card className="mt-6 p-5">
        <p className="mb-4 text-sm font-medium text-ink-300">المبيعات مقابل المشتريات</p>
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.chartData ?? []}>
              <XAxis dataKey="date" stroke="#71747c" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#121417', border: '1px solid #212328', borderRadius: 12 }}
                labelStyle={{ color: '#c4c6cb' }}
                formatter={(v) => formatIQD(Number(v))}
              />
              <Bar dataKey="sales" fill="#c9a227" radius={[4, 4, 0, 0]} name="مبيعات" />
              <Bar dataKey="purchases" fill="#4a4d54" radius={[4, 4, 0, 0]} name="مشتريات" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium text-ink-300">مرتجعات البيع</p>
          <p className="tabular-nums-ltr text-right text-xl font-semibold text-crimson-400">
            {formatIQD(data?.salesReturnsTotal ?? 0)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium text-ink-300">مرتجعات الشراء</p>
          <p className="tabular-nums-ltr text-right text-xl font-semibold text-crimson-400">
            {formatIQD(data?.purchaseReturnsTotal ?? 0)}
          </p>
        </Card>
      </div>
    </div>
  )
}
