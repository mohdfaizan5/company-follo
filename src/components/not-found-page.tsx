import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-black p-6 text-center">
      <img src="/404image.png" alt="" className="absolute inset-0 size-full object-cover opacity-70" />
      <div className="relative flex flex-col items-center gap-3 text-white">
        <p className="text-7xl font-bold tracking-tight">404</p>
        <p className="text-lg font-semibold">Page not found</p>
        <p className="max-w-sm text-sm text-white/70">This page doesn't exist, or you need to log in to see it.</p>
        <div className="mt-2 flex gap-2">
          <Button render={<Link to="/" />}>Go home</Button>
          <Button variant="secondary" render={<Link to="/login" />}>Log in</Button>
        </div>
      </div>
    </main>
  )
}
