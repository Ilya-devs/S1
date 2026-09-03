import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Search, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Input, Label, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatIQD } from '@/lib/format'
import { asArray } from '@/lib/collections'

type Tab = 'customers' | 'suppliers'

export default function Debts() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('customers')
  const [search, setSearch] = useState('')
  const [payTarget, setPayTarget] = useState<{ id: string; name: string; balance: number } | null>(null)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: customerBalances, isLoading: loadingCustomers } = useQuery({
    queryKey: ['customer_balances'],
    queryFn: async () => {
      const { data } = await supabase.from('customer_balances').select('*').order('balance_iqd', { ascending: false })
      return data ?? []
    },
    enabled: tab === 'customers',
  })

  const { data: supplierBalances, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['supplier_balances'],
    queryFn: async () => {
      const { data } = await supabase.from('supplier_balances').select('*').order('balance_iqd', { ascending: false })
      return data ?? []
    },
    enabled: tab === 'suppliers',
  })

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!payTarget) return
      const value = Math.round(Number(amount) || 0)
      if (value <= 0) throw new Error('أدخل مبلغاً صحيحاً')
      const { error } = await supabase.rpc('record_debt_payment', {
        p_direction: tab === 'customers' ? 'from_customer' : 'to_supplier',
        p_customer_id: tab === 'customers' ? payTarget.id : null,
        p_supplier_id: tab === 'suppliers' ? payTarget.id : null,
        p_amount_iqd: value,
        p_method: 'cash',
        p_note: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer_balances'] })
      void qc.invalidateQueries({ queryKey: ['supplier_balances'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      setPayTarget(null)
      setAmount('')
    },
  })

  const rows =
    tab === 'customers'
      ? asArray(customerBalances).map((r) => ({ id: r.customer_id as string, name: r.name as string, balance: Number(r.balance_iqd) }))
      : asArray(supplierBalances).map((r) => ({ id: r.supplier_id as string, name: r.name as string, balance: Number(r.balance_iqd) }))

  const filtered = rows.filter((r) => r.name.includes(search) && r.balance !== 0)
  const isLoading = tab === 'customers' ? loadingCustomers : loadingSuppliers
  const totalOwed = filtered.reduce((s, r) => s + Math.max(0, r.balance), 0)

  return (
    <div>
      <PageHeader title="الديون" subtitle="متابعة وتسديد ديون الزبائن والموردين" />

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('customers')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'customers' ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800'
          }`}
        >
          ديون الزبائن (لنا)
        </button>
        <button
          onClick={() => setTab('suppliers')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'suppliers' ? 'bg-brass-500/15 text-brass-300' : 'text-ink-400 hover:bg-ink-800'
          }`}
        >
          ديون الموردين (علينا)
        </button>
      </div>

      <Card className="mb-4 flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-sm text-ink-400">
          <Wallet className="h-4 w-4 text-brass-400" />
          إجمالي {tab === 'customers' ? 'الديون المستحقة لنا' : 'الديون المستحقة علينا'}
        </div>
        <p className="tabular-nums-ltr text-lg font-semibold text-brass-400">{formatIQD(totalOwed)}</p>
      </Card>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <Input placeholder="ابحث بالاسم..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-ink-500">جارٍ التحميل...</p>}
        {filtered.map((r) => (
          <Card key={r.id} className="flex flex-col gap-3 p-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink-100">{r.name}</p>
              <Badge tone={r.balance > 0 ? 'danger' : 'success'}>{r.balance > 0 ? 'مدين' : 'له رصيد'}</Badge>
            </div>
            <p className="tabular-nums-ltr text-right text-xl font-semibold text-brass-400">{formatIQD(Math.abs(r.balance))}</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setPayTarget({ id: r.id, name: r.name, balance: r.balance })
                setAmount(String(Math.abs(r.balance)))
              }}
            >
              تسجيل تسديد
            </Button>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-ink-500">لا توجد ديون حالياً — كلشي مسدد 🎉</p>
        )}
      </div>

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={`تسديد دين — ${payTarget?.name ?? ''}`}>
        <div className="space-y-3">
          <div>
            <Label>المبلغ</Label>
            <Input dir="ltr" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {recordPayment.isError && (
            <p className="text-xs text-crimson-400">{(recordPayment.error as Error).message}</p>
          )}
          <Button
            className="w-full"
            disabled={saving || recordPayment.isPending}
            onClick={async () => {
              setSaving(true)
              await recordPayment.mutateAsync()
              setSaving(false)
            }}
          >
            {recordPayment.isPending ? 'جارٍ الحفظ...' : 'تأكيد التسديد'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
