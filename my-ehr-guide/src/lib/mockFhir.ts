// Mock FHIR-shaped patient data for the Hekma prototype.
// These objects are intentionally a slimmed subset of real FHIR resources.

export type FhirCategory =
  | "Observation"
  | "MedicationStatement"
  | "Condition"
  | "Encounter"
  | "Immunization"
  | "AllergyIntolerance";

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

export const patient = {
  id: "patient-1",
  name: "Amelia Chen",
  age: 42,
  pronouns: "she/her",
  primaryCare: "Dr. Renata Halloway",
  lastVisit: "2025-05-18",
};

export interface PatientSummary {
  id: string;
  name: string;
  age: number;
  pronouns: string;
  primaryCare: string;
  lastVisit: string;
  reason: string;
}

export const patients: PatientSummary[] = [
  {
    id: "patient-1",
    name: "Amelia Chen",
    age: 42,
    pronouns: "she/her",
    primaryCare: "Dr. Renata Halloway",
    lastVisit: "2025-05-18",
    reason: "Annual physical",
  },
  {
    id: "patient-2",
    name: "Marcus Okafor",
    age: 57,
    pronouns: "he/him",
    primaryCare: "Dr. Liu",
    lastVisit: "2025-04-02",
    reason: "Hypertension follow-up",
  },
  {
    id: "patient-3",
    name: "Priya Natarajan",
    age: 34,
    pronouns: "she/her",
    primaryCare: "Dr. Halloway",
    lastVisit: "2025-05-30",
    reason: "Thyroid review",
  },
  {
    id: "patient-4",
    name: "Jordan Reyes",
    age: 28,
    pronouns: "they/them",
    primaryCare: "Dr. Patel",
    lastVisit: "2025-06-10",
    reason: "Allergy consult",
  },
  {
    id: "patient-5",
    name: "Eleanor Whitfield",
    age: 71,
    pronouns: "she/her",
    primaryCare: "Dr. Halloway",
    lastVisit: "2025-05-22",
    reason: "Medication review",
  },
];

