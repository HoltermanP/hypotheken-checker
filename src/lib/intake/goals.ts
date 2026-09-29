/** Doelen van een dossier, met uitleg (gedeeld door server en client). */
export const GOAL_OPTIONS = [
  { value: "starter", label: "Mijn eerste woning kopen", text: "Je koopt voor het eerst een huis (starter)." },
  { value: "doorstromer", label: "Verhuizen: kopen én verkopen", text: "Je hebt een koopwoning en wilt een andere kopen." },
  { value: "oversluiten", label: "Mijn hypotheek oversluiten", text: "Een lagere rente of andere voorwaarden voor je huidige hypotheek." },
  { value: "verhogen", label: "Hypotheek verhogen of overwaarde opnemen", text: "Voor een verbouwing, verduurzaming of iets anders." },
  { value: "verkopen", label: "Alleen verkopen", text: "Wat houd je over na verkoop, en wat zijn je opties?" },
  { value: "orientatie", label: "Oriënteren: wat kan ik maximaal lenen?", text: "Nog geen woning op het oog." },
] as const
