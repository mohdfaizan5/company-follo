import blocksWave from '#/assets/icons/svg-spinners/blocks-wave.svg?raw'

export function LoadingState({ label }: { label: string }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background text-muted-foreground" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <span aria-hidden="true" className="text-primary text-5xl leading-none [&>svg]:size-[1em]" dangerouslySetInnerHTML={{ __html: blocksWave }} />
        <p className="text-sm">{label}</p>
      </div>
    </main>
  )
}
