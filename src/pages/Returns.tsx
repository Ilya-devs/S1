import { useMemo, useState } from 'react'
import { asArray } from '@/lib/collections'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatIQD, formatDateTime, extractName } from '@/lib/format'

type Tab = 'sales' | 'purchases'

export default function Returns() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('sales')
  const [modalOpen, setModalOpen] = useState(false)

  const { data: salesReturns, isLoading: loadingSales } = useQuery({
    queryKey: ['sales_returns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_returns')
        .select('id, return_number, total_iqd, reason, created_at, customers(name)')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: tab === 'sales',
  })

  const { data: purchaseReturns, isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchase_returns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_returns')
        .select('id, return_number, total_iqd, reason, created_at, suppliers(name)')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: tab === 'purchases',
  })

  return (
    <div>
      <PageHeader
        title="المرتجعات"
        subtitle="مرتجع بيع (من الزبون) ومرتجع شراء (إلى المورد)"
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> مرتجع جديد
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('sales')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'sales' ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800'
          }`}
        >
          مرتجع بيع
        </button>
        <button
          onClick={() => setTab('purchases')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'purchases' ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800'
          }`}
        >
          مرتجع شراء
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-right text-xs text-ink-500">
                <th className="px-4 py-3 font-medium">رقم المرتجع</th>
                <th className="px-4 py-3 font-medium">{tab === 'sales' ? 'الزبون' : 'المورد'}</th>
                <th className="px-4 py-3 font-medium">القيمة</th>
                <th className="px-4 py-3 font-medium">السبب</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'sales' ? loadingSales : loadingPurchases) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                    جارٍ التحميل...
                  </td>
                </tr>
              )}
              {tab === 'sales'
                ? asArray(salesReturns).map((r) => (
                    <tr key={r.id} className="border-b border-ink-850 last:border-0 hover:bg-ink-850/50">
                      <td className="px-4 py-3 text-ink-100" dir="ltr">{r.return_number}</td>
                      <td className="px-4 py-3 text-ink-300">{extractName(r.customers) ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums-ltr text-right text-crimson-400">{formatIQD(Number(r.total_iqd))}</td>
                      <td className="px-4 py-3 text-ink-400">{r.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">{formatDateTime(r.created_at)}</td>
                    </tr>
                  ))
                : asArray(purchaseReturns).map((r) => (
                    <tr key={r.id} className="border-b border-ink-850 last:border-0 hover:bg-ink-850/50">
                      <td className="px-4 py-3 text-ink-100" dir="ltr">{r.return_number}</td>
                      <td className="px-4 py-3 text-ink-300">{extractName(r.suppliers) ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums-ltr text-right text-crimson-400">{formatIQD(Number(r.total_iqd))}</td>
                      <td className="px-4 py-3 text-ink-400">{r.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">{formatDateTime(r.created_at)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Card>

      <NewReturnModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultTab={tab}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ['sales_returns'] })
          void qc.invalidateQueries({ queryKey: ['purchase_returns'] })
          void qc.invalidateQueries({ queryKey: ['products'] })
        }}
      />
    </div>
  )
}

interface Line {
  product_id: string
  name: string
  quantity: number
  unit_price_iqd: number
}

function NewReturnModal({
  open,
  onClose,
  onSaved,
  defaultTab,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultTab: Tab
}) {
  const [kind, setKind] = useState<Tab>(defaultTab)
  const [partyId, setPartyId] = useState('')
  const [reason, setReason] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: parties } = useQuery({
    queryKey: ['return-parties', kind],
    queryFn: async () => {
      const table = kind === 'sales' ? 'customers' : 'suppliers'
      const { data } = await supabase.from(table).select('id, name').eq('is_active', true).order('name').limit(500)
      return (data ?? []) as { id: string; name: string }[]
    },
    enabled: open,
  })

  const { data: products } = useQuery({
    queryKey: ['products-lite-return'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, sale_price_iqd, cost_price_iqd').order('name').limit(500)
      return data ?? []
    },
    enabled: open,
  })

  const filteredProducts = useMemo(
    () => asArray(products).filter((p) => p.name.includes(productSearch)).slice(0, 8),
    [products, productSearch]
  )

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_price_iqd, 0)

  function addLine(p: { id: string; name: string; sale_price_iqd: number; cost_price_iqd: number }) {
    setLines((prev) => [
      ...prev,
      { product_id: p.id, name: p.name, quantity: 1, unit_price_iqd: kind === 'sales' ? p.sale_price_iqd : p.cost_price_iqd },
    ])
    setProductSearch('')
  }

  function reset() {
    setPartyId('')
    setReason('')
    setLines([])
    setError(null)
  }

  async function handleSave() {
    setError(null)
    if (lines.length === 0) {
      setError('أضف منتجاً واحداً على الأقل')
      return
    }
    setSaving(true)
    try {
      const returnNumber = `${kind === 'sales' ? 'SR' : 'PR'}-${Date.now().toString().slice(-8)}`
      if (kind === 'sales') {
        const { error: retErr } = await supabase.rpc('create_sales_return', {
          p_return_number: returnNumber,
          p_original_invoice_id: null,
          p_customer_id: partyId || null,
          p_reason: reason || null,
          p_items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit_price_iqd: l.unit_price_iqd })),
        })
        if (retErr) throw retErr
      } else {
        const { error: retErr } = await supabase.rpc('create_purchase_return', {
          p_return_number: returnNumber,
          p_original_invoice_id: null,
          p_supplier_id: partyId || null,
          p_reason: reason || null,
          p_items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit_cost_iqd: l.unit_price_iqd })),
        })
        if (retErr) throw retErr
      }
      reset()
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="مرتجع جديد">
      <div className="max-h-[75vh] space-y-4 overflow-y-auto">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setKind('sales')
              setPartyId('')
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              kind === 'sales' ? 'border-brass-500 bg-brass-500/10 text-brass-300' : 'border-ink-700 bg-ink-850 text-ink-400'
            }`}
          >
            مرتجع بيع (من زبون)
          </button>
          <button
            type="button"
            onClick={() => {
              setKind('purchases')
              setPartyId('')
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              kind === 'purchases' ? 'border-brass-500 bg-brass-500/10 text-brass-300' : 'border-ink-700 bg-ink-850 text-ink-400'
            }`}
          >
            مرتجع شراء (إلى مورد)
          </button>
        </div>

        <div>
          <Label>{kind === 'sales' ? 'الزبون' : 'المورد'}</Label>
          <select
            className="h-11 w-full rounded-xl border border-ink-700 bg-ink-850 px-3.5 text-sm text-ink-50 outline-none focus:border-brass-500"
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
          >
            <option value="">اختر...</option>
            {asArray(parties).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>سبب المرتجع (اختياري)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div>
          <Label>إضافة منتج</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <Input className="pr-9" placeholder="ابحث عن منتج..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
          </div>
          {productSearch && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-ink-700 bg-ink-850">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addLine(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-right text-sm text-ink-200 hover:bg-ink-800"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="space-y-2 rounded-xl border border-ink-800 p-3">
            {lines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate text-ink-200">{l.name}</span>
                <Input
                  dir="ltr"
                  type="number"
                  className="h-9 w-16 px-2 text-center"
                  value={l.quantity}
                  onChange={(e) =>
                    setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x)))
                  }
                />
                <Input
                  dir="ltr"
                  type="number"
                  className="h-9 w-24 px-2 text-center"
                  value={l.unit_price_iqd}
                  onChange={(e) =>
                    setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price_iqd: Number(e.target.value) || 0 } : x)))
                  }
                />
                <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} className="text-ink-500 hover:text-crimson-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-ink-800 pt-3">
          <span className="text-sm text-ink-400">إجمالي المرتجع</span>
          <span className="tabular-nums-ltr text-xl font-semibold text-crimson-400">{formatIQD(total)}</span>
        </div>

        {error && <p className="text-xs text-crimson-400">{error}</p>}

        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'جارٍ الحفظ...' : 'حفظ المرتجع'}
        </Button>
      </div>
    </Modal>
  )
}
