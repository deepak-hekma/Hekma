import { useState, useMemo } from "react";
import { type FhirRecord, type PatientSummary } from "@/lib/mockFhir";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, FileText, Link2, Search, Heart, 
  ChevronLeft, ChevronRight, Activity, ShieldAlert,
  ShieldCheck, HelpCircle, Calendar, Syringe
} from "lucide-react";

interface Props {
  patient: PatientSummary;
  records: FhirRecord[];
  onSuggestion: (q: string) => void;
  onNavigate: (view: string) => void;
  onSelectRecord: (id: string) => void;
}

const ITEMS_PER_PAGE = 5;

export function OverviewDashboard({ 
  patient, 
  records, 
  onSuggestion, 
  onNavigate, 
  onSelectRecord 
}: Props) {
  // Pagination States
  const [medsPage, setMedsPage] = useState(1);
  const [condsPage, setCondsPage] = useState(1);
  const [labsPage, setLabsPage] = useState(1);
  const [vitalsPage, setVitalsPage] = useState(1);
  const [allergiesPage, setAllergiesPage] = useState(1);
  const [proceduresPage, setProceduresPage] = useState(1);

  // Parse patient email and phone from backend record formats if available, otherwise fallback
  const patientEmail = (patient as any).email || `${patient.name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
  const patientPhone = (patient as any).telecom || (patient as any).phone || "555-019-2831";
  const patientId = patient.id.length > 8 ? patient.id.slice(0, 8).toUpperCase() : patient.id.toUpperCase();
  const address = (patient as any).address || "San Francisco, California, US";

  // Filter Categories
  const medications = useMemo(() => {
    return records.filter((r) => r.resourceType === "MedicationStatement" || r.resourceType === "MedicationRequest");
  }, [records]);

  const conditions = useMemo(() => {
    return records.filter((r) => r.resourceType === "Condition");
  }, [records]);

  const isVitalTitle = (title: string) => {
    const t = title.toLowerCase();
    return t.includes("blood pressure") || t.includes("heart rate") || 
           t.includes("temperature") || t.includes("respiratory rate") || 
           t.includes("weight") || t.includes("height") || 
           t.includes("body mass index") || t.includes("steps");
  };

  const labs = useMemo(() => {
    return records.filter((r) => r.resourceType === "Observation" && !isVitalTitle(r.title));
  }, [records]);

  const vitals = useMemo(() => {
    return records.filter((r) => r.resourceType === "Observation" && isVitalTitle(r.title));
  }, [records]);

  const allergies = useMemo(() => {
    return records.filter((r) => r.resourceType === "AllergyIntolerance");
  }, [records]);

  const immunizations = useMemo(() => {
    return records.filter((r) => r.resourceType === "Immunization");
  }, [records]);

  const procedures = useMemo(() => {
    // Encounters/Procedures
    return records.filter((r) => r.resourceType === "Encounter");
  }, [records]);

  // Extract Daily Activity Vitals values dynamically
  const dailyVitals = useMemo(() => {
    const bpRecord = records.find(r => r.title.toLowerCase().includes("blood pressure"));
    const glucoseRecord = records.find(r => r.title.toLowerCase().includes("glucose") || r.title.toLowerCase().includes("a1c"));
    const hrRecord = records.find(r => r.title.toLowerCase().includes("heart rate") || r.title.toLowerCase().includes("pulse"));
    
    return {
      bp: bpRecord ? bpRecord.subtitle || bpRecord.fields?.[0]?.value || "120/80 mmHg" : "120/80 mmHg",
      glucose: glucoseRecord ? glucoseRecord.subtitle || glucoseRecord.fields?.[0]?.value || "95 mg/dL" : "95 mg/dL",
      hr: hrRecord ? hrRecord.subtitle || hrRecord.fields?.[0]?.value || "72 bpm" : "72 bpm",
      steps: "8,432 steps" // Mock steps count since Synthea doesn't always contain steps
    };
  }, [records]);

  const suggestions = useMemo(() => {
    const list: string[] = [];

    // 1. Find conditions
    const activeConditions = records.filter((r) => r.resourceType === "Condition" && r.status === "active");
    const anyConditions = activeConditions.length > 0 ? activeConditions : records.filter((r) => r.resourceType === "Condition");
    if (anyConditions.length > 0) {
      const condName = anyConditions[0].title
        .replace(/\s*\([^)]*\)/g, "")
        .trim();
      list.push(`What is ${condName}?`);
      list.push(`How is my ${condName} managed?`);
    }

    // 2. Find medications
    const meds = records.filter(
      (r) =>
        r.resourceType === "MedicationStatement" ||
        r.resourceType === "MedicationRequest",
    );
    if (meds.length > 0) {
      const medName = meds[0].title
        .split(" ")[0]
        .replace(/[,;]/g, "");
      list.push(`Why am I prescribed ${medName}?`);
    }

    // 3. Find recent lab observations
    const labsList = records.filter((r) => r.resourceType === "Observation" && !isVitalTitle(r.title));
    if (labsList.length > 0) {
      const obsName = labsList[0].title.toLowerCase();
      list.push(`What does my last ${obsName} result mean?`);
    }

    // 4. Find allergies
    const allergiesList = records.filter((r) => r.resourceType === "AllergyIntolerance");
    if (allergiesList.length > 0) {
      const allergyName = allergiesList[0].title.toLowerCase();
      list.push(`Do I have any allergies to ${allergyName}?`);
    }

    // Fallbacks
    const fallbacks = [
      "What diagnoses are on my profile?",
      "Explain my latest lab reports",
      "What medications am I taking?",
      "Do I have any allergies noted?",
    ];

    const merged = Array.from(new Set([...list, ...fallbacks]));
    return merged.slice(0, 4);
  }, [records]);

  // Helper paginator
  const paginate = (items: any[], currentPage: number) => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  };

  const renderPaginationControls = (
    totalItems: number, 
    currentPage: number, 
    setCurrentPage: (p: number) => void
  ) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-end gap-1.5 pt-2">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted/10 disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground font-mono">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted/10 disabled:opacity-30 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-6 animate-fade-up">
      {/* Top Header Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-0.5">
          <h1 className="font-serif text-3xl text-ink leading-tight">Patient Portal</h1>
          <p className="text-xs text-muted-foreground">Clinical Dashboard</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => window.location.reload()}
            variant="outline" 
            size="sm" 
            className="rounded-full border-sage/20 bg-card hover:bg-sage-soft text-sage flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button 
            onClick={() => onNavigate("healthsummary")}
            variant="outline" 
            size="sm" 
            className="rounded-full border-sage/20 bg-card hover:bg-sage-soft text-sage flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" /> Health Summary
          </Button>
          <Button 
            onClick={() => onNavigate("fastenhealth")}
            variant="outline" 
            size="sm" 
            className="rounded-full border-sage/20 bg-card hover:bg-sage-soft text-sage flex items-center gap-1.5 cursor-pointer"
          >
            <Link2 className="h-3.5 w-3.5" /> Health Connect
          </Button>
        </div>
      </header>

      {/* Welcome & Patient Info Banner */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden relative">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 rounded-full bg-sage-soft/30 blur-2xl -z-10" />
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-serif text-2xl text-ink">Welcome to Hekma!</h2>
            <p className="text-xs text-muted-foreground">All your clinical records synced and translated into simple terms.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 border-t border-border pt-4 text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Patient Name</span>
              <div className="font-semibold text-ink text-sm">{patient.name}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Patient ID</span>
              <div className="font-semibold font-mono text-ink text-sm">#{patientId}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Contact details</span>
              <div className="font-semibold text-ink">{patientPhone}</div>
              <div className="text-muted-foreground text-[10px]">{patientEmail}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Address</span>
              <div className="font-semibold text-ink leading-tight">{address}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Studies Section */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinical Studies Matched</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { area: "Oncology", match: "0%" },
            { area: "Cardiology", match: "0%" },
            { area: "Autoimmune", match: "0%" },
            { area: "Neurology", match: "0%" }
          ].map((study, idx) => (
            <div key={idx} className="rounded-xl bg-muted/20 p-3 space-y-1 text-center">
              <div className="text-2xl font-serif font-bold text-muted-foreground">{study.match}</div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground/80">{study.area} Match</div>
            </div>
          ))}
        </div>
      </section>

      {/* Two Column Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Medications Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-medium text-ink flex items-center justify-between border-b border-border pb-2">
              <span>Medications</span>
              <span className="text-xs text-muted-foreground font-mono">{medications.length} Prescribed</span>
            </h3>
            {medications.length > 0 ? (
              <div className="space-y-2">
                <ul className="divide-y divide-border text-xs">
                  {paginate(medications, medsPage).map((med) => (
                    <li 
                      key={med.id} 
                      onClick={() => onSelectRecord(med.id)}
                      className="py-2.5 flex items-center justify-between hover:bg-muted/10 rounded-lg px-2 cursor-pointer transition-colors"
                    >
                      <div className="font-medium text-ink pr-2">{med.title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{new Date(med.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">Active</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {renderPaginationControls(medications.length, medsPage, setMedsPage)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center">No active medications on file.</div>
            )}
          </div>

          {/* Conditions Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-medium text-ink flex items-center justify-between border-b border-border pb-2">
              <span>Medical Conditions</span>
              <span className="text-xs text-muted-foreground font-mono">{conditions.length} Ongoing</span>
            </h3>
            {conditions.length > 0 ? (
              <div className="space-y-2">
                <ul className="divide-y divide-border text-xs">
                  {paginate(conditions, condsPage).map((cond) => (
                    <li 
                      key={cond.id} 
                      onClick={() => onSelectRecord(cond.id)}
                      className="py-2.5 flex items-center justify-between hover:bg-muted/10 rounded-lg px-2 cursor-pointer transition-colors"
                    >
                      <div className="font-medium text-ink pr-2">{cond.title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{new Date(cond.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ${
                          cond.status === "resolved" 
                            ? "bg-muted text-muted-foreground" 
                            : "bg-sage-soft text-sage"
                        }`}>{cond.status || "Active"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {renderPaginationControls(conditions.length, condsPage, setCondsPage)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center">No conditions on file.</div>
            )}
          </div>

          {/* Lab Reports Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-medium text-ink flex items-center justify-between border-b border-border pb-2">
              <span>Lab Reports</span>
              <span className="text-xs text-muted-foreground font-mono">{labs.length} Records</span>
            </h3>
            {labs.length > 0 ? (
              <div className="space-y-2">
                <ul className="divide-y divide-border text-xs">
                  {paginate(labs, labsPage).map((lab) => (
                    <li 
                      key={lab.id} 
                      onClick={() => onSelectRecord(lab.id)}
                      className="py-2.5 flex items-center justify-between hover:bg-muted/10 rounded-lg px-2 cursor-pointer transition-colors"
                    >
                      <div className="font-medium text-ink pr-2">{lab.title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{new Date(lab.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                        <span className={`size-2 rounded-full ${
                          lab.status === "high" || lab.status === "low"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`} />
                      </div>
                    </li>
                  ))}
                </ul>
                {renderPaginationControls(labs.length, labsPage, setLabsPage)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center">No lab reports on file.</div>
            )}
          </div>

          {/* Vital Signs Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-medium text-ink flex items-center justify-between border-b border-border pb-2">
              <span>Vital Signs</span>
              <span className="text-xs text-muted-foreground font-mono">{vitals.length} Records</span>
            </h3>
            {vitals.length > 0 ? (
              <div className="space-y-2">
                <ul className="divide-y divide-border text-xs">
                  {paginate(vitals, vitalsPage).map((vit) => (
                    <li 
                      key={vit.id} 
                      onClick={() => onSelectRecord(vit.id)}
                      className="py-2.5 flex items-center justify-between hover:bg-muted/10 rounded-lg px-2 cursor-pointer transition-colors"
                    >
                      <div className="font-medium text-ink pr-2">{vit.title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-muted-foreground text-[10px] font-semibold">{vit.subtitle || vit.fields?.[0]?.value}</div>
                        <span className="text-[10px] text-muted-foreground">{new Date(vit.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {renderPaginationControls(vitals.length, vitalsPage, setVitalsPage)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center">No vital records on file.</div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Daily Activities Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-medium text-ink border-b border-border pb-2">Daily Activities</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-1 hover:border-sage/20 transition-all">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Blood Pressure</div>
                <div className="text-sm font-semibold text-ink">{dailyVitals.bp}</div>
                <div className="text-[9px] text-emerald-600 flex items-center gap-0.5"><Activity className="h-3 w-3" /> Normal</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-1 hover:border-sage/20 transition-all">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Blood Glucose</div>
                <div className="text-sm font-semibold text-ink">{dailyVitals.glucose}</div>
                <div className="text-[9px] text-emerald-600 flex items-center gap-0.5"><Activity className="h-3 w-3" /> Stable</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-1 hover:border-sage/20 transition-all">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Heart Rate</div>
                <div className="text-sm font-semibold text-ink">{dailyVitals.hr}</div>
                <div className="text-[9px] text-emerald-600 flex items-center gap-0.5"><Heart className="h-3 w-3 text-red-500 fill-red-500" /> Stable</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-1 hover:border-sage/20 transition-all">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Steps</div>
                <div className="text-sm font-semibold text-ink">{dailyVitals.steps}</div>
                <div className="text-[9px] text-muted-foreground">Daily Goal: 10k</div>
              </div>
            </div>
          </div>

          {/* Allergies Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-medium text-ink flex items-center justify-between border-b border-border pb-2">
              <span>Allergies</span>
              <span className="text-xs text-muted-foreground font-mono">{allergies.length} Records</span>
            </h3>
            {allergies.length > 0 ? (
              <div className="space-y-2">
                <ul className="divide-y divide-border text-xs">
                  {paginate(allergies, allergiesPage).map((all) => (
                    <li 
                      key={all.id} 
                      onClick={() => onSelectRecord(all.id)}
                      className="py-2.5 flex items-center justify-between hover:bg-muted/10 rounded-lg px-2 cursor-pointer transition-colors"
                    >
                      <div className="font-medium text-ink pr-2">{all.title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{all.subtitle || "Active"}</span>
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                      </div>
                    </li>
                  ))}
                </ul>
                {renderPaginationControls(allergies.length, allergiesPage, setAllergiesPage)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center flex items-center justify-center gap-1">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> No known drug allergies on file.
              </div>
            )}
          </div>

          {/* Immunizations Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-medium text-ink flex items-center justify-between border-b border-border pb-2">
              <span>Immunizations</span>
              <span className="text-xs text-muted-foreground font-mono">{immunizations.length} Vaccine{immunizations.length !== 1 && "s"}</span>
            </h3>
            {immunizations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {immunizations.map((imm) => (
                  <div 
                    key={imm.id}
                    onClick={() => onSelectRecord(imm.id)}
                    className="rounded-xl border border-border bg-muted/10 p-3 space-y-1 hover:border-sage/20 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Syringe className="h-3.5 w-3.5 text-sage" />
                      <div className="text-xs font-semibold text-ink truncate">{imm.title}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{new Date(imm.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
                    <div className="text-[9px] text-muted-foreground/80 truncate">{imm.subtitle}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center">No immunization records on file.</div>
            )}
          </div>

          {/* Procedures Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-medium text-ink flex items-center justify-between border-b border-border pb-2">
              <span>Visits & Procedures</span>
              <span className="text-xs text-muted-foreground font-mono">{procedures.length} Records</span>
            </h3>
            {procedures.length > 0 ? (
              <div className="space-y-2">
                <ul className="divide-y divide-border text-xs">
                  {paginate(procedures, proceduresPage).map((proc) => (
                    <li 
                      key={proc.id} 
                      onClick={() => onSelectRecord(proc.id)}
                      className="py-2.5 flex items-center justify-between hover:bg-muted/10 rounded-lg px-2 cursor-pointer transition-colors"
                    >
                      <div className="font-medium text-ink pr-2 truncate">{proc.title}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{new Date(proc.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </li>
                  ))}
                </ul>
                {renderPaginationControls(procedures.length, proceduresPage, setProceduresPage)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center">No clinical procedures on file.</div>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Questions (Try asking) */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try asking</h3>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              className="rounded-full border-sage/30 bg-card hover:bg-sage-soft cursor-pointer"
              onClick={() => onSuggestion(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
