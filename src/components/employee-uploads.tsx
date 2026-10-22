import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Upload } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { useUploadThing } from '#/lib/uploadthing'

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
  const queryClient = useQueryClient()
  const { startUpload, isUploading } = useUploadThing('employeeDocument', { onClientUploadComplete: () => { setName(''); setError(''); void queryClient.invalidateQueries({ queryKey: ['person', personId] }) }, onUploadError: (uploadError) => setError(uploadError.message) })
  return <div className="mt-5 space-y-3 border-t pt-4">
    <label className="block text-xs font-medium">Document name<Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Signed offer letter" maxLength={120} /></label>
    <label className="block text-xs font-medium">Type<NativeSelect className="mt-1" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><NativeSelectOption value="employment_document">Employment document</NativeSelectOption><NativeSelectOption value="offer_letter">Offer letter</NativeSelectOption><NativeSelectOption value="identity">Identity</NativeSelectOption><NativeSelectOption value="other">Other</NativeSelectOption></NativeSelect></label>
    <input ref={ref} className="sr-only" type="file" accept="application/pdf,image/*" aria-label="Choose employee document" onChange={(event) => { const file = event.target.files?.[0]; if (file) void startUpload([file], { personId, displayName: name.trim(), kind }); event.target.value = '' }} />
    <Button size="sm" variant="outline" disabled={!enabled || !name.trim() || isUploading} onClick={() => ref.current?.click()}><Upload data-icon="inline-start" />{isUploading ? 'Uploading…' : 'Upload file'}</Button>
    {!enabled && <p className="text-xs text-muted-foreground">Set UPLOADTHING_TOKEN on the server to enable uploads.</p>}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
}
