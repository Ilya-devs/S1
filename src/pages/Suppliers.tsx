import { useState } from 'react'
import { asArray } from '@/lib/collections'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Plus, Search, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Supplier } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatIQD } from '@/lib/format'

export default function Suppliers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', address: '', opening_balance_iqd: '0' })

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name').limit(500)
      return (data ?? []) as Supplier[]
    },
  })

  const { data: balances } = useQuery({
    queryKey: ['supplier_balances'],
    queryFn: async () => {
      const { data } = await supabase.from('supplier_balances').select('*')
      return new Map(asArray(data).map((b) => [b.supplier_id, Number(b.balance_iqd)]))
    },
  })

  const createSupplier = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('suppliers').insert({
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        opening_balance_iqd: Math.round(Number(form.opening_balance_iqd) || 0),
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] })
      void qc.invalidateQueries({ queryKey: ['supplier_balances'] })
      setModalOpen(false)
      setForm({ name: '', phone: '', address: '', opening_balance_iqd: '0' })
    },
  })

  const filtered = asArray(suppliers).filter((s) => s.name.includes(search) || (s.phone ?? '').includes(search))

  return (
    <div>
      <PageHeader
        title="الموردين"
        subtitle={`${suppliers?.length ?? 0} مورد`}
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> مورد جديد
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <Input placeholder="ابحث بالاسم أو الهاتف..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-ink-500">جارٍ التحميل...</p>}
        {filtered.map((s) => {
          const balance = balances?.get(s.id) ?? s.opening_balance_iqd
          return (
            <Card key={s.id} className="p-4 animate-fade-up">
              <div className="flex items-start justify-between">
                <p className="font-medium text-ink-100">{s.name}</p>
                {balance > 0 ? (
                  <Badge tone="warning">مستحق علينا</Badge>
                ) : (
                  <Badge tone="neutral">مسدد</Badge>
                )}
              </div>
              {s.phone && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                  <Phone className="h-3 w-3" /> <span dir="ltr">{s.phone}</span>
                </p>
              )}
              <p className="mt-3 tabular-nums-ltr text-right text-lg font-semibold text-brass-400">
                {formatIQD(Math.abs(balance))}
              </p>
            </Card>
          )
        })}
        {!isLoading && filtered.length === 0 && <p className="text-sm text-ink-500">لا يوجد موردين مطابقين</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="إضافة مورد جديد">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            createSupplier.mutate()
          }}
        >
          <div>
            <Label>الاسم</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>رقم الهاتف</Label>
            <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>العنوان</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>رصيد افتتاحي (اختياري)</Label>
            <Input
              dir="ltr"
              type="number"
              value={form.opening_balance_iqd}
              onChange={(e) => setForm({ ...form, opening_balance_iqd: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={createSupplier.isPending}>
            {createSupplier.isPending ? 'جارٍ الحفظ...' : 'حفظ المورد'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
