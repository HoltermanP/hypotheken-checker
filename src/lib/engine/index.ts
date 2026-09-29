/**
 * HypotheekCheck NL — rekenkern. Pure, deterministische TypeScript-functies zonder I/O; draait
 * zowel op de server als in de browser (wat-als-modus). Het LLM rekent nooit.
 */
export { ENGINE_VERSION, runAdvice, collectNormKeys, type AdviceOutput, type EngineContext, type ApplicantSummary, type Lever } from "./advice"
export { applyOverrides, estimateReferenceRate, runScenarios, suggestScenarios, type ScenarioDefinition, type ScenarioOverrides, type ScenarioSummary } from "./scenarios/scenarios"
export type * from "./types"
export type { NormSet, NormMeta, NormValues, EnergyLabel } from "./norms"
export type { LenderProfile, RateRow } from "./lenders/types"
export type { TraceEntry } from "./trace"
export type { Check } from "./checks/checks"
export type { StressResult } from "./stress/stress"
export type { LenderRow, LenderComparison } from "./lenders/compare"
export type { YearRow, LoanPart } from "./loan/schedule"
