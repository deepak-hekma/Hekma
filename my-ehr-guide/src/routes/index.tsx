import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { 
  MessageCircle, X, LayoutDashboard, FolderHeart, 
  FlaskConical, BookOpen, User, History, ArrowLeft 
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { RecordsSidebar } from "@/components/records/RecordsSidebar";
import { RecordDetail } from "@/components/records/RecordDetail";
import { OverviewDashboard } from "@/components/records/OverviewDashboard";
import { ChatPanel, type ChatPanelHandle } from "@/components/chat/ChatPanel";
import { 
  TrialMatchView, 
  ResourcesView, 
  HealthConnectView, 
  HealthSummaryView, 
  StitchModal 
} from "@/components/records/Subviews";
import type { FhirRecord, PatientSummary } from "@/lib/mockFhir";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hekma — Your health, in your words" },
      {
        name: "description",
        content:
          "Hekma is a warm, private space to read your medical records and ask questions about your health.",
      },
      { property: "og:title", content: "Hekma — Your health, in your words" },
      {
        property: "og:description",
        content:
          "A patient-facing assistant that helps you understand your own medical records.",
      },
    ],
  }),
  component: Index,
});

type ActiveView = 
  | "dashboard" 
  | "medicalhistory" 
  | "trialmatch" 
  | "resources" 
  | "healthsummary" 
  | "fastenhealth";

