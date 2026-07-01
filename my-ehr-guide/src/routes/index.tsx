import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { 
  MessageCircle, X, LayoutDashboard, FolderHeart, 
  FlaskConical, BookOpen, User, History, ArrowLeft, ChevronDown, Sparkles
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
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  const handleSuggestion = (q: string, recordId: string | null) => {
    setChatPrefillText(q);
    setChatAttachRecord(recordId ? records.find(r => r.id === recordId) || null : null);
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

  // Dynamic formatted date
  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fc] text-slate-800 font-sans selection:bg-brand-500 selection:text-white">
      {/* Sidebar - Bento style */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-full flex-shrink-0 z-20 hidden lg:flex shadow-[4px_0_24px_rgba(0,0,0,0.01)]">
        {/* Logo */}
        <div className="p-8 flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8">
            <span className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white font-extrabold text-base shadow-sm">
              <Sparkles className="size-4 fill-white text-white" />
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">Hekma</h1>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-2 space-y-2">
          <button
            onClick={() => { setActiveView("dashboard"); setSelectedId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl relative group transition-colors text-left cursor-pointer ${
              activeView === "dashboard"
                ? "bg-brand-50 text-brand-700 font-bold"
                : "text-slate-500 hover:bg-slate-50 font-semibold"
            }`}
          >
            {activeView === "dashboard" && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-500 rounded-r-full"></div>
            )}
            <LayoutDashboard className={`h-5 w-5 ${activeView === "dashboard" ? "text-brand-600" : "text-slate-400 group-hover:text-slate-700"}`} />
            <span className="text-sm">Dashboard</span>
          </button>
          
          <button
            onClick={() => { setActiveView("medicalhistory"); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl relative group transition-colors text-left cursor-pointer ${
              activeView === "medicalhistory"
                ? "bg-brand-50 text-brand-700 font-bold"
                : "text-slate-500 hover:bg-slate-50 font-semibold"
            }`}
          >
            {activeView === "medicalhistory" && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-500 rounded-r-full"></div>
            )}
            <div className="flex items-center gap-3">
              <FolderHeart className={`h-5 w-5 ${activeView === "medicalhistory" ? "text-brand-600" : "text-slate-400 group-hover:text-slate-700"}`} />
              <span className="text-sm">Patient 360</span>
            </div>
          </button>

          <button
            onClick={() => { setActiveView("trialmatch"); setSelectedId(null); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl relative group transition-colors text-left cursor-pointer ${
              activeView === "trialmatch"
                ? "bg-brand-50 text-brand-700 font-bold"
                : "text-slate-500 hover:bg-slate-50 font-semibold"
            }`}
          >
            {activeView === "trialmatch" && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-500 rounded-r-full"></div>
            )}
            <div className="flex items-center gap-3">
              <FlaskConical className={`h-5 w-5 ${activeView === "trialmatch" ? "text-brand-600" : "text-slate-400 group-hover:text-slate-700"}`} />
              <span className="text-sm">Trial Match</span>
            </div>
          </button>

          <button
            onClick={() => { setActiveView("resources"); setSelectedId(null); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl relative group transition-colors text-left cursor-pointer ${
              activeView === "resources"
                ? "bg-brand-50 text-brand-700 font-bold"
                : "text-slate-500 hover:bg-slate-50 font-semibold"
            }`}
          >
            {activeView === "resources" && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-500 rounded-r-full"></div>
            )}
            <div className="flex items-center gap-3">
              <BookOpen className={`h-5 w-5 ${activeView === "resources" ? "text-brand-600" : "text-slate-400 group-hover:text-slate-700"}`} />
              <span className="text-sm">Resources</span>
            </div>
          </button>
        </nav>

        {/* Sidebar records categories for medical history */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          {activeView === "medicalhistory" && (
            <RecordsSidebar
              records={records}
              selectedId={selectedId}
              onSelect={(r) => setSelectedId(r.id)}
            />
          )}
        </div>

        {/* Bottom Active Patient Selector / Profile */}
        <div className="p-6 mt-auto space-y-4">
          <div className="relative">
            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-1">
              Active Patient
            </label>
            
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors focus:border-brand-300 focus:outline-none cursor-pointer shadow-soft"
            >
              <span className="truncate">{selectedPatient?.name || "Select patient"}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setDropdownOpen(false)} 
                />
                <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-[350px] overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl animate-fade-in-up">
                  <ul className="py-1 text-xs text-slate-700 divide-y divide-slate-50">
                    {patients.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectPatient(p);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer ${
                            p.id === selectedPatientId ? "bg-brand-50 text-brand-700 font-bold" : ""
                          }`}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
              Dr
            </div>
            <div className="overflow-hidden">
              <h2 className="text-sm font-bold text-slate-800 truncate">Dr. Sarah</h2>
              <p className="text-xs text-slate-500">Clinical View</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between px-8 py-6 bg-[#f8f9fc]/85 backdrop-blur-md z-10 sticky top-0 flex-shrink-0">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1" id="current-date">{currentDateStr}</p>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Welcome back, Sarah</h2>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Search Bar */}
            <div className="hidden md:flex relative items-center">
              <span className="absolute left-4 text-slate-400">
                <LayoutDashboard className="size-4" />
              </span>
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="bg-white border-none shadow-soft rounded-full py-2.5 pl-10 pr-6 w-64 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all text-slate-600 placeholder-slate-400 font-medium"
              />
            </div>
            
            {/* Notification */}
            <button className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
              <Sparkles className="size-5" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-500 border-2 border-[#f8f9fc] rounded-full"></span>
            </button>
            
            {/* Profile Pic */}
            <img 
              src={`https://ui-avatars.com/api/?name=Sarah&background=c026d3&color=fff`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full shadow-sm cursor-pointer border-2 border-white"
            />
          </div>
        </header>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scroll px-8 pb-32">
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
              <div className="mx-auto w-full max-w-4xl py-6 space-y-6 animate-fade-up">
                <header className="space-y-1">
                  <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Medical History</h1>
                  <p className="text-sm text-slate-400 font-medium">Demographics, clinical records logs, and system audit trail.</p>
                </header>

                {/* Parent Tabs - Bento Style */}
                <div className="flex border-b border-slate-100 gap-6 text-sm">
                  <button
                    onClick={() => setMedHistoryParentTab("details")}
                    className={`pb-2 border-b-2 font-bold transition-colors cursor-pointer ${
                      medHistoryParentTab === "details" ? "border-brand-500 text-brand-600" : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    Patient Details
                  </button>
                  <button
                    onClick={() => setMedHistoryParentTab("history")}
                    className={`pb-2 border-b-2 font-bold transition-colors cursor-pointer ${
                      medHistoryParentTab === "history" ? "border-brand-500 text-brand-600" : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    Medical History
                  </button>
                  <button
                    onClick={() => setMedHistoryParentTab("audit")}
                    className={`pb-2 border-b-2 font-bold transition-colors cursor-pointer ${
                      medHistoryParentTab === "audit" ? "border-brand-500 text-brand-600" : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    Audit Trail
                  </button>
                </div>

                {/* Tab Contents */}
                {medHistoryParentTab === "details" && (
                  <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-soft space-y-5">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <User className="h-5 w-5 text-brand-500" /> Personal & Contact Information
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold uppercase tracking-wider">Full Name</label>
                        <input type="text" readOnly value={selectedPatient.name} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-slate-700 font-bold focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold uppercase tracking-wider">Age</label>
                        <input type="text" readOnly value={`${selectedPatient.age} years old`} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-slate-700 font-bold focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold uppercase tracking-wider">Pronouns</label>
                        <input type="text" readOnly value={selectedPatient.pronouns} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-slate-700 font-bold focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold uppercase tracking-wider">Primary Care Doctor</label>
                        <input type="text" readOnly value={selectedPatient.primaryCare || "Dr. Sarah"} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-slate-700 font-bold focus:outline-none" />
                      </div>
                    </div>
                  </div>
                )}

                {medHistoryParentTab === "history" && (
                  <div className="space-y-6">
                    {/* Inner Tabs */}
                    <div className="flex border-b border-slate-100 gap-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <button
                        onClick={() => setMedHistoryCategoryTab("conditions")}
                        className={`pb-2 border-b-2 cursor-pointer ${
                          medHistoryCategoryTab === "conditions" ? "border-brand-500 text-brand-600" : "border-transparent hover:text-slate-700"
                        }`}
                      >
                        Conditions ({filteredConditions.length})
                      </button>
                      <button
                        onClick={() => setMedHistoryCategoryTab("medications")}
                        className={`pb-2 border-b-2 cursor-pointer ${
                          medHistoryCategoryTab === "medications" ? "border-brand-500 text-brand-600" : "border-transparent hover:text-slate-700"
                        }`}
                      >
                        Medications ({filteredMedications.length})
                      </button>
                      <button
                        onClick={() => setMedHistoryCategoryTab("labs")}
                        className={`pb-2 border-b-2 cursor-pointer ${
                          medHistoryCategoryTab === "labs" ? "border-brand-500 text-brand-600" : "border-transparent hover:text-slate-700"
                        }`}
                      >
                        Labs ({filteredLabs.length})
                      </button>
                      <button
                        onClick={() => setMedHistoryCategoryTab("vitals")}
                        className={`pb-2 border-b-2 cursor-pointer ${
                          medHistoryCategoryTab === "vitals" ? "border-brand-500 text-brand-600" : "border-transparent hover:text-slate-700"
                        }`}
                      >
                        Vitals ({filteredVitals.length})
                      </button>
                    </div>

                    {/* Lists */}
                    {medHistoryCategoryTab === "conditions" && (
                      <div className="rounded-[32px] border border-slate-100 bg-white p-4 divide-y divide-slate-100 text-xs shadow-soft">
                        {filteredConditions.map((c) => (
                          <div key={c.id} onClick={() => setSelectedId(c.id)} className="p-3.5 hover:bg-slate-50 rounded-xl flex justify-between items-center cursor-pointer transition-colors">
                            <span className="font-bold text-slate-700">{c.title}</span>
                            <span className="text-slate-400 font-semibold">{new Date(c.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {medHistoryCategoryTab === "medications" && (
                      <div className="rounded-[32px] border border-slate-100 bg-white p-4 divide-y divide-slate-100 text-xs shadow-soft">
                        {filteredMedications.map((m) => (
                          <div key={m.id} onClick={() => setSelectedId(m.id)} className="p-3.5 hover:bg-slate-50 rounded-xl flex justify-between items-center cursor-pointer transition-colors">
                            <span className="font-bold text-slate-700">{m.title}</span>
                            <span className="text-slate-400 font-semibold">{new Date(m.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {medHistoryCategoryTab === "labs" && (
                      <div className="rounded-[32px] border border-slate-100 bg-white p-4 divide-y divide-slate-100 text-xs shadow-soft">
                        {filteredLabs.length > 0 ? (
                          filteredLabs.map((l) => (
                            <div key={l.id} onClick={() => setSelectedId(l.id)} className="p-3.5 hover:bg-slate-50 rounded-xl flex justify-between items-center cursor-pointer transition-colors">
                              <span className="font-bold text-slate-700">{l.title}</span>
                              <span className="text-slate-400 font-semibold">{new Date(l.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-slate-400 font-semibold">No laboratory records on file.</div>
                        )}
                      </div>
                    )}

                    {medHistoryCategoryTab === "vitals" && (
                      <div className="rounded-[32px] border border-slate-100 bg-white p-4 divide-y divide-slate-100 text-xs shadow-soft">
                        {filteredVitals.map((v) => (
                          <div key={v.id} onClick={() => setSelectedId(v.id)} className="p-3.5 hover:bg-slate-50 rounded-xl flex justify-between items-center cursor-pointer transition-colors">
                            <span className="font-bold text-slate-700">{v.title}</span>
                            <span className="text-slate-400 font-semibold font-mono">{v.subtitle || v.fields?.[0]?.value} ({new Date(v.date).toLocaleDateString("en-US", { year: "numeric", month: "short" })})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {medHistoryParentTab === "audit" && (
                  <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-soft space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <History className="h-5 w-5 text-brand-500" /> System Access Logs
                    </h3>
                    <div className="divide-y divide-slate-100 text-xs font-mono">
                      {[
                        { event: "FHIR records connection established", user: "Hekma App Integration", time: "Just now" },
                        { event: "Demographics profiles synchronized from hospital portal", user: "Hekma Auth Helper", time: "5 minutes ago" },
                        { event: "Clinical database updated securely", user: "Neo4j ETL Driver", time: "1 hour ago" }
                      ].map((log, i) => (
                        <div key={i} className="py-3 flex justify-between text-slate-400">
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
        </div>
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => setChatOpen(!chatOpen)} 
        className="fixed bottom-8 right-8 w-16 h-16 gradient-bg rounded-full shadow-float flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all z-50 focus:outline-none cursor-pointer"
        aria-label="Toggle Ask Hekma"
      >
        <Sparkles className="size-7 text-white fill-white animate-pulse" />
      </button>

      {/* Floating Chat Window overlay */}
      <div 
        id="hekma-chat" 
        className={`fixed bottom-28 right-8 w-96 max-w-[calc(100vw-2rem)] h-[580px] bg-white rounded-[32px] shadow-2xl border border-slate-100 flex flex-col overflow-hidden z-50 transition-all duration-300 ${
          chatOpen 
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" 
            : "opacity-0 scale-90 translate-y-5 pointer-events-none"
        }`}
      >
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

      {/* Stitch Connector Modal Dialog Overlay */}
      <StitchModal 
        isOpen={stitchModalOpen} 
        onClose={() => setStitchModalOpen(false)} 
        title={stitchModalTitle} 
      />
    </div>
  );
}
