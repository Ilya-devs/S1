interface StartupScreenProps {
  title: string
  message: string
  action?: string
}

export function StartupScreen({ title, message, action }: StartupScreenProps) {
  return (
    <main dir="rtl" className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-5 text-ink-100">
      <section className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-panel">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brass-500/10 text-brass-400">I</div>
          <div>
            <h1 className="font-semibold">{title}</h1>
            <p className="text-xs text-ink-500">ILYA — نظام محاسبي متكامل</p>
          </div>
        </div>
        <p className="text-sm leading-7 text-ink-300">{message}</p>
        {action && <p className="mt-4 rounded-xl bg-ink-950 p-3 text-xs leading-6 text-ink-400">{action}</p>}
      </section>
    </main>
  )
}
