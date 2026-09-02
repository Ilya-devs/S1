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
    console.error('[ILYA] Unhandled application error', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main dir="rtl" className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-5 text-ink-100">
        <section className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-panel">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-crimson-500/10 text-crimson-400">
            !
          </div>
          <h1 className="text-lg font-semibold">تعذر تشغيل التطبيق</h1>
          <p className="mt-2 text-sm leading-7 text-ink-300">
            حدث خطأ غير متوقع أثناء تشغيل الواجهة. أعد تحميل الصفحة. إذا استمر الخطأ، افتح أدوات المطور وسجل رسالة الخطأ لإصلاح السبب الجذري.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-ink-950 p-3 text-left text-xs text-crimson-300" dir="ltr">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-xl bg-brass-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brass-400"
          >
            إعادة تحميل التطبيق
          </button>
        </section>
      </main>
    )
  }
}
