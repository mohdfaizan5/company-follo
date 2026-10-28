import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Camera, CircleAlert, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { useUploadThing } from '#/lib/uploadthing'
import { cn } from '#/lib/utils'
import { appToast } from '#/lib/toast'

const PHOTO_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/avif'
const PHOTO_MAX_BYTES = 8 * 1024 * 1024

async function getUploadConfiguration() {
  const response = await fetch('/api/upload-config')
  if (!response.ok) return false
  const payload = (await response.json().catch(() => null)) as {
    enabled?: boolean
  } | null
  return Boolean(payload?.enabled)
}

function uploadErrorMessage(error: { message: string }) {
  if (
    error.message.includes('Failed to parse response from UploadThing server')
  ) {
    return 'The upload server returned an invalid response. Check the UploadThing token and restart the server.'
  }
  return error.message
}

/** The file picker's accept list is only a hint, so check the file before uploading it as a photo. */
function photoError(file: File) {
  if (!PHOTO_TYPES.split(',').includes(file.type))
    return 'Choose a PNG, JPG, WebP, GIF or AVIF image for the photo.'
  if (file.size > PHOTO_MAX_BYTES) return 'Photos can be up to 8 MB.'
  return ''
}

export function EmployeePhotoUpload({
  personId,
  enabled,
  children,
}: {
  personId: string
  enabled: boolean
  children?: React.ReactNode
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const { startUpload, isUploading } = useUploadThing('employeePhoto', {
    onClientUploadComplete: () => {
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['person', personId] })
      appToast.success('Profile photo updated')
    },
    onUploadError: (uploadError) => {
      setError(uploadError.message)
      appToast.error(
        'Photo not uploaded',
        uploadError,
        'Could not upload the photo.',
      )
    },
  })
  return (
    <div>
      <input
        ref={ref}
        className="sr-only"
        type="file"
        accept={PHOTO_TYPES}
        aria-label="Upload profile photo"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          const problem = photoError(file)
          setError(problem)
          if (!problem) void startUpload([file], { personId })
        }}
      />
      <button
        type="button"
        className="group relative rounded-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!enabled || isUploading}
        aria-label={isUploading ? 'Uploading photo' : 'Change profile photo'}
        onClick={() => ref.current?.click()}
      >
        {children ?? (
          <span className="grid size-12 place-items-center rounded-full border">
            <Camera className="size-5" />
          </span>
        )}
        <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border bg-card text-foreground shadow-sm transition-colors group-hover:bg-accent">
          <Camera className="size-3" />
        </span>
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function EmployeeDocumentUpload({
  personId,
  enabled,
}: {
  personId: string
  enabled: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<
    'offer_letter' | 'employment_document' | 'identity' | 'other'
  >('employment_document')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const queryClient = useQueryClient()
  const { startUpload, isUploading } = useUploadThing('employeeDocument', {
    onClientUploadComplete: () => {
      setName('')
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['person', personId] })
      appToast.success('Document uploaded')
    },
    onUploadError: (uploadError) => {
      setError(uploadError.message)
      appToast.error(
        'Document not uploaded',
        uploadError,
        'Could not upload the document.',
      )
    },
  })
  const blocked = !enabled || isUploading
  // Falls back to the file name so a document never needs a name typed first.
  function upload(file: File | undefined) {
    if (!file || blocked) return
    void startUpload([file], {
      personId,
      displayName:
        name.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 120),
      kind,
    })
  }
  return (
    <div className="flex flex-col gap-4">
      {/* Hidden native picker shared by the dropzone and the Upload button */}
      <input
        ref={ref}
        className="sr-only"
        type="file"
        accept="application/pdf,image/*"
        aria-label="Choose employee document"
        onChange={(event) => {
          upload(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      {/* Dropzone: click or drop a file */}
      <button
        type="button"
        disabled={blocked}
        onClick={() => ref.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          if (!blocked) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          upload(event.dataTransfer.files[0])
        }}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-64 disabled:hover:bg-transparent',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <span className="mb-1 grid size-10 place-items-center rounded-lg border bg-card text-foreground shadow-sm/5">
          <Upload className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium">
          Drop a file here, or <span className="text-primary">browse</span>
        </span>
        <span className="text-sm text-muted-foreground">
          Contracts, IDs or other private files for this record
        </span>
      </button>
      {/* Name, type and upload action */}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field>
          <FieldLabel>Document name</FieldLabel>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Signed offer letter"
            maxLength={120}
          />
        </Field>
        <Field>
          <FieldLabel>Type</FieldLabel>
          <NativeSelect
            className="w-full"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <NativeSelectOption value="employment_document">
              Employment document
            </NativeSelectOption>
            <NativeSelectOption value="offer_letter">
              Offer letter
            </NativeSelectOption>
            <NativeSelectOption value="identity">Identity</NativeSelectOption>
            <NativeSelectOption value="other">Other</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={blocked}
          loading={isUploading}
          onClick={() => ref.current?.click()}
        >
          <ArrowUp data-icon="inline-start" />
          Upload
        </Button>
      </div>
      {/* Shown until UploadThing is configured for the workspace */}
      {!enabled && (
        <Alert variant="warning">
          <CircleAlert />
          <AlertDescription>
            Uploads aren&apos;t set up for this workspace yet. Set
            UPLOADTHING_TOKEN on the server to turn them on.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Upload and Remove buttons for the profile photo, used on the edit page next to the avatar preview. */
export function EmployeePhotoActions({
  personId,
  enabled,
  hasPhoto,
}: {
  personId: string
  enabled: boolean
  hasPhoto: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(false)
  const queryClient = useQueryClient()
  const { startUpload, isUploading } = useUploadThing('employeePhoto', {
    onClientUploadComplete: () => {
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['person', personId] })
      appToast.success('Profile photo updated')
    },
    onUploadError: (uploadError) => {
      setError(uploadError.message)
      appToast.error(
        'Photo not uploaded',
        uploadError,
        'Could not upload the photo.',
      )
    },
  })
  async function remove() {
    setRemoving(true)
    setError('')
    try {
      const response = await fetch(`/api/people/${personId}/photo`, {
        method: 'DELETE',
      })
      if (!response.ok)
        throw new Error(
          ((await response.json()) as { error?: string }).error ??
            'Could not remove the photo.',
        )
      await queryClient.invalidateQueries({ queryKey: ['person', personId] })
      appToast.info('Profile photo removed')
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Could not remove the photo.',
      )
      appToast.error(
        'Photo not removed',
        removeError,
        'Could not remove the photo.',
      )
    } finally {
      setRemoving(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          className="sr-only"
          type="file"
          accept={PHOTO_TYPES}
          aria-label="Upload profile photo"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            const problem = photoError(file)
            setError(problem)
            if (!problem) void startUpload([file], { personId })
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!enabled || isUploading}
          loading={isUploading}
          title={
            enabled
              ? undefined
              : 'Uploads are not set up for this workspace yet.'
          }
          onClick={() => ref.current?.click()}
        >
          Upload
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          disabled={!hasPhoto || removing}
          loading={removing}
          onClick={() => void remove()}
        >
          Remove
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Company logo picker for Settings: preview, Upload and Remove. */
export function CompanyLogoUpload({
  logoUrl,
  companyName,
  canEdit,
}: {
  logoUrl?: string | null
  companyName: string
  canEdit: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(false)
  const queryClient = useQueryClient()
  const uploadConfiguration = useQuery({
    queryKey: ['upload-config'],
    queryFn: getUploadConfiguration,
    staleTime: 5 * 60_000,
  })
  const uploadsEnabled = uploadConfiguration.data === true
  const { startUpload, isUploading } = useUploadThing('companyLogo', {
    onClientUploadComplete: () => {
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['workspace'] })
      appToast.success('Company logo updated')
    },
    onUploadError: (uploadError) => {
      const message = uploadErrorMessage(uploadError)
      setError(message)
      appToast.error('Logo not uploaded', uploadError, message)
    },
  })
  async function remove() {
    setRemoving(true)
    try {
      const response = await fetch('/api/workspace', { method: 'DELETE' })
      if (!response.ok)
        throw new Error(
          ((await response.json()) as { error?: string }).error ??
            'Could not remove the logo.',
        )
      await queryClient.invalidateQueries({ queryKey: ['workspace'] })
      appToast.info('Company logo removed')
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Could not remove the logo.',
      )
      appToast.error(
        'Logo not removed',
        removeError,
        'Could not remove the logo.',
      )
    } finally {
      setRemoving(false)
    }
  }
  return (
    <div className="flex items-center gap-4">
      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-lg font-semibold text-muted-foreground">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${companyName} logo`}
            className="size-full object-contain"
          />
        ) : (
          companyName.slice(0, 1).toUpperCase()
        )}
      </span>
      {canEdit && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={ref}
              className="sr-only"
              type="file"
              accept={PHOTO_TYPES}
              aria-label="Upload company logo"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                const problem =
                  file.size > 4 * 1024 * 1024
                    ? 'Logos can be up to 4 MB.'
                    : photoError(file)
                setError(problem)
                if (!problem) void startUpload([file])
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={isUploading}
              disabled={!uploadsEnabled || uploadConfiguration.isPending}
              title={
                !uploadsEnabled && !uploadConfiguration.isPending
                  ? 'Uploads are not configured on this server.'
                  : undefined
              }
              onClick={() => ref.current?.click()}
            >
              <Upload data-icon="inline-start" />
              {logoUrl ? 'Change logo' : 'Upload logo'}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                loading={removing}
                onClick={() => void remove()}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Square PNG, JPG or WebP, up to 4 MB.
          </p>
          {!uploadConfiguration.isPending && !uploadsEnabled && (
            <p role="alert" className="text-xs text-destructive">
              Uploads are not configured. Add UPLOADTHING_TOKEN and restart the
              server.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
