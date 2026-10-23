import { Badge } from '#/components/ui/badge'
import { Card } from '#/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '#/components/ui/field'

/** Titled group of settings rows inside a coss Card, like the sections on the add and edit person pages. */
export function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="divide-y">{children}</Card>
    </section>
  )
}

/** One settings row: label (and hint) on the left, control on the right; stacks on phones. */
export function SettingsRow({ label, description, edited, children }: { label: string; description?: string; edited?: boolean; children: React.ReactNode }) {
  return (
    <Field className="grid gap-3 px-5 py-4 sm:grid-cols-2 sm:items-center sm:gap-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <FieldLabel>{label}{edited ? <Badge className="bg-primary/16 text-primary">Edited</Badge> : null}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </div>
      <div className="w-full min-w-0">{children}</div>
    </Field>
  )
}
