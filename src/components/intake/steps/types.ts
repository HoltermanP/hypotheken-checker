import type { StepKey } from "@/lib/intake/schema"

export interface StepProps<T> {
  dossierId: string
  defaults: T
  prev: StepKey | null
  optional?: boolean
  context: {
    goal: string
    hasPartner: boolean
    names: string[]
    calcYear: number
    isDga: boolean
    entrepreneurs: boolean[]
  }
}