export const records: FhirRecord[] = [
  {
    id: "obs-hba1c-2025-03",
    resourceType: "Observation",
    title: "Hemoglobin A1c",
    date: "2025-03-12",
    subtitle: "6.4% · slightly elevated",
    status: "borderline",
    provider: "Bay Area Lab Partners",
    fields: [
      { label: "Result", value: "6.4 %" },
      { label: "Reference range", value: "4.0 – 5.6 %" },
      { label: "Interpretation", value: "Pre-diabetic range" },
      { label: "Collected", value: "Mar 12, 2025" },
    ],
    notes:
      "HbA1c reflects average blood sugar over the last ~3 months. A value of 6.4% sits in the pre-diabetic range; lifestyle changes are typically recommended.",
    raw: {
      resourceType: "Observation",
      code: { text: "Hemoglobin A1c", coding: [{ system: "http://loinc.org", code: "4548-4" }] },
      valueQuantity: { value: 6.4, unit: "%" },
      effectiveDateTime: "2025-03-12",
    },
  },
  {
    id: "obs-ldl-2025-03",
    resourceType: "Observation",
    title: "LDL Cholesterol",
    date: "2025-03-12",
    subtitle: "118 mg/dL · borderline",
    status: "borderline",
    provider: "Bay Area Lab Partners",
    fields: [
      { label: "Result", value: "118 mg/dL" },
      { label: "Reference range", value: "< 100 mg/dL" },
      { label: "Interpretation", value: "Borderline high" },
    ],
    raw: { resourceType: "Observation", code: { text: "LDL Cholesterol" }, valueQuantity: { value: 118, unit: "mg/dL" } },
  },
  {
    id: "obs-bp-2025-05",
    resourceType: "Observation",
    title: "Blood Pressure",
    date: "2025-05-18",
    subtitle: "128 / 82 mmHg",
    status: "normal",
    provider: "Dr. Renata Halloway",
    fields: [
      { label: "Systolic", value: "128 mmHg" },
      { label: "Diastolic", value: "82 mmHg" },
      { label: "Position", value: "Seated" },
    ],
    raw: { resourceType: "Observation", code: { text: "Blood Pressure" } },
  },
  {
    id: "obs-vitd-2025-02",
    resourceType: "Observation",
    title: "Vitamin D, 25-Hydroxy",
    date: "2025-02-04",
    subtitle: "22 ng/mL · low",
    status: "low",
    fields: [
      { label: "Result", value: "22 ng/mL" },
      { label: "Reference range", value: "30 – 100 ng/mL" },
    ],
    raw: { resourceType: "Observation" },
  },
  {
    id: "med-metformin",
    resourceType: "MedicationStatement",
    title: "Metformin 500 mg",
    date: "2025-03-15",
    subtitle: "Twice daily with meals",
    status: "active",
    provider: "Dr. Renata Halloway",
    fields: [
      { label: "Dose", value: "500 mg" },
      { label: "Frequency", value: "Twice daily" },
      { label: "Route", value: "Oral" },
      { label: "Started", value: "Mar 15, 2025" },
    ],
    notes:
      "Metformin lowers the amount of sugar your liver releases and helps your body respond to insulin. Common side effects are mild stomach upset, which usually improves over a couple of weeks.",
    raw: { resourceType: "MedicationStatement", medicationCodeableConcept: { text: "Metformin 500 mg" } },
  },
  {
    id: "med-atorva",
    resourceType: "MedicationStatement",
    title: "Atorvastatin 10 mg",
    date: "2024-11-02",
    subtitle: "Nightly",
    status: "active",
    fields: [
      { label: "Dose", value: "10 mg" },
      { label: "Frequency", value: "Once daily, at bedtime" },
      { label: "Started", value: "Nov 2, 2024" },
    ],
    raw: { resourceType: "MedicationStatement" },
  },
  {
    id: "med-vitd",
    resourceType: "MedicationStatement",
    title: "Vitamin D3 2000 IU",
    date: "2025-02-10",
    subtitle: "Daily supplement",
    status: "active",
    fields: [
      { label: "Dose", value: "2000 IU" },
      { label: "Frequency", value: "Once daily" },
    ],
    raw: { resourceType: "MedicationStatement" },
  },
  {
    id: "cond-prediab",
    resourceType: "Condition",
    title: "Pre-diabetes",
    date: "2025-03-15",
    subtitle: "Active diagnosis",
    status: "active",
    fields: [
      { label: "Onset", value: "Mar 2025" },
      { label: "Severity", value: "Mild" },
    ],
    notes: "Diagnosed based on HbA1c 6.4%. Plan: metformin, dietary changes, recheck in 3 months.",
    raw: { resourceType: "Condition" },
  },
  {
    id: "cond-hypothyroid",
    resourceType: "Condition",
    title: "Hypothyroidism",
    date: "2021-09-01",
    subtitle: "Stable on levothyroxine",
    status: "active",
    fields: [{ label: "Onset", value: "Sep 2021" }],
    raw: { resourceType: "Condition" },
  },
  {
    id: "enc-2025-05",
    resourceType: "Encounter",
    title: "Annual physical",
    date: "2025-05-18",
    subtitle: "Office visit · Dr. Halloway",
    status: "completed",
    provider: "Dr. Renata Halloway",
    fields: [
      { label: "Type", value: "Annual wellness exam" },
      { label: "Location", value: "Mission Bay Clinic" },
      { label: "Duration", value: "45 minutes" },
    ],
    notes: "Routine annual visit. Vitals stable. Discussed diet and exercise plan for pre-diabetes.",
    raw: { resourceType: "Encounter" },
  },
  {
    id: "enc-2025-03",
    resourceType: "Encounter",
    title: "Lab follow-up",
    date: "2025-03-15",
    subtitle: "Telehealth · Dr. Halloway",
    status: "completed",
    fields: [
      { label: "Type", value: "Follow-up" },
      { label: "Modality", value: "Video visit" },
    ],
    raw: { resourceType: "Encounter" },
  },
  {
    id: "imm-flu-2024",
    resourceType: "Immunization",
    title: "Influenza vaccine",
    date: "2024-10-08",
    subtitle: "Seasonal · 2024-2025",
    status: "completed",
    fields: [
      { label: "Vaccine", value: "Quadrivalent flu" },
      { label: "Site", value: "Left deltoid" },
    ],
    raw: { resourceType: "Immunization" },
  },
  {
    id: "imm-tdap-2023",
    resourceType: "Immunization",
    title: "Tdap booster",
    date: "2023-04-21",
    subtitle: "Next due 2033",
    status: "completed",
    fields: [{ label: "Vaccine", value: "Tdap" }],
    raw: { resourceType: "Immunization" },
  },
  {
    id: "allergy-penicillin",
    resourceType: "AllergyIntolerance",
    title: "Penicillin",
    date: "2010-06-01",
    subtitle: "Hives · moderate",
    status: "active",
    fields: [
      { label: "Reaction", value: "Hives, itching" },
      { label: "Severity", value: "Moderate" },
      { label: "First noted", value: "Jun 2010" },
    ],
    raw: { resourceType: "AllergyIntolerance" },
  },
  {
    id: "allergy-pollen",
    resourceType: "AllergyIntolerance",
    title: "Seasonal pollen",
    date: "2015-03-01",
    subtitle: "Mild rhinitis",
    status: "active",
    fields: [{ label: "Reaction", value: "Sneezing, watery eyes" }],
    raw: { resourceType: "AllergyIntolerance" },
  },
];

export const categoryMeta: Record<
  FhirCategory,
  { label: string; description: string; order: number }
> = {
  Observation: { label: "Labs & vitals", description: "Test results and measurements", order: 1 },
  MedicationStatement: { label: "Medications", description: "What you're currently taking", order: 2 },
  Condition: { label: "Conditions", description: "Active and past diagnoses", order: 3 },
  Encounter: { label: "Visits", description: "Appointments and encounters", order: 4 },
  Immunization: { label: "Immunizations", description: "Vaccines on record", order: 5 },
  AllergyIntolerance: { label: "Allergies", description: "Known sensitivities", order: 6 },
};

export function getRecordById(id: string): FhirRecord | undefined {
  return records.find((r) => r.id === id);
}
