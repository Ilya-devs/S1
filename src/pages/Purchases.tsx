import { useMemo, useState } from 'react'
import { asArray } from '@/lib/collections'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Product, Supplier, CartLine } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatIQD, formatDateTime, generateInvoiceNumber, extractName } from '@/lib/format'

export default function Purchases() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['purchase_invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_invoices')
        .select('id, invoice_number, total_iqd, due_iqd, payment_method, created_at, suppliers(name)')
        .order('created_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
  })

  return (
    <div>
      <PageHeader
        title="المشتريات"
        subtitle="فواتير الشراء من الموردين"
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> فاتورة شراء جديدة
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-right text-xs text-ink-500">
                <th className="px-4 py-3 font-medium">رقم الفاتورة</th>
                <th className="px-4 py-3 font-medium">المورد</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
                <th className="px-4 py-3 font-medium">المتبقي</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-500">
                    جارٍ التحميل...
                  </td>
                </tr>
              )}
              {asArray(invoices).map((inv) => (
                <tr key={inv.id} className="border-b border-ink-850 last:border-0 hover:bg-ink-850/50">
                  <td className="px-4 py-3 text-ink-100" dir="ltr">
                    {inv.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-ink-300">{extractName(inv.suppliers) ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums-ltr text-right text-brass-400">{formatIQD(Number(inv.total_iqd))}</td>
                  <td className="px-4 py-3 tabular-nums-ltr text-right">
                    {Number(inv.due_iqd) > 0 ? (
                      <span className="text-crimson-400">{formatIQD(Number(inv.due_iqd))}</span>
                    ) : (
                      <span className="text-emerald-400">مسدد</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={inv.payment_method === 'cash' ? 'success' : 'warning'}>
                      {inv.payment_method === 'cash' ? 'نقدي' : inv.payment_method === 'credit' ? 'دين' : 'جزئي'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">{formatDateTime(inv.created_at)}</td>
                </tr>
              ))}
              {!isLoading && (invoices ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-500">
                    لا توجد فواتير شراء بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <NewPurchaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ['purchase_invoices'] })
          void qc.invalidateQueries({ queryKey: ['products'] })
          void qc.invalidateQueries({ queryKey: ['supplier_balances'] })
        }}
        userId={profile?.id}
      />
    </div>
  )
}

function NewPurchaseModal({
  open,
  onClose,
  onSaved,
  userId,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  userId?: string
}) {
  const [supplierId, setSupplierId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'partial'>('cash')
  const [paidAmount, setPaidAmount] = useState('0')
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lite'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name').eq('is_active', true).order('name').limit(500)
      return (data ?? []) as Pick<Supplier, 'id' | 'name'>[]
    },
    enabled: open,
  })

  const { data: products } = useQuery({
    queryKey: ['products-lite-purchase'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name').limit(500)
      return (data ?? []) as Product[]
    },
    enabled: open,
  })

  const filteredProducts = useMemo(
    () => asArray(products).filter((p) => p.name.includes(productSearch)).slice(0, 8),
    [products, productSearch]
  )

  const total = cart.reduce((s, l) => s + l.quantity * l.unit_price_iqd, 0)

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === p.id)
      if (existing) return prev.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { product_id: p.id, name: p.name, unit: p.unit, quantity: 1, unit_price_iqd: p.cost_price_iqd }]
    })
    setProductSearch('')
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.product_id === productId ? { ...l, ...patch } : l)))
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product_id !== productId))
  }

  function reset() {
    setSupplierId('')
    setPaymentMethod('cash')
    setPaidAmount('0')
    setCart([])
    setError(null)
  }

  async function handleSave() {
    setError(null)
    if (cart.length === 0) {
      setError('أضف منتجاً واحداً على الأقل')
      return
    }
    if (paymentMethod !== 'cash' && !supplierId) {
      setError('الشراء بالدين أو الجزئي يتطلب اختيار مورد')
      return
    }
    setSaving(true)
    try {
      const paid = paymentMethod === 'cash' ? total : paymentMethod === 'credit' ? 0 : Math.round(Number(paidAmount) || 0)
      const { error: rpcErr } = await supabase.rpc('create_purchase_invoice', {
        p_invoice_number: generateInvoiceNumber('PUR'),
        p_supplier_id: supplierId || null,
        p_payment_method: paymentMethod,
        p_discount_iqd: 0,
        p_paid_iqd: paid,
        p_notes: null,
        p_client_local_id: crypto.randomUUID(),
        p_items: cart.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_cost_iqd: l.unit_price_iqd,
        })),
      })
      if (rpcErr) throw rpcErr

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
    <Modal open={open} onClose={onClose} title="فاتورة شراء جديدة">
      <div className="max-h-[75vh] space-y-4 overflow-y-auto">
        <div>
          <Label>طريقة الدفع</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'credit', 'partial'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  paymentMethod === m ? 'border-brass-500 bg-brass-500/10 text-brass-300' : 'border-ink-700 bg-ink-850 text-ink-400'
                }`}
              >
                {m === 'cash' ? 'نقدي' : m === 'credit' ? 'دين كامل' : 'دفع جزئي'}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod !== 'cash' && (
          <div>
            <Label>المورد</Label>
            <select
              className="h-11 w-full rounded-xl border border-ink-700 bg-ink-850 px-3.5 text-sm text-ink-50 outline-none focus:border-brass-500"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">اختر مورد...</option>
              {asArray(suppliers).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {paymentMethod === 'partial' && (
          <div>
            <Label>المبلغ المدفوع الآن</Label>
            <Input dir="ltr" type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
          </div>
        )}

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
                  onClick={() => addToCart(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-right text-sm text-ink-200 hover:bg-ink-800"
                >
                  <span>{p.name}</span>
                  <span className="tabular-nums-ltr text-brass-400">{formatIQD(p.cost_price_iqd)}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && <p className="px-3 py-2 text-xs text-ink-500">لا توجد نتائج</p>}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-2 rounded-xl border border-ink-800 p-3">
            {cart.map((l) => (
              <div key={l.product_id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate text-ink-200">{l.name}</span>
                <Input
                  dir="ltr"
                  type="number"
                  min={0.01}
                  step="any"
                  className="h-9 w-16 px-2 text-center"
                  value={l.quantity}
                  onChange={(e) => updateLine(l.product_id, { quantity: Number(e.target.value) || 0 })}
                />
                <Input
                  dir="ltr"
                  type="number"
                  className="h-9 w-24 px-2 text-center"
                  value={l.unit_price_iqd}
                  onChange={(e) => updateLine(l.product_id, { unit_price_iqd: Number(e.target.value) || 0 })}
                />
                <span className="w-24 shrink-0 tabular-nums-ltr text-left text-brass-400">{formatIQD(l.quantity * l.unit_price_iqd)}</span>
                <button type="button" onClick={() => removeLine(l.product_id)} className="text-ink-500 hover:text-crimson-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-ink-800 pt-3">
          <span className="text-sm text-ink-400">الإجمالي</span>
          <span className="tabular-nums-ltr text-xl font-semibold text-brass-400">{formatIQD(total)}</span>
        </div>

        {error && <p className="text-xs text-crimson-400">{error}</p>}

        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
        </Button>
      </div>
    </Modal>
  )
}
