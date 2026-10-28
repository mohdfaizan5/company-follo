import { sileo } from 'sileo'

type ToastOptions = { description?: string }

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Shared, intentionally small vocabulary for feedback after a user action. */
export const appToast = {
  success(title: string, options: ToastOptions = {}) {
    return sileo.success({ title, ...options })
  },
  info(title: string, options: ToastOptions = {}) {
    return sileo.info({ title, ...options })
  },
  warning(title: string, options: ToastOptions = {}) {
    return sileo.warning({ title, ...options })
  },
  error(title: string, error: unknown, fallback: string) {
    return sileo.error({ title, description: messageFrom(error, fallback), duration: 6000 })
  },
}
