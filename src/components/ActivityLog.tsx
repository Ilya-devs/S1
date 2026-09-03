import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, Badge } from '@/components/ui/primitives'
import { formatDateTime } from '@/lib/format'
import { asArray } from '@/lib/collections'

const labels: Record<string, string> = {
  customers: 'الزبائن', suppliers: 'الموردين', products: 'المنتجات',
  sales_invoices: 'فواتير البيع', purchase_invoices: 'فواتير الشراء',
  sales_returns: 'مرتجعات البيع', purchase_returns: 'مرتجعات الشراء',
  debt_payments: 'التسديدات', expenses: 'المصاريف',
}
const actions: Record<string, string> = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف', insert: 'إضافة', update: 'تعديل', delete: 'حذف' }

export function ActivityLog() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit_log'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_log').select('id,action,entity_table,created_at').order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-800 px-5 py-4">
        <History className="h-4 w-4 text-brass-400" />
        <div><p className="text-sm font-medium text-ink-100">سجل النشاط</p><p className="text-xs text-ink-500">آخر العمليات الحساسة في المتجر</p></div>
      </div>
      <div className="divide-y divide-ink-850">
        {isLoading && <p className="px-5 py-6 text-sm text-ink-500">جارٍ التحميل...</p>}
        {asArray(data).map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-5 py-3">
            <Badge tone="neutral">{actions[row.action] ?? row.action}</Badge>
            <span className="flex-1 text-sm text-ink-300">{labels[row.entity_table] ?? row.entity_table}</span>
            <span className="text-[11px] text-ink-500">{formatDateTime(row.created_at)}</span>
          </div>
        ))}
        {!isLoading && asArray(data).length === 0 && <p className="px-5 py-6 text-center text-sm text-ink-500">لا يوجد نشاط بعد</p>}
      </div>
    </Card>
  )
}
