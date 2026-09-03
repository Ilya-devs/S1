import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input, Label, Card } from '@/components/ui/primitives'

function toArabicAuthError(message: string) {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  if (m.includes('email not confirmed')) return 'يجب تأكيد البريد الإلكتروني أولاً. تحقق من صندوق الوارد.'
  if (m.includes('too many requests')) return 'تم تجاوز عدد المحاولات. انتظر قليلاً ثم حاول مرة أخرى.'
  if (m.includes('network') || m.includes('fetch')) return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.'
  return `تعذر تسجيل الدخول: ${message}`
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await signIn(email.trim(), password)
    if (result.error) {
      setError(toArabicAuthError(result.error))
      setLoading(false)
      return
    }

    // AuthContext updates the session; navigate explicitly because /login
    // otherwise remains mounted after a successful sign-in.
    navigate('/', { replace: true })
    setLoading(false)
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center">
          <img src="/icons/icon-192.png" alt="ILYA" className="h-16 w-16 rounded-2xl shadow-[var(--shadow-glow-brass)]" />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink-50">ILYA — نظام محاسبي</h1>
          <p className="mt-1 text-sm text-ink-500">سجّل الدخول لمتابعة عملك</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs text-crimson-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-ink-500">
          ليس لديك حساب؟{' '}
          <Link to="/register" className="text-brass-500 hover:underline">إنشاء حساب جديد</Link>
        </p>

        <p className="mt-6 text-center text-[11px] text-ink-600">
          جميع الحقوق محفوظة —{' '}
          <a href="https://ILYA-3.pages.dev/" target="_blank" rel="noreferrer" className="text-brass-500 hover:underline">
            ILYA dev
          </a>
        </p>
      </div>
    </div>
  )
}
