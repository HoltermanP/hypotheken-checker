"use client"

import { useId, useState, type ReactNode } from "react"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatNumber, parseEuroInput } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Formuliervelden voor de wizard. Elk veld heeft een label, een korte uitleg waarom we het vragen
 * (aria-describedby) en een foutmelding (aria-invalid + role="alert").
 */

export function FieldShell({
  id,
  label,
  help,
  error,
  children,
  className,
}: {
  id: string
  label: ReactNode
  help?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function describedBy(id: string, help?: ReactNode, error?: string) {
  return [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined
}

type Common<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: ReactNode
  help?: ReactNode
  className?: string
}

/** Bedrag in euro's. Toont "1.234,56"; accepteert ook "1234.56" en "€ 1.234". */
export function MoneyField<T extends FieldValues>({
  control,
  name,
  label,
  help,
  className,
  allowNegative = false,
  nullable = false,
  suffix = "€",
}: Common<T> & { allowNegative?: boolean; nullable?: boolean; suffix?: string }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} help={help} error={fieldState.error?.message} className={className}>
          <MoneyInput
            id={id}
            value={field.value as number | null | undefined}
            onChange={(v) => field.onChange(v === null && !nullable ? 0 : v)}
            onBlur={field.onBlur}
            allowNegative={allowNegative}
            invalid={!!fieldState.error}
            describedBy={describedBy(id, help, fieldState.error?.message)}
            prefix={suffix}
          />
        </FieldShell>
      )}
    />
  )
}

export function MoneyInput({
  id,
  value,
  onChange,
  onBlur,
  allowNegative,
  invalid,
  describedBy: aria,
  prefix = "€",
}: {
  id: string
  value: number | null | undefined
  onChange: (v: number | null) => void
  onBlur?: () => void
  allowNegative?: boolean
  invalid?: boolean
  describedBy?: string
  prefix?: string
}) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value === null || value === undefined ? "" : formatNumber(value, Number.isInteger(value) ? 0 : 2))
  return (
    <div className="relative">
      {prefix ? (
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className={cn(prefix ? "pl-7" : undefined, "tabular-nums")}
        value={shown}
        aria-invalid={invalid || undefined}
        aria-describedby={aria}
        onChange={(e) => {
          setText(e.target.value)
          const raw = allowNegative ? e.target.value : e.target.value.replace(/-/g, "")
          onChange(parseEuroInput(raw))
        }}
        onBlur={() => {
          setText(null)
          onBlur?.()
        }}
      />
    </div>
  )
}

export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  help,
  className,
  step = 1,
  min,
  max,
  unit,
  nullable = false,
}: Common<T> & { step?: number; min?: number; max?: number; unit?: string; nullable?: boolean }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} help={help} error={fieldState.error?.message} className={className}>
          <div className="flex items-center gap-2">
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              step={step}
              min={min}
              max={max}
              value={field.value === null || field.value === undefined ? "" : String(field.value)}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value.replace(",", "."))
                field.onChange(v === null ? (nullable ? null : 0) : v)
              }}
              onBlur={field.onBlur}
              aria-invalid={!!fieldState.error || undefined}
              aria-describedby={describedBy(id, help, fieldState.error?.message)}
              className="tabular-nums"
            />
            {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
          </div>
        </FieldShell>
      )}
    />
  )
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  help,
  className,
  type = "text",
  autoComplete,
}: Common<T> & { type?: "text" | "date" | "email"; autoComplete?: string }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} help={help} error={fieldState.error?.message} className={className}>
          <Input
            id={id}
            type={type}
            autoComplete={autoComplete}
            value={(field.value as string | null | undefined) ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            aria-invalid={!!fieldState.error || undefined}
            aria-describedby={describedBy(id, help, fieldState.error?.message)}
          />
        </FieldShell>
      )}
    />
  )
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  help,
  className,
  options,
  numeric = false,
}: Common<T> & { options: { value: string | number; label: string }[]; numeric?: boolean }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} help={help} error={fieldState.error?.message} className={className}>
          <select
            id={id}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={field.value === null || field.value === undefined ? "" : String(field.value)}
            onChange={(e) => field.onChange(numeric ? Number(e.target.value) : e.target.value)}
            onBlur={field.onBlur}
            aria-invalid={!!fieldState.error || undefined}
            aria-describedby={describedBy(id, help, fieldState.error?.message)}
          >
            {options.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldShell>
      )}
    />
  )
}

export function CheckboxField<T extends FieldValues>({ control, name, label, help, className }: Common<T>) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={cn("flex items-start gap-2", className)}>
          <input
            id={id}
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--primary)]"
            checked={!!field.value}
            onChange={(e) => field.onChange(e.target.checked)}
            onBlur={field.onBlur}
            aria-describedby={help ? `${id}-help` : undefined}
          />
          <div>
            <Label htmlFor={id} className="font-normal">
              {label}
            </Label>
            {help ? (
              <p id={`${id}-help`} className="text-xs text-muted-foreground">
                {help}
              </p>
            ) : null}
          </div>
        </div>
      )}
    />
  )
}

export function FieldGroup({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {description ? <p className="-mt-2 text-sm text-muted-foreground">{description}</p> : null}
      {children}
    </fieldset>
  )
}
