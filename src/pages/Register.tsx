import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input, Label, Card } from '@/components/ui/primitives'

function toArabicAuthError(message: string) {
  const m = message.toLowerCase()
  if (m.includes('password')) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'
  if (m.includes('already registered') || m.includes('already exists')) return 'هذا البريد الإلكتروني مسجل مسبقاً.'
  if (m.includes('invalid email')) return 'البريد الإلكتروني غير صالح.'
  if (m.includes('rate limit') || m.includes('too many')) return 'تم تجاوز عدد المحاولات. حاول لاحقاً.'
  if (m.includes('network') || m.includes('fetch')) return 'تعذر الاتصال بالخادم. تحقق من الإنترنت.'
  return `تعذر إنشاء الحساب: ${message}`
}

export default function Register() {
  const { signUp, acceptInvitation } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (fullName.trim().length < 2) {
      setError('أدخل الاسم الكامل.')
      return
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.')
      return
    }
    if (password !== confirm) {
      setError('تأكيد كلمة المرور غير مطابق.')
      return
    }

    setLoading(true)
    const result = await signUp(email, password, fullName)

    if (result.error) {
      setError(toArabicAuthError(result.error))
      setLoading(false)
      return
    }

    if (result.needsEmailConfirmation) {
      setSuccess('تم إنشاء الحساب. افتح رسالة التأكيد في بريدك الإلكتروني، ثم ارجع وسجّل الدخول.')
      setLoading(false)
      return
    }

    const params = new URLSearchParams(window.location.search)
    const inviteToken = params.get('invite') || localStorage.getItem('ilya_pending_invitation')
    if (inviteToken) {
      const inviteResult = await acceptInvitation(inviteToken)
      if (inviteResult.error) {
        // Keep the token so the user can retry from Login after email confirmation.
        localStorage.setItem('ilya_pending_invitation', inviteToken)
      } else {
        localStorage.removeItem('ilya_pending_invitation')
      }
    }
    navigate('/', { replace: true })
    setLoading(false)
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center">
          <img src="/icons/icon-192.png" alt="ILYA" className="h-16 w-16 rounded-2xl shadow-[var(--shadow-glow-brass)]" />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-50">إنشاء حساب — ILYA</h1>
          <p className="mt-1 text-sm text-ink-500">أنشئ حساب مستخدم جديد</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">الاسم الكامل</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم" />
            </div>
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" dir="ltr" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
              <Input id="confirm" type="password" dir="ltr" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>

            {error && <p role="alert" className="text-xs text-crimson-400">{error}</p>}
            {success && <p role="status" className="text-xs text-emerald-400">{success}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-ink-500">
          لديك حساب؟{' '}
          <Link to="/login" className="text-brass-500 hover:underline">تسجيل الدخول</Link>
        </p>
      </div>
    </div>
  )
}