function Index() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [stitchModalOpen, setStitchModalOpen] = useState(false);
  const [stitchModalTitle, setStitchModalTitle] = useState("Connect Portal");
  
  // Medical History Sub-tabs (when selectedId is null)
  const [medHistoryParentTab, setMedHistoryParentTab] = useState<"details" | "history" | "audit">("history");
  const [medHistoryCategoryTab, setMedHistoryCategoryTab] = useState<"conditions" | "medications" | "labs" | "vitals">("conditions");

  const [chatPrefillText, setChatPrefillText] = useState<string | null>(null);
  const [chatAttachRecord, setChatAttachRecord] = useState<FhirRecord | null>(null);

  const chatRef = useRef<ChatPanelHandle>(null);

  // React Query: Fetch Patients
  const { data: patients = [], isLoading: loadingPatients, error: patientError } = useQuery<PatientSummary[]>({
    queryKey: ["patients"],
    queryFn: async () => {
      const res = await fetch("/api/patients");
      if (!res.ok) throw new Error("Failed to fetch patients");
      return res.json();
    },
    retry: 1
  });

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Auto-select first patient when patients load
  useEffect(() => {
    if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  // React Query: Fetch Records
  const { data: records = [], isLoading: loadingRecords } = useQuery<FhirRecord[]>({
    queryKey: ["records", selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      const res = await fetch(`/api/patients/${selectedPatientId}/records`);
      if (!res.ok) throw new Error("Failed to fetch records");
      return res.json();
    },
    enabled: !!selectedPatientId
  });

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];
  const selected = selectedId ? records.find((r) => r.id === selectedId) ?? null : null;

  const handleSelectPatient = (p: PatientSummary) => {
    setSelectedPatientId(p.id);
    setSelectedId(null);
  };

  const handleAsk = (r: FhirRecord) => {
    setChatAttachRecord(r);
    setChatPrefillText(`Can you explain my ${r.title}?`);
    setChatOpen(true);
  };

  const handleSuggestion = (q: string) => {
    setChatPrefillText(q);
    setChatOpen(true);
  };

  const handleSourceClick = (id: string) => {
    setSelectedId(id);
    setActiveView("medicalhistory");
  };

  const handleSelectRecord = (id: string) => {
    setSelectedId(id);
    setActiveView("medicalhistory");
  };

  const handleOpenStitchModal = (title: string) => {
    setStitchModalTitle(title);
    setStitchModalOpen(true);
  };

  // 1. Loading State
  if (loadingPatients) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="animate-spin size-8 rounded-full border-4 border-sage border-t-transparent mx-auto"></div>
          <div className="text-sm text-muted-foreground">Connecting to Hekma database...</div>
        </div>
      </div>
    );
  }

  // 2. Empty State / Connection Error
  if (patients.length === 0 || patientError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-4 animate-fade-up">
        <div className="max-w-md text-center space-y-5 border border-border bg-card p-8 rounded-2xl shadow-xl">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50 text-amber-600">
            <X className="size-6" />
          </div>
          <h1 className="font-serif text-3xl text-ink">Welcome to Hekma</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No patients were found in the database. Please ensure your <strong>Neo4j database server</strong> is running and run the ETL ingestion script to load the Synthea data:
          </p>
          <pre className="bg-ink/95 text-background p-3.5 rounded-xl text-xs font-mono select-all text-left overflow-x-auto shadow-inner">
            python backend/etl.py
          </pre>
          <div className="pt-3">
            <button 
              onClick={() => window.location.reload()} 
              className="inline-flex items-center justify-center rounded-xl bg-sage px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sage/30 hover:bg-sage/90 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ensure selectedPatient is available before rendering
  if (!selectedPatient || !selectedPatientId) {
    return null;
  }

  // Filter lists for Medical History Sub-tabs
  const filteredConditions = records.filter(r => r.resourceType === "Condition");
  const filteredMedications = records.filter(r => r.resourceType === "MedicationStatement" || r.resourceType === "MedicationRequest");
  const filteredLabs = records.filter(r => r.resourceType === "Observation" && !r.title.toLowerCase().includes("blood pressure") && !r.title.toLowerCase().includes("heart rate") && !r.title.toLowerCase().includes("temperature"));
  const filteredVitals = records.filter(r => r.resourceType === "Observation" && (r.title.toLowerCase().includes("blood pressure") || r.title.toLowerCase().includes("heart rate") || r.title.toLowerCase().includes("temperature")));

  return (
    <div className="flex h-dvh flex-col bg-background text-ink">
      <TopBar patient={selectedPatient} />
      
      <div 
        className={`grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] transition-all duration-300 ${
          chatOpen 
            ? "lg:grid-cols-[280px_minmax(0,1fr)_360px] xl:grid-cols-[300px_minmax(0,1fr)_400px]" 
            : "lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]"
        }`}
      >
        {/* Left Column: Combined Main Navigation & Records Category list */}
        <div className="hidden min-h-0 flex-col border-r border-border md:flex bg-card">
          {/* Main App Navigation Section */}
          <div className="p-4 border-b border-border space-y-1">
            <button
              onClick={() => { setActiveView("dashboard"); setSelectedId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeView === "dashboard"
                  ? "bg-sage/10 text-sage"
                  : "text-muted-foreground hover:bg-muted/10 hover:text-ink"
              }`}
            >
              <LayoutDashboard className="h-4.5 w-4.5" /> Dashboard
            </button>
            <button
              onClick={() => { setActiveView("medicalhistory"); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeView === "medicalhistory"
                  ? "bg-sage/10 text-sage"
                  : "text-muted-foreground hover:bg-muted/10 hover:text-ink"
              }`}
            >
              <FolderHeart className="h-4.5 w-4.5" /> Medical History
            </button>
            <button
              onClick={() => { setActiveView("trialmatch"); setSelectedId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeView === "trialmatch"
                  ? "bg-sage/10 text-sage"
                  : "text-muted-foreground hover:bg-muted/10 hover:text-ink"
              }`}
            >
              <FlaskConical className="h-4.5 w-4.5" /> Trial Match
            </button>
            <button
              onClick={() => { setActiveView("resources"); setSelectedId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeView === "resources"
                  ? "bg-sage/10 text-sage"
                  : "text-muted-foreground hover:bg-muted/10 hover:text-ink"
              }`}
            >
              <BookOpen className="h-4.5 w-4.5" /> Resources
            </button>
          </div>

          {/* Active Patient Selector (Bottom of Nav, above categories) */}
          <div className="border-b border-border p-3 bg-muted/20">
            <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Active Patient
            </label>
            <select
              value={selectedPatientId ?? ""}
              onChange={(e) => {
                const p = patients.find((p) => p.id === e.target.value);
                if (p) handleSelectPatient(p);
              }}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium text-ink focus:border-sage focus:outline-none cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Records Categories Sidebar (rendered ONLY under Medical History View) */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeView === "medicalhistory" ? (
              <RecordsSidebar
                records={records}
                selectedId={selectedId}
                onSelect={(r) => setSelectedId(r.id)}
              />
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground py-10 space-y-2">
                <p>Welcome to Hekma dashboard.</p>
                <p className="text-[10px] text-muted-foreground/80">Select "Medical History" to review individual medical record data sheets.</p>
              </div>
            )}
          </div>
        </div>

        {/* MAIN PANEL CONTENT */}
        <main className="min-h-0 overflow-y-auto">
          {activeView === "dashboard" && (
            <OverviewDashboard 
              patient={selectedPatient} 
              records={records} 
              onSuggestion={handleSuggestion} 
              onNavigate={(view) => {
                if (view === "healthsummary" || view === "fastenhealth") {
                  setActiveView(view);
                }
              }}
              onSelectRecord={handleSelectRecord}
            />
          )}

          {activeView === "trialmatch" && (
            <TrialMatchView 
              patient={selectedPatient} 
              records={records} 
              onBack={() => setActiveView("dashboard")} 
            />
          )}

          {activeView === "resources" && (
            <ResourcesView />
          )}

          {activeView === "healthsummary" && (
            <HealthSummaryView 
              patient={selectedPatient} 
              records={records} 
              onBack={() => setActiveView("dashboard")} 
            />
          )}

          {activeView === "fastenhealth" && (
            <HealthConnectView onOpenPortal={handleOpenStitchModal} />
          )}

          {activeView === "medicalhistory" && (
            selected ? (
              <div className="p-4 space-y-4">
                <button
                  onClick={() => setSelectedId(null)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ink transition-colors font-medium mb-2 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to History Overview
                </button>
                <RecordDetail record={selected} onAsk={handleAsk} />
              </div>
            ) : (
              // Replicating Production Medical History View (Tabs + Table grids)
              <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-6 animate-fade-up">
                <header className="space-y-1">
                  <h1 className="font-serif text-3xl text-ink">Medical History</h1>
                  <p className="text-sm text-muted-foreground">Demographics, clinical records logs, and system audit trail.</p>
                </header>

                {/* Parent Tabs */}
                <div className="flex border-b border-border gap-6 text-sm">
                  <button
                    onClick={() => setMedHistoryParentTab("details")}
                    className={`pb-2 border-b-2 font-semibold transition-colors cursor-pointer ${
                      medHistoryParentTab === "details" ? "border-sage text-sage" : "border-transparent text-muted-foreground hover:text-ink"
                    }`}
                  >
                    Patient Details
                  </button>
                  <button
                    onClick={() => setMedHistoryParentTab("history")}
                    className={`pb-2 border-b-2 font-semibold transition-colors cursor-pointer ${
                      medHistoryParentTab === "history" ? "border-sage text-sage" : "border-transparent text-muted-foreground hover:text-ink"
                    }`}
                  >
                    Medical History
                  </button>
                  <button
                    onClick={() => setMedHistoryParentTab("audit")}
                    className={`pb-2 border-b-2 font-semibold transition-colors cursor-pointer ${
                      medHistoryParentTab === "audit" ? "border-sage text-sage" : "border-transparent text-muted-foreground hover:text-ink"
                    }`}
                  >
                    Audit Trail
                  </button>
                </div>

                {/* Tab Contents */}
                {medHistoryParentTab === "details" && (
                  <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                    <h3 className="font-serif text-xl font-medium text-ink flex items-center gap-2"><User className="h-5 w-5 text-sage" /> Personal & Contact Information</h3>
                    <div className="grid gap-4 sm:grid-cols-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-medium">Full Name</label>
                        <input type="text" readOnly value={selectedPatient.name} className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-ink font-semibold" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-medium">Age</label>
                        <input type="text" readOnly value={`${selectedPatient.age} years old`} className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-ink font-semibold" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-medium">Pronouns</label>
                        <input type="text" readOnly value={selectedPatient.pronouns} className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-ink font-semibold" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-medium">Primary Care Doctor</label>
                        <input type="text" readOnly value={selectedPatient.primaryCare || "Dr. Renata Halloway"} className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-ink font-semibold" />
                      </div>
                    </div>
                  </div>
                )}

                {medHistoryParentTab === "history" && (
                  <div className="space-y-6">
                    {/* Inner Tabs */}
                    <div className="flex border-b border-border gap-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <button
                        onClick={() => setMedHistoryCategoryTab("conditions")}
                        className={`pb-2 border-b-2 cursor-pointer ${
                          medHistoryCategoryTab === "conditions" ? "border-sage text-sage" : "border-transparent hover:text-ink"
                        }`}
                      >
                        Conditions ({filteredConditions.length})
                      </button>
                      <button
                        onClick={() => setMedHistoryCategoryTab("medications")}
                        className={`pb-2 border-b-2 cursor-pointer ${
                          medHistoryCategoryTab === "medications" ? "border-sage text-sage" : "border-transparent hover:text-ink"
                        }`}
                      >
                        Medications ({filteredMedications.length})
                      </button>
                      <button
                        onClick={() => setMedHistoryCategoryTab("labs")}
                        className={`pb-2 border-b-2 cursor-pointer ${
                          medHistoryCategoryTab === "labs" ? "border-sage text-sage" : "border-transparent hover:text-ink"
                        }`}
                      >
                        Labs ({filteredLabs.length})
                      </button>
                      <button
                        onClick={() => setMedHistoryCategoryTab("vitals")}
                        className={`pb-2 border-b-2 cursor-pointer ${
                          medHistoryCategoryTab === "vitals" ? "border-sage text-sage" : "border-transparent hover:text-ink"
                        }`}
                      >
                        Vitals ({filteredVitals.length})
                      </button>
                    </div>

                    {/* Lists */}
                    {medHistoryCategoryTab === "conditions" && (
                      <div className="rounded-2xl border border-border bg-card divide-y divide-border text-xs">
                        {filteredConditions.map((c) => (
                          <div key={c.id} onClick={() => setSelectedId(c.id)} className="p-3.5 hover:bg-muted/10 flex justify-between items-center cursor-pointer transition-colors">
                            <span className="font-semibold text-ink">{c.title}</span>
                            <span className="text-muted-foreground">{new Date(c.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {medHistoryCategoryTab === "medications" && (
                      <div className="rounded-2xl border border-border bg-card divide-y divide-border text-xs">
                        {filteredMedications.map((m) => (
                          <div key={m.id} onClick={() => setSelectedId(m.id)} className="p-3.5 hover:bg-muted/10 flex justify-between items-center cursor-pointer transition-colors">
                            <span className="font-semibold text-ink">{m.title}</span>
                            <span className="text-muted-foreground">{new Date(m.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {medHistoryCategoryTab === "labs" && (
                      <div className="rounded-2xl border border-border bg-card divide-y divide-border text-xs">
                        {filteredLabs.length > 0 ? (
                          filteredLabs.map((l) => (
                            <div key={l.id} onClick={() => setSelectedId(l.id)} className="p-3.5 hover:bg-muted/10 flex justify-between items-center cursor-pointer transition-colors">
                              <span className="font-semibold text-ink">{l.title}</span>
                              <span className="text-muted-foreground">{new Date(l.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-muted-foreground">No laboratory records on file.</div>
                        )}
                      </div>
                    )}

                    {medHistoryCategoryTab === "vitals" && (
                      <div className="rounded-2xl border border-border bg-card divide-y divide-border text-xs">
                        {filteredVitals.map((v) => (
                          <div key={v.id} onClick={() => setSelectedId(v.id)} className="p-3.5 hover:bg-muted/10 flex justify-between items-center cursor-pointer transition-colors">
                            <span className="font-semibold text-ink">{v.title}</span>
                            <span className="text-muted-foreground font-mono">{v.subtitle || v.fields?.[0]?.value} ({new Date(v.date).toLocaleDateString("en-US", { year: "numeric", month: "short" })})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {medHistoryParentTab === "audit" && (
                  <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                    <h3 className="font-serif text-xl font-medium text-ink flex items-center gap-2"><History className="h-5 w-5 text-sage" /> System Access Logs</h3>
                    <div className="divide-y divide-border text-xs font-mono">
                      {[
                        { event: "FHIR records connection established", user: "Hekma App Integration", time: "Just now" },
                        { event: "Demographics profiles synchronized from hospital portal", user: "Hekma Auth Helper", time: "5 minutes ago" },
                        { event: "Clinical database updated securely", user: "Neo4j ETL Driver", time: "1 hour ago" }
                      ].map((log, i) => (
                        <div key={i} className="py-2.5 flex justify-between text-muted-foreground">
                          <span>{log.event} [{log.user}]</span>
                          <span>{log.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </main>
        
        {/* Desktop chat panel */}
        {chatOpen && (
          <div className="hidden min-h-0 lg:block border-l border-border animate-fade-in">
            <ChatPanel 
              ref={chatRef} 
              patientId={selectedPatientId} 
              records={records} 
              onSourceClick={handleSourceClick} 
              onClose={() => setChatOpen(false)}
              pendingQuestion={chatPrefillText}
              pendingRecord={chatAttachRecord}
              onClearPendingQuestion={() => setChatPrefillText(null)}
              onClearPendingRecord={() => setChatAttachRecord(null)}
            />
          </div>
        )}
      </div>

      {/* Mobile/tablet chat drawer */}
      <div className="lg:hidden">
        {chatOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm"
            onClick={() => setChatOpen(false)}
            aria-hidden
          />
        )}
        <div
          className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform bg-background shadow-2xl transition-transform duration-300 ${
            chatOpen ? "translate-x-0" : "translate-x-full"
          }`}
          role="dialog"
          aria-label="Hekma chat"
        >
          <button
            onClick={() => setChatOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-full p-2 text-ink/70 hover:bg-ink/5 cursor-pointer animate-fade-in"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="h-full">
            <ChatPanel
              ref={chatRef}
              patientId={selectedPatientId}
              records={records}
              onSourceClick={(id) => {
                handleSourceClick(id);
                setChatOpen(false);
              }}
              pendingQuestion={chatPrefillText}
              pendingRecord={chatAttachRecord}
              onClearPendingQuestion={() => setChatPrefillText(null)}
              onClearPendingRecord={() => setChatAttachRecord(null)}
            />
          </div>
        </div>
      </div>

      {/* Floating chatbot toggle button for both mobile and desktop when closed */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-sage px-5 py-3 text-sm font-medium text-white shadow-lg shadow-sage/30 hover:bg-sage/90 transition-all hover:scale-105 active:scale-95 cursor-pointer animate-fade-in"
          aria-label="Open Hekma chat"
        >
          <MessageCircle className="h-5 w-5" />
          Ask Hekma
        </button>
      )}

      {/* Stitch Connector Modal Dialog Overlay */}
      <StitchModal 
        isOpen={stitchModalOpen} 
        onClose={() => setStitchModalOpen(false)} 
        title={stitchModalTitle} 
      />
    </div>
  );
}
