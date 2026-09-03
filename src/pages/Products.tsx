import { useState } from 'react'
import { asArray } from '@/lib/collections'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Plus, Search, AlertTriangle, SlidersHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatIQD, formatNumber } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'

export default function Products() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustment, setAdjustment] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    unit: 'قطعة',
    cost_price_iqd: '0',
    sale_price_iqd: '0',
    quantity_on_hand: '0',
    reorder_point: '5',
  })

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name').limit(500)
      return (data ?? []) as Product[]
    },
  })

  const createProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('create_product', {
        p_name: form.name,
        p_sku: form.sku.trim() || null,
        p_barcode: form.barcode.trim() || null,
        p_unit: form.unit,
        p_cost_price_iqd: Math.round(Number(form.cost_price_iqd) || 0),
        p_sale_price_iqd: Math.round(Number(form.sale_price_iqd) || 0),
        p_initial_quantity: Number(form.quantity_on_hand) || 0,
        p_reorder_point: Number(form.reorder_point) || 0,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      setModalOpen(false)
      setForm({ name: '', sku: '', barcode: '', unit: 'قطعة', cost_price_iqd: '0', sale_price_iqd: '0', quantity_on_hand: '0', reorder_point: '5' })
    },
  })

  const adjustStock = useMutation({
    mutationFn: async () => {
      if (!adjustProduct) throw new Error('اختر منتجاً')
      const delta = Number(adjustment)
      if (!Number.isFinite(delta) || delta === 0) throw new Error('أدخل كمية تعديل غير صفرية')
      const { error } = await supabase.rpc('adjust_stock', {
        p_product_id: adjustProduct.id,
        p_quantity_delta: delta,
        p_note: adjustNote.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      setAdjustProduct(null); setAdjustment(''); setAdjustNote('')
    },
  })

  const filtered = asArray(products).filter((p) => p.name.includes(search))

  return (
    <div>
      <PageHeader
        title="المخزون"
        subtitle={`${products?.length ?? 0} منتج`}
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> منتج جديد
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <Input placeholder="ابحث عن منتج..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-right text-xs text-ink-500">
                <th className="px-4 py-3 font-medium">المنتج</th>
                <th className="px-4 py-3 font-medium">الباركود</th>
                <th className="px-4 py-3 font-medium">الكمية</th>
                <th className="px-4 py-3 font-medium">سعر الشراء</th>
                <th className="px-4 py-3 font-medium">سعر البيع</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
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
              {filtered.map((p) => {
                const low = p.quantity_on_hand <= p.reorder_point
                return (
                  <tr key={p.id} className="border-b border-ink-850 last:border-0 hover:bg-ink-850/50">
                    <td className="px-4 py-3 text-ink-100">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-ink-500" dir="ltr">{p.barcode ?? p.sku ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums-ltr text-right">
                      {formatNumber(p.quantity_on_hand)} {p.unit}
                    </td>
                    <td className="px-4 py-3 tabular-nums-ltr text-right text-ink-400">{formatIQD(p.cost_price_iqd)}</td>
                    <td className="px-4 py-3 tabular-nums-ltr text-right text-brass-400">{formatIQD(p.sale_price_iqd)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {low ? (
                          <Badge tone="danger"><AlertTriangle className="ml-1 h-3 w-3" /> منخفض</Badge>
                        ) : <Badge tone="success">متوفر</Badge>}
                        {(profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'accountant') && (
                          <button type="button" onClick={() => setAdjustProduct(p)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-brass-400" title="تعديل المخزون">
                            <SlidersHorizontal className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-500">
                    لا توجد منتجات مطابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="إضافة منتج جديد">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            createProduct.mutate()
          }}
        >
          <div>
            <Label>اسم المنتج</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>SKU</Label><Input dir="ltr" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><Label>الباركود</Label><Input dir="ltr" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
          </div>
          <div>
            <Label>وحدة القياس</Label>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>سعر الشراء</Label>
              <Input
                dir="ltr"
                type="number"
                value={form.cost_price_iqd}
                onChange={(e) => setForm({ ...form, cost_price_iqd: e.target.value })}
              />
            </div>
            <div>
              <Label>سعر البيع</Label>
              <Input
                dir="ltr"
                type="number"
                value={form.sale_price_iqd}
                onChange={(e) => setForm({ ...form, sale_price_iqd: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>الكمية الحالية</Label>
              <Input
                dir="ltr"
                type="number"
                value={form.quantity_on_hand}
                onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })}
              />
            </div>
            <div>
              <Label>حد التنبيه</Label>
              <Input
                dir="ltr"
                type="number"
                value={form.reorder_point}
                onChange={(e) => setForm({ ...form, reorder_point: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={createProduct.isPending}>
            {createProduct.isPending ? 'جارٍ الحفظ...' : 'حفظ المنتج'}
          </Button>
        </form>
      </Modal>
      <Modal open={!!adjustProduct} onClose={() => setAdjustProduct(null)} title={`تعديل مخزون — ${adjustProduct?.name ?? ''}`}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); adjustStock.mutate() }}>
          <p className="text-sm text-ink-400">الكمية الحالية: <span className="text-ink-100">{adjustProduct ? formatNumber(adjustProduct.quantity_on_hand) : '—'}</span></p>
          <div><Label>التغيير (+ إضافة / - سحب)</Label><Input dir="ltr" type="number" step="any" required value={adjustment} onChange={(e) => setAdjustment(e.target.value)} /></div>
          <div><Label>سبب التعديل</Label><Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="جرد، تلف، فرق مخزون..." /></div>
          {adjustStock.error && <p className="text-xs text-crimson-400">{adjustStock.error instanceof Error ? adjustStock.error.message : 'تعذر التعديل'}</p>}
          <Button type="submit" className="w-full" disabled={adjustStock.isPending}>{adjustStock.isPending ? 'جارٍ الحفظ...' : 'تأكيد التعديل'}</Button>
        </form>
      </Modal>
    </div>
  )
}
