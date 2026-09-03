import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input, Label, Card } from '@/components/ui/primitives'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError(null); setMessage(null)
    const result = await resetPassword(email)
    if (result.error) setError(result.error)
    else setMessage('إذا كان البريد مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور.')
    setLoading(false)
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="font-display text-lg font-semibold text-ink-50">استعادة كلمة المرور</h1>
        <p className="mt-1 text-sm text-ink-500">أدخل بريد حسابك لإرسال رابط الاستعادة.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div><Label htmlFor="email">البريد الإلكتروني</Label><Input id="email" dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {error && <p role="alert" className="text-xs text-crimson-400">{error}</p>}
          {message && <p role="status" className="text-xs text-emerald-400">{message}</p>}
          <Button className="w-full" disabled={loading}>{loading ? 'جارٍ الإرسال...' : 'إرسال الرابط'}</Button>
        </form>
        <Link to="/login" className="mt-4 block text-center text-sm text-brass-400 hover:underline">العودة لتسجيل الدخول</Link>
      </Card>
    </div>
  )
}
