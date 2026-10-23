import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Camera, CircleAlert, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { useUploadThing } from '#/lib/uploadthing'
import { cn } from '#/lib/utils'

export function EmployeePhotoUpload({ personId, enabled, children }: { personId: string; enabled: boolean; children?: React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const { startUpload, isUploading } = useUploadThing('employeePhoto', { onClientUploadComplete: () => { setError(''); void queryClient.invalidateQueries({ queryKey: ['person', personId] }) }, onUploadError: (uploadError) => setError(uploadError.message) })
  return <div><input ref={ref} className="sr-only" type="file" accept="image/*" aria-label="Upload profile photo" onChange={(event) => { const file = event.target.files?.[0]; if (file) void startUpload([file], { personId }); event.target.value = '' }} /><button type="button" className="group relative rounded-full disabled:cursor-not-allowed disabled:opacity-60" disabled={!enabled || isUploading} aria-label={isUploading ? 'Uploading photo' : 'Change profile photo'} onClick={() => ref.current?.click()}>{children ?? <span className="grid size-12 place-items-center rounded-full border"><Camera className="size-5" /></span>}<span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border bg-card text-foreground shadow-sm transition-colors group-hover:bg-accent"><Camera className="size-3" /></span></button>{error && <p className="mt-1 text-xs text-destructive">{error}</p>}</div>
}

export function EmployeeDocumentUpload({ personId, enabled }: { personId: string; enabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'offer_letter' | 'employment_document' | 'identity' | 'other'>('employment_document')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const queryClient = useQueryClient()
  const { startUpload, isUploading } = useUploadThing('employeeDocument', { onClientUploadComplete: () => { setName(''); setError(''); void queryClient.invalidateQueries({ queryKey: ['person', personId] }) }, onUploadError: (uploadError) => setError(uploadError.message) })
  const blocked = !enabled || isUploading
  // Falls back to the file name so a document never needs a name typed first.
  function upload(file: File | undefined) {
    if (!file || blocked) return
    void startUpload([file], { personId, displayName: name.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 120), kind })
  }
  return <div className="flex flex-col gap-4">
    {/* Hidden native picker shared by the dropzone and the Upload button */}
    <input ref={ref} className="sr-only" type="file" accept="application/pdf,image/*" aria-label="Choose employee document" onChange={(event) => { upload(event.target.files?.[0]); event.target.value = '' }} />
    {/* Dropzone: click or drop a file */}
    <button
      type="button"
      disabled={blocked}
      onClick={() => ref.current?.click()}
      onDragOver={(event) => { event.preventDefault(); if (!blocked) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files[0]) }}
      className={cn('flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-64 disabled:hover:bg-transparent', dragging && 'border-primary bg-primary/5')}
    >
      <span className="mb-1 grid size-10 place-items-center rounded-lg border bg-card text-foreground shadow-sm/5"><Upload className="size-4" aria-hidden="true" /></span>
      <span className="text-sm font-medium">Drop a file here, or <span className="text-primary">browse</span></span>
      <span className="text-sm text-muted-foreground">Contracts, IDs or other private files for this record</span>
    </button>
    {/* Name, type and upload action */}
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field><FieldLabel>Document name</FieldLabel><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Signed offer letter" maxLength={120} /></Field>
      <Field><FieldLabel>Type</FieldLabel><NativeSelect className="w-full" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><NativeSelectOption value="employment_document">Employment document</NativeSelectOption><NativeSelectOption value="offer_letter">Offer letter</NativeSelectOption><NativeSelectOption value="identity">Identity</NativeSelectOption><NativeSelectOption value="other">Other</NativeSelectOption></NativeSelect></Field>
      <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={blocked} loading={isUploading} onClick={() => ref.current?.click()}><ArrowUp data-icon="inline-start" />Upload</Button>
    </div>
    {/* Shown until UploadThing is configured for the workspace */}
    {!enabled && <Alert variant="warning"><CircleAlert /><AlertDescription>Uploads aren&apos;t set up for this workspace yet. Set UPLOADTHING_TOKEN on the server to turn them on.</AlertDescription></Alert>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}

/** Upload and Remove buttons for the profile photo, used on the edit page next to the avatar preview. */
export function EmployeePhotoActions({ personId, enabled, hasPhoto }: { personId: string; enabled: boolean; hasPhoto: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(false)
  const queryClient = useQueryClient()
  const { startUpload, isUploading } = useUploadThing('employeePhoto', { onClientUploadComplete: () => { setError(''); void queryClient.invalidateQueries({ queryKey: ['person', personId] }) }, onUploadError: (uploadError) => setError(uploadError.message) })
  async function remove() {
    setRemoving(true)
    setError('')
    try {
      const response = await fetch(`/api/people/${personId}/photo`, { method: 'DELETE' })
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? 'Could not remove the photo.')
      await queryClient.invalidateQueries({ queryKey: ['person', personId] })
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the photo.')
    } finally {
      setRemoving(false)
    }
  }
  return <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <input ref={ref} className="sr-only" type="file" accept="image/*" aria-label="Upload profile photo" onChange={(event) => { const file = event.target.files?.[0]; if (file) void startUpload([file], { personId }); event.target.value = '' }} />
      <Button type="button" variant="outline" disabled={!enabled || isUploading} loading={isUploading} title={enabled ? undefined : 'Uploads are not set up for this workspace yet.'} onClick={() => ref.current?.click()}>Upload</Button>
      <Button type="button" variant="ghost" className="text-muted-foreground" disabled={!hasPhoto || removing} loading={removing} onClick={() => void remove()}>Remove</Button>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </div>
}
