import { useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/primitives'
import { asArray } from '@/lib/collections'

export function OrganizationSwitcher() {
  const { organizations, profile, switchOrganization, createOrganization } = useAuth()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const organizationRows = asArray(organizations)
  const [error, setError] = useState<string | null>(null)

  const active = organizationRows.find((o) => o.id === profile?.active_organization_id)

  async function change(id: string) {
    if (id === profile?.active_organization_id) {
      setOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    const result = await switchOrganization(id)
    if (result.error) setError(result.error)
    else setOpen(false)
    setBusy(false)
  }

  async function create() {
    if (name.trim().length < 2) {
      setError('اسم المتجر يجب أن يكون حرفين على الأقل.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await createOrganization(name)
    if (result.error) setError(result.error)
    else {
      setName('')
      setCreating(false)
      setOpen(false)
    }
    setBusy(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy || organizationRows.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-ink-800 bg-ink-850 px-3 py-2 text-right hover:border-ink-700 disabled:opacity-60"
        aria-expanded={open}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brass-500/15 text-brass-300">
          {active?.name?.slice(0, 1) ?? 'I'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-ink-100">{active?.name ?? 'متجري'}</p>
          <p className="truncate text-[10px] text-ink-500">{profile?.role === 'owner' ? 'مالك المتجر' : 'عضو'}</p>
        </div>
        <ChevronsUpDown className="h-4 w-4 text-ink-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-ink-700 bg-ink-900 p-2 shadow-2xl">
          <p className="px-2 py-1 text-[11px] text-ink-500">متاجرك</p>
          <div className="max-h-48 overflow-y-auto">
            {organizationRows.map((org) => (
              <button
                key={org.id}
                type="button"
                disabled={busy}
                onClick={() => void change(org.id)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-right hover:bg-ink-800"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-800 text-xs text-brass-300">{org.name.slice(0, 1)}</div>
                <span className="flex-1 truncate text-sm text-ink-200">{org.name}</span>
                {org.id === profile?.active_organization_id && <Check className="h-4 w-4 text-emerald-400" />}
              </button>
            ))}
          </div>

          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-xl border-t border-ink-800 px-2 pt-3 text-sm text-brass-400 hover:text-brass-300"
            >
              <Plus className="h-4 w-4" /> إنشاء متجر جديد
            </button>
          ) : (
            <div className="mt-2 space-y-2 border-t border-ink-800 pt-3">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المتجر الجديد" />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void create()} disabled={busy}>{busy ? 'جارٍ...' : 'إنشاء'}</Button>
                <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>إلغاء</Button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="px-2 pt-2 text-xs text-crimson-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
