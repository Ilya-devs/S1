import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input, Label, Card } from '@/components/ui/primitives'

export default function ResetPassword() {
  const { session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!session && !saved) setError('افتح رابط الاستعادة من بريدك الإلكتروني أولاً.')
  }, [session, saved])

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (password !== confirm) { setError('تأكيد كلمة المرور غير مطابق.'); return }
    const result = await updatePassword(password)
    if (result.error) setError(result.error)
    else { setSaved(true); setTimeout(() => navigate('/'), 500) }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="font-display text-lg font-semibold text-ink-50">تعيين كلمة مرور جديدة</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div><Label htmlFor="password">كلمة المرور الجديدة</Label><Input id="password" dir="ltr" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><Label htmlFor="confirm">تأكيد كلمة المرور</Label><Input id="confirm" dir="ltr" type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          {error && <p role="alert" className="text-xs text-crimson-400">{error}</p>}
          {saved && <p role="status" className="text-xs text-emerald-400">تم تحديث كلمة المرور.</p>}
          <Button className="w-full" disabled={!session || saved}>{saved ? 'تم الحفظ' : 'تحديث كلمة المرور'}</Button>
        </form>
      </Card>
    </div>
  )
}
