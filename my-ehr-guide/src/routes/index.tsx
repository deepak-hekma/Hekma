import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { RecordsSidebar } from "@/components/records/RecordsSidebar";
import { RecordDetail } from "@/components/records/RecordDetail";
import { OverviewDashboard } from "@/components/records/OverviewDashboard";
import { ChatPanel, type ChatPanelHandle } from "@/components/chat/ChatPanel";
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

function Index() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
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
    chatRef.current?.attachRecord(r);
    setChatOpen(true);
  };

  const handleSuggestion = (q: string) => {
    chatRef.current?.prefill(q);
    setChatOpen(true);
  };

  const handleSourceClick = (id: string) => {
    setSelectedId(id);
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
        {/* Left column: Combined Patient Dropdown + Records list */}
        <div className="hidden min-h-0 flex-col border-r border-border md:flex">
          <div className="border-b border-border p-3 bg-card">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Active Patient
            </label>
            <div className="relative">
              <select
                value={selectedPatientId}
                onChange={(e) => {
                  const p = patients.find((p) => p.id === e.target.value);
                  if (p) handleSelectPatient(p);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-ink focus:border-sage focus:outline-none cursor-pointer"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.age}, {p.pronouns})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <RecordsSidebar
              records={records}
              selectedId={selectedId}
              onSelect={(r) => setSelectedId(r.id)}
            />
          </div>
        </div>
        <main className="min-h-0 overflow-y-auto">
          {selected ? (
            <RecordDetail record={selected} onAsk={handleAsk} />
          ) : (
            <OverviewDashboard patient={selectedPatient} records={records} onSuggestion={handleSuggestion} />
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
            className="absolute right-3 top-3 z-10 rounded-full p-2 text-ink/70 hover:bg-ink/5"
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
    </div>
  );
}
