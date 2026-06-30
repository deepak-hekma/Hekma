// FHIR-shaped patient data structures and metadata for Hekma.

export type FhirCategory =
  | "Observation"
  | "MedicationStatement"
  | "MedicationRequest"
  | "Condition"
  | "Encounter"
  | "Immunization"
  | "AllergyIntolerance"
  | "Procedure";

export interface FhirRecord {
  id: string;
  resourceType: FhirCategory;
  title: string;
  date: string; // ISO
  subtitle?: string;
  status?: "normal" | "borderline" | "high" | "low" | "active" | "resolved" | "completed";
  provider?: string;
  fields: { label: string; value: string }[];
  notes?: string;
  raw: Record<string, unknown>;
}

export interface PatientSummary {
  id: string;
  name: string;
  age: number;
  pronouns: string;
  primaryCare: string;
  lastVisit: string;
  reason: string;
}

export const categoryMeta: Record<
  FhirCategory,
  { label: string; description: string; order: number }
> = {
  Observation: { label: "Labs & vitals", description: "Test results and measurements", order: 1 },
  MedicationStatement: { label: "Medications", description: "What you're currently taking", order: 2 },
  MedicationRequest: { label: "Medication Requests", description: "Prescription requests", order: 2 },
  Condition: { label: "Conditions", description: "Active and past diagnoses", order: 3 },
  Encounter: { label: "Visits", description: "Appointments and encounters", order: 4 },
  Immunization: { label: "Immunizations", description: "Vaccines on record", order: 5 },
  AllergyIntolerance: { label: "Allergies", description: "Known sensitivities", order: 6 },
  Procedure: { label: "Procedures", description: "Procedures on record", order: 7 },
};
