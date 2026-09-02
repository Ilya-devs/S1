import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the diagnostic useful without logging secrets or user data.
    console.error('[ILYA] Unhandled application error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main dir="rtl" className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-4 text-ink-100">
        <section className="w-full max-w-lg rounded-2xl border border-ink-800 bg-ink-900 p-6 shadow-[var(--shadow-panel)]">
          <h1 className="text-lg font-semibold text-ink-50">تعذر تشغيل التطبيق</h1>
          <p className="mt-2 text-sm leading-6 text-ink-400">
            حدث خطأ غير متوقع أثناء تشغيل الواجهة. أعد تحميل الصفحة. إذا استمرت المشكلة، افتح أدوات المطور
            وراجع أول خطأ في Console.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-ink-950 p-3 text-left text-xs text-crimson-400" dir="ltr">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 h-10 rounded-xl bg-brass-500 px-4 text-sm font-medium text-ink-950"
          >
            إعادة تحميل
          </button>
        </section>
      </main>
    )
  }
}
