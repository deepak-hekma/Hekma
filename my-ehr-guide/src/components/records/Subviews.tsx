import { useState, useMemo } from "react";
import { type FhirRecord } from "@/lib/mockFhir";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Search, Check, Download, ExternalLink, 
  Database, Shield, Link2, AlertTriangle, Activity
} from "lucide-react";

interface SubviewProps {
  patient: { id: string; name: string; age: number; pronouns: string };
  records: FhirRecord[];
  onBack: () => void;
}

// -------------------------------------------------------------
// 1. TRIAL MATCH VIEW
// -------------------------------------------------------------
export function TrialMatchView({ patient, records }: SubviewProps) {
  const [activeTab, setActiveTab] = useState<"find" | "previous">("find");
  const [searchTerm, setSearchTerm] = useState("");

  const activeConditions = useMemo(() => {
    return records
      .filter((r) => r.resourceType === "Condition" && r.status === "active")
      .map((r) => r.title.replace(/\s*\([^)]*\)/g, "").trim());
  }, [records]);

  // Mock trials database based on conditions
  const allTrials = [
    {
      id: "trial-1",
      title: "GLP-1 Receptor Agonists in Early Pre-diabetes Management",
      condition: "Pre-diabetes",
      phase: "Phase 3",
      location: "San Francisco, CA",
      matchScore: 98,
      status: "Recruiting"
    },
    {
      id: "trial-2",
      title: "Evaluation of Long-term Thyroid Hormone Replacement Therapies",
      condition: "Hypothyroidism",
      phase: "Phase 4",
      location: "Oakland Clinical Center",
      matchScore: 95,
      status: "Recruiting"
    },
    {
      id: "trial-3",
      title: "Dietary Intervention vs. Pharmacological Management in Glucose Regulation",
      condition: "Pre-diabetes",
      phase: "Phase 2",
      location: "Stanford Medical School",
      matchScore: 89,
      status: "Active, not recruiting"
    },
    {
      id: "trial-4",
      title: "Impact of Aerobic Exercise on Thyrotropin (TSH) Levels in Hypothyroid Patients",
      condition: "Hypothyroidism",
      phase: "Phase 2",
      location: "UCSF Health",
      matchScore: 92,
      status: "Recruiting"
    }
  ];

  const matchedTrials = useMemo(() => {
    if (activeConditions.length === 0) return [];
    return allTrials.filter(trial => 
      activeConditions.some(cond => 
        trial.condition.toLowerCase().includes(cond.toLowerCase()) ||
        cond.toLowerCase().includes(trial.condition.toLowerCase())
      ) &&
      (searchTerm === "" || trial.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [activeConditions, searchTerm]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8 animate-fade-up">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl text-ink">Clinical Trial Match</h1>
        <p className="text-sm text-muted-foreground">
          Find experimental treatments and research studies matched to your diagnosed conditions.
        </p>
      </header>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("find")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "find"
              ? "border-sage text-sage font-semibold"
              : "border-transparent text-muted-foreground hover:text-ink"
          }`}
        >
          Find your Trial Match
        </button>
        <button
          onClick={() => setActiveTab("previous")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "previous"
              ? "border-sage text-sage font-semibold"
              : "border-transparent text-muted-foreground hover:text-ink"
          }`}
        >
          Previous Trial Matches
        </button>
      </div>

      {activeTab === "find" ? (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search matches or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-full border border-border bg-card py-2 pl-10 pr-4 text-sm focus:border-sage focus:outline-none"
            />
          </div>

          {matchedTrials.length > 0 ? (
            <div className="grid gap-4">
              {matchedTrials.map((trial) => (
                <div key={trial.id} className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-sage/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-semibold text-sage">
                        {trial.phase}
                      </div>
                      <h3 className="font-serif text-lg font-medium text-ink leading-snug">{trial.title}</h3>
                      <p className="text-xs text-muted-foreground">{trial.location} · Matched for: <strong>{trial.condition}</strong></p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-serif font-bold text-sage">{trial.matchScore}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Match Score</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 rounded-full bg-emerald-500"></span>
                      {trial.status}
                    </span>
                    <Button size="sm" className="rounded-full bg-sage hover:bg-sage/90 text-white">
                      Apply for Screening
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border border-dashed p-10 text-center space-y-2">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-500/80" />
              <h3 className="font-medium text-ink text-sm">No matched clinical trials found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {activeConditions.length === 0 
                  ? "We couldn't detect any ongoing medical conditions on your profile to run matching queries."
                  : `We searched for clinical trials matching: ${activeConditions.join(", ")}, but no recruiting studies were found in your region.`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground py-10">
          No previous trial applications or match reviews on record.
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 2. RESOURCES VIEW
// -------------------------------------------------------------
export function ResourcesView() {
  const resources = [
    {
      title: "Understanding Your A1c Levels",
      category: "Diabetes",
      type: "Article",
      summary: "An educational guide explaining what hemoglobin A1c is, normal ranges, and pre-diabetes management tips.",
      link: "https://www.diabetes.org"
    },
    {
      title: "Living with Hypothyroidism",
      category: "Thyroid Health",
      type: "Guide",
      summary: "Essential guidance on diet, hormone replacement absorption, and managing symptoms of hypothyroidism.",
      link: "https://www.thyroid.org"
    },
    {
      title: "Medication Safety & Management at Home",
      category: "General Health",
      type: "Video",
      summary: "Best practices on organizing prescriptions, managing side effects, and safe medicine storage.",
      link: "https://medlineplus.gov"
    },
    {
      title: "Cardiovascular Health: Nutritional Pathways",
      category: "Cardiology",
      type: "Dietary Guide",
      summary: "Heart-healthy dietary structures designed to improve lipid panels and regulate blood pressure.",
      link: "https://www.heart.org"
    }
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8 animate-fade-up">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl text-ink">Health Resources</h1>
        <p className="text-sm text-muted-foreground">
          Hand-picked educational references and literature based on your clinical profile.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Resource Name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Summary</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resources.map((res, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-4 font-medium text-ink">{res.title}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-full bg-sage-soft px-2.5 py-0.5 text-xs text-sage font-medium">
                      {res.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{res.type}</td>
                  <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs leading-relaxed">{res.summary}</td>
                  <td className="px-5 py-4">
                    <a
                      href={res.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-sage hover:underline"
                    >
                      Learn More <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 3. HEALTH CONNECT VIEW
// -------------------------------------------------------------
export function HealthConnectView({ onOpenPortal }: { onOpenPortal: (title: string) => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8 animate-fade-up">
      <header className="space-y-2 text-center max-w-lg mx-auto">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-sage-soft text-sage mb-2">
          <Database className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-3xl text-ink">Connect to Health Systems</h1>
        <p className="text-sm text-muted-foreground">
          Import your medical records securely from patient portals or national network feeds.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 flex flex-col justify-between hover:border-sage/40 transition-all shadow-sm">
          <div className="space-y-2">
            <h3 className="font-serif text-xl font-medium text-ink">Connect Provider Portal</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sync records directly from hospital systems, clinics, or private labs (e.g. MyChart, Kaiser, Quest Diagnostics).
            </p>
          </div>
          <Button 
            onClick={() => onOpenPortal("Provider Portal Connections")}
            className="w-full rounded-xl bg-sage hover:bg-sage/90 text-white font-medium shadow-md shadow-sage/10 cursor-pointer"
          >
            Connect Portal
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 flex flex-col justify-between hover:border-sage/40 transition-all shadow-sm">
          <div className="space-y-2">
            <h3 className="font-serif text-xl font-medium text-ink">National Health Networks</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Retrieve records via national trust frameworks and networks like Carequality, CommonWell, or eHealth Exchange.
            </p>
          </div>
          <Button 
            onClick={() => onOpenPortal("National Health Networks")}
            className="w-full rounded-xl bg-ink hover:bg-ink/90 text-white font-medium shadow-md shadow-ink/10 cursor-pointer"
          >
            Connect Network
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted/10 p-5 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-sage" /> HIPAA Secure Integration
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Hekma connects securely using standard SMART-on-FHIR and OAuth protocols. Your credentials are never stored or seen by us. All health data is encrypted in transit and rest.
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 4. HEALTH SUMMARY VIEW
// -------------------------------------------------------------
export function HealthSummaryView({ patient, records, onBack }: SubviewProps) {
  const counts = useMemo(() => {
    return {
      total: records.length,
      conditions: records.filter((r) => r.resourceType === "Condition").length,
      medications: records.filter((r) => r.resourceType === "MedicationStatement" || r.resourceType === "MedicationRequest").length,
      observations: records.filter((r) => r.resourceType === "Observation").length,
      encounters: records.filter((r) => r.resourceType === "Encounter").length,
      immunizations: records.filter((r) => r.resourceType === "Immunization").length,
      allergies: records.filter((r) => r.resourceType === "AllergyIntolerance").length,
    };
  }, [records]);

  const activeConditions = useMemo(() => {
    return records.filter((r) => r.resourceType === "Condition" && r.status === "active");
  }, [records]);

  const activeMedications = useMemo(() => {
    return records.filter((r) => (r.resourceType === "MedicationStatement" || r.resourceType === "MedicationRequest") && r.status === "active");
  }, [records]);

  const timelineData = useMemo(() => {
    // Collect records that have dates, sort them chronological
    return [...records]
      .filter((r) => r.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8); // Take last 8 records to display on graph
  }, [records]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8 animate-fade-up print:px-0 print:py-0 print:text-black">
      {/* Header controls (hidden on print) */}
      <div className="flex items-center justify-between border-b border-border pb-4 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
        <Button 
          onClick={handlePrint}
          className="rounded-full border border-sage/40 bg-card hover:bg-sage-soft text-sage flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="h-4 w-4" /> Save as PDF
        </Button>
      </div>

      <header className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-sage font-semibold">Clinical Records Summary</div>
        <h1 className="font-serif text-4xl text-ink leading-tight">{patient.name}</h1>
        <p className="text-sm text-muted-foreground">
          Generated Summary Report · {patient.age} years old · {patient.pronouns}
        </p>
      </header>

      {/* Grid count stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="text-3xl font-serif font-bold text-ink">{counts.total}</div>
          <div className="text-xs text-muted-foreground">Total Records</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="text-3xl font-serif font-bold text-ink">{counts.conditions}</div>
          <div className="text-xs text-muted-foreground">Diagnoses</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="text-3xl font-serif font-bold text-ink">{counts.medications}</div>
          <div className="text-xs text-muted-foreground">Prescriptions</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="text-3xl font-serif font-bold text-ink">{counts.observations}</div>
          <div className="text-xs text-muted-foreground">Lab Tests & Vitals</div>
        </div>
      </section>

      {/* Narrative Clinical Overview */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h3 className="font-serif text-xl font-medium text-ink flex items-center gap-1.5">
          <Activity className="h-4.5 w-4.5 text-sage" /> Clinical Overview
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The patient is a {patient.age}-year-old individual presenting with {counts.conditions} medical condition{counts.conditions !== 1 && "s"} on file, currently managed with {counts.medications} active prescription{counts.medications !== 1 && "s"}. 
          Recent lab metrics and vital observations indicate clinical parameters are stable, with {counts.allergies} recorded allergy sensitivity. Follow-ups should target ongoing diagnoses and annual preventative reviews.
        </p>
      </section>

      {/* Timeline chart */}
      <section className="space-y-4">
        <h3 className="font-serif text-xl font-medium text-ink">Longitudinal Health Timeline</h3>
        <div className="rounded-2xl border border-border bg-card p-6">
          {timelineData.length > 0 ? (
            <div className="space-y-6">
              <div className="relative border-l-2 border-sage-soft ml-4 pl-6 space-y-6">
                {timelineData.map((t, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white border-2 border-sage">
                      <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                    </span>
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-muted-foreground">{new Date(t.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                      <h4 className="text-sm font-semibold text-ink leading-none">{t.title}</h4>
                      {t.subtitle && <p className="text-xs text-muted-foreground">{t.subtitle} · <span className="text-[10px] uppercase font-semibold text-muted-foreground/80">{t.resourceType}</span></p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">No historical timeline events on file.</div>
          )}
        </div>
      </section>

      {/* Diagnoses and Meds grid lists */}
      <section className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-serif text-lg font-medium text-ink border-b border-border pb-2">Active Diagnoses</h3>
          {activeConditions.length > 0 ? (
            <ul className="space-y-3">
              {activeConditions.map((c) => (
                <li key={c.id} className="text-sm space-y-0.5">
                  <div className="font-medium text-ink">{c.title}</div>
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{c.subtitle ?? "Active"}</span>
                    <span>Onset: {new Date(c.date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground">No active diagnoses on record.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-serif text-lg font-medium text-ink border-b border-border pb-2">Active Prescriptions</h3>
          {activeMedications.length > 0 ? (
            <ul className="space-y-3">
              {activeMedications.map((m) => (
                <li key={m.id} className="text-sm space-y-0.5">
                  <div className="font-medium text-ink">{m.title}</div>
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{m.subtitle ?? "Active"}</span>
                    <span>Started: {new Date(m.date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground">No active medications on record.</div>
          )}
        </div>
      </section>

      <footer className="hidden print:block text-center text-xs text-muted-foreground border-t border-border pt-4">
        Educational summary based on patient records. Created via Hekma AI.
      </footer>
    </div>
  );
}

// -------------------------------------------------------------
// 5. STITCH CONNECT MODAL OVERLAY
// -------------------------------------------------------------
export function StitchModal({ 
  isOpen, 
  onClose, 
  title 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string 
}) {
  const [step, setStep] = useState<"search" | "connect" | "success">("search");
  const [providerSearch, setProviderSearch] = useState("");

  const mockProviders = [
    "Mission Bay Clinic",
    "Bay Area Lab Partners",
    "UCSF Medical Center",
    "Kaiser Permanente Northern California",
    "Stanford Health Care",
    "Sutter Health"
  ].filter(p => p.toLowerCase().includes(providerSearch.toLowerCase()));

  const handleConnect = () => {
    setStep("connect");
    setTimeout(() => {
      setStep("success");
    }, 2500);
  };

  const handleClose = () => {
    setStep("search");
    setProviderSearch("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-scale-in"
        role="dialog"
      >
        <header className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="font-serif text-2xl text-ink">{title}</h3>
            <p className="text-xs text-muted-foreground">Secure FHIR Stitch Integration</p>
          </div>
          <button 
            onClick={handleClose}
            className="text-muted-foreground hover:text-ink text-2xl font-normal leading-none cursor-pointer"
          >
            &times;
          </button>
        </header>

        {step === "search" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search hospital or portal name..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-4 text-sm focus:border-sage focus:outline-none"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-background">
              {mockProviders.length > 0 ? (
                mockProviders.map((prov, i) => (
                  <button
                    key={i}
                    onClick={handleConnect}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-muted/10 transition-colors font-medium text-ink flex items-center justify-between cursor-pointer"
                  >
                    {prov} <Link2 className="h-3 w-3 text-sage" />
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No matching providers found.
                </div>
              )}
            </div>
          </div>
        )}

        {step === "connect" && (
          <div className="text-center py-6 space-y-4">
            <div className="animate-spin size-8 rounded-full border-4 border-sage border-t-transparent mx-auto"></div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-ink">Authorizing Connection...</h4>
              <p className="text-xs text-muted-foreground">Redirecting to healthcare portal secure credentials gateway.</p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-6 space-y-5">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="size-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-ink">Credentials Connected!</h4>
              <p className="text-xs text-muted-foreground">Your records have been successfully synched into Hekma.</p>
            </div>
            <Button
              onClick={handleClose}
              className="w-full rounded-xl bg-sage hover:bg-sage/90 text-white font-semibold cursor-pointer"
            >
              Finish Setup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
