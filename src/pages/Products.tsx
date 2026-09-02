import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatIQD, formatNumber } from '@/lib/format'

export default function Products() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    unit: 'قطعة',
    cost_price_iqd: '0',
    sale_price_iqd: '0',
    quantity_on_hand: '0',
    reorder_point: '5',
  })

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name')
      return (data ?? []) as Product[]
    },
  })

  const createProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('products').insert({
        name: form.name,
        unit: form.unit,
        cost_price_iqd: Math.round(Number(form.cost_price_iqd) || 0),
        sale_price_iqd: Math.round(Number(form.sale_price_iqd) || 0),
        quantity_on_hand: Number(form.quantity_on_hand) || 0,
        reorder_point: Number(form.reorder_point) || 0,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      setModalOpen(false)
      setForm({ name: '', unit: 'قطعة', cost_price_iqd: '0', sale_price_iqd: '0', quantity_on_hand: '0', reorder_point: '5' })
    },
  })

  const filtered = (products ?? []).filter((p) => p.name.includes(search))

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
                <th className="px-4 py-3 font-medium">الكمية</th>
                <th className="px-4 py-3 font-medium">سعر الشراء</th>
                <th className="px-4 py-3 font-medium">سعر البيع</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                    جارٍ التحميل...
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const low = p.quantity_on_hand <= p.reorder_point
                return (
                  <tr key={p.id} className="border-b border-ink-850 last:border-0 hover:bg-ink-850/50">
                    <td className="px-4 py-3 text-ink-100">{p.name}</td>
                    <td className="px-4 py-3 tabular-nums-ltr text-right">
                      {formatNumber(p.quantity_on_hand)} {p.unit}
                    </td>
                    <td className="px-4 py-3 tabular-nums-ltr text-right text-ink-400">{formatIQD(p.cost_price_iqd)}</td>
                    <td className="px-4 py-3 tabular-nums-ltr text-right text-brass-400">{formatIQD(p.sale_price_iqd)}</td>
                    <td className="px-4 py-3">
                      {low ? (
                        <Badge tone="danger">
                          <AlertTriangle className="ml-1 h-3 w-3" /> منخفض
                        </Badge>
                      ) : (
                        <Badge tone="success">متوفر</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
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
          <div>
            <Label>وحدة القياس</Label>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
    </div>
  )
}
