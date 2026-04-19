import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type NoticeContextValue = {
  showNotice: (message: string) => void
}

const NoticeContext = createContext<NoticeContextValue | null>(null)

const AUTO_DISMISS_MS = 6000

export function NoticeToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (dismissTimer.current !== null) {
      clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }
  }, [])

  const showNotice = useCallback(
    (text: string) => {
      clearTimer()
      setMessage(text)
      dismissTimer.current = setTimeout(() => {
        setMessage(null)
        dismissTimer.current = null
      }, AUTO_DISMISS_MS)
    },
    [clearTimer],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  const value = useMemo(() => ({ showNotice }), [showNotice])

  return (
    <NoticeContext.Provider value={value}>
      {children}
      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto fixed bottom-5 left-1/2 z-[600] flex max-w-[min(100%,420px)] -translate-x-1/2 items-start gap-3 rounded-lg border border-[#dfe5f0] bg-white px-4 py-3 text-left text-[13px] leading-snug text-[#2f3850] shadow-[0_12px_32px_rgba(51,63,92,0.22)]"
        >
          <span className="min-w-0 flex-1 pt-0.5">{message}</span>
          <button
            type="button"
            onClick={() => {
              clearTimer()
              setMessage(null)
            }}
            className="shrink-0 rounded-md border border-[#dfe5f0] bg-[#f8fafd] px-2 py-1 text-[12px] font-semibold text-[#4f5c73] hover:bg-[#eef2f8]"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </NoticeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotice(): NoticeContextValue {
  const ctx = useContext(NoticeContext)
  if (!ctx) {
    throw new Error('useNotice must be used within NoticeToastProvider')
  }
  return ctx
}
