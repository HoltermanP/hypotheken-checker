import type { LenderProfile, RateRow } from "@/lib/engine/lenders/types"
import lendersSeed from "./seed/lenders.json"
import ratesSeed from "./seed/rates.json"

export const SEED_LENDERS = lendersSeed as unknown as LenderProfile[]
export const SEED_RATES = ratesSeed as unknown as RateRow[]
