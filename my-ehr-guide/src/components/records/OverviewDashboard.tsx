import { useState, useMemo } from "react";
import { type FhirRecord, type PatientSummary } from "@/lib/mockFhir";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, FileText, Link2, Search, Heart, 
  ChevronLeft, ChevronRight, Activity, ShieldAlert,
  ShieldCheck, HelpCircle, Calendar, Syringe, Sparkles
} from "lucide-react";

export interface SuggestionItem {
  text: string;
  recordId: string | null;
}

interface Props {
  patient: PatientSummary;
  records: FhirRecord[];
  onSuggestion: (q: string, recordId: string | null) => void;
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
    const stepsRecord = records.find(r => r.title.toLowerCase().includes("steps") || r.title.toLowerCase().includes("step count"));
    
    return {
      bp: bpRecord ? bpRecord.subtitle || bpRecord.fields?.[0]?.value || null : null,
      glucose: glucoseRecord ? glucoseRecord.subtitle || glucoseRecord.fields?.[0]?.value || null : null,
      hr: hrRecord ? hrRecord.subtitle || hrRecord.fields?.[0]?.value || null : null,
      steps: stepsRecord ? stepsRecord.subtitle || stepsRecord.fields?.[0]?.value || null : null
    };
  }, [records]);

  const suggestions = useMemo<SuggestionItem[]>(() => {
    const list: SuggestionItem[] = [];

    const isExcludedObservation = (title: string) => {
      const t = title.toLowerCase();
      return t.includes("cause of death") || t.includes("death certificate") || t.includes("certification of death");
    };

    // 1. Find conditions
    const activeConditions = records.filter((r) => r.resourceType === "Condition" && r.status === "active");
    const anyConditions = activeConditions.length > 0 ? activeConditions : records.filter((r) => r.resourceType === "Condition");
    if (anyConditions.length > 0) {
      const condRecord = anyConditions[0];
      const condName = condRecord.title
        .replace(/\s*\([^)]*\)/g, "")
        .trim();
      list.push({ text: `What is ${condName}?`, recordId: condRecord.id });
      list.push({ text: `How is my ${condName} managed?`, recordId: condRecord.id });
    }

    // 2. Find medications
    const meds = records.filter(
      (r) =>
        r.resourceType === "MedicationStatement" ||
        r.resourceType === "MedicationRequest",
    );
    if (meds.length > 0) {
      const medRecord = meds[0];
      const medName = medRecord.title
        .split(" ")[0]
        .replace(/[,;]/g, "");
      list.push({ text: `Why am I prescribed ${medName}?`, recordId: medRecord.id });
    }

    // 3. Find recent lab observations (excluding vitals and death records)
    const labsList = records.filter(
      (r) => r.resourceType === "Observation" && !isVitalTitle(r.title) && !isExcludedObservation(r.title)
    );
    if (labsList.length > 0) {
      const labRecord = labsList[0];
      const obsName = labRecord.title.toLowerCase();
      list.push({ text: `What does my last ${obsName} result mean?`, recordId: labRecord.id });
    }

    // 4. Find allergies
    const allergiesList = records.filter((r) => r.resourceType === "AllergyIntolerance");
    if (allergiesList.length > 0) {
      const allergyRecord = allergiesList[0];
      const allergyName = allergyRecord.title.toLowerCase();
      list.push({ text: `Do I have any allergies to ${allergyName}?`, recordId: allergyRecord.id });
    }

    // Fallbacks
    const fallbacks: SuggestionItem[] = [
      { text: "What diagnoses are on my profile?", recordId: null },
      { text: "Explain my latest lab reports", recordId: null },
      { text: "What medications am I taking?", recordId: null },
      { text: "Do I have any allergies noted?", recordId: null },
    ];

    // Deduplicate items by text
    const seen = new Set<string>();
    const merged: SuggestionItem[] = [];
    for (const item of [...list, ...fallbacks]) {
      if (!seen.has(item.text)) {
        seen.add(item.text);
        merged.push(item);
      }
    }

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
    <div className="mx-auto w-full max-w-6xl space-y-8 py-6 animate-fade-up">
      {/* Top Header Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-6 flex-shrink-0">
        <div className="space-y-0.5">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">Patient Portal</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Clinical Dashboard</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => window.location.reload()}
            variant="outline" 
            size="sm" 
            className="rounded-full border-slate-100 bg-white hover:bg-brand-50 hover:text-brand-700 text-slate-600 font-bold shadow-soft flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button 
            onClick={() => onNavigate("healthsummary")}
            variant="outline" 
            size="sm" 
            className="rounded-full border-slate-100 bg-white hover:bg-brand-50 hover:text-brand-700 text-slate-600 font-bold shadow-soft flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileText className="h-3.5 w-3.5" /> Health Summary
          </Button>
          <Button 
            onClick={() => onNavigate("fastenhealth")}
            variant="outline" 
            size="sm" 
            className="rounded-full border-slate-100 bg-white hover:bg-brand-50 hover:text-brand-700 text-slate-600 font-bold shadow-soft flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Link2 className="h-3.5 w-3.5" /> Health Connect
          </Button>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="relative bg-gradient-to-r from-[#fdf4ff] to-[#f5f3ff] rounded-[32px] p-10 border border-white shadow-soft overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-48 h-48 bg-brand-300/20 rounded-full blur-3xl"></div>
        <div className="absolute right-24 top-8 w-14 h-14 bg-white/60 backdrop-blur-md rounded-2xl shadow-lg flex items-center justify-center transform rotate-12">
          <Syringe className="text-2xl text-brand-500" />
        </div>
        <div className="absolute right-48 bottom-12 w-12 h-12 bg-white/60 backdrop-blur-md rounded-2xl shadow-lg flex items-center justify-center transform -rotate-12">
          <Heart className="text-xl text-brand-600 fill-brand-600 text-brand-600" />
        </div>
        <div className="absolute right-10 bottom-8 w-10 h-10 bg-white/60 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center">
          <span className="text-brand-500 font-extrabold text-sm">✓</span>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/60 backdrop-blur-sm text-brand-700 text-xs font-bold rounded-full mb-4 shadow-sm border border-white">
            <Sparkles className="size-3.5 fill-brand-500 text-brand-500" /> Recommended for you
          </span>
          <h2 className="text-3xl font-extrabold text-slate-800 mb-3 tracking-tight">Find Studies You May Qualify For</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Based on {patient.name}'s health profile (ID #{patientId}), there may be oncology and autoimmune research studies that match their needs. Participation is always a choice.
          </p>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate("trialmatch")}
              className="gradient-bg text-white px-6 py-3 rounded-full text-sm font-bold shadow-float hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              Find Clinical Matches <ChevronRight className="size-4" />
            </button>
            <button 
              onClick={() => onNavigate("healthsummary")}
              className="bg-white text-brand-700 px-6 py-3 rounded-full text-sm font-bold shadow-soft border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Health Pulse and Tasks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Health Pulse Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-soft border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-500">
                  <Activity className="size-4 text-brand-500" />
                </span>
                Patient Health Pulse
              </h3>
              <p className="text-xs text-slate-400 mt-1 ml-10 font-bold uppercase tracking-wider">5 Day Consistency 🔥</p>
            </div>
            <button className="text-slate-400 hover:text-brand-500 cursor-pointer">
              <span className="text-2xl font-bold">•••</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative my-4">
            {/* SVG Circular Progress */}
            <div className="relative w-40 h-40">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-slate-100 stroke-current" strokeWidth="10" cx="50" cy="50" r="40" fill="transparent"></circle>
                <circle 
                  className="text-brand-500 stroke-current progress-ring__circle" 
                  strokeWidth="10" 
                  strokeLinecap="round" 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="transparent" 
                  strokeDasharray="251.2" 
                  strokeDashoffset="70.33"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-800">72<span className="text-lg">%</span></span>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Score</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-slate-50 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-brand-400 text-lg mb-1">👣</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Steps</span>
              <span className="text-sm font-bold text-slate-800">{dailyVitals.steps || "--"}</span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-orange-400 text-lg mb-1">🔥</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Calories</span>
              <span className="text-sm font-bold text-slate-800">--</span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 flex flex-col items-center text-center">
              <span className="text-yellow-500 text-lg mb-1">⚡</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Energy</span>
              <span className="text-sm font-bold text-slate-800">Stable</span>
            </div>
          </div>
        </div>

        {/* Clinical Tasks (Medications) */}
        <div className="bg-white rounded-[32px] p-8 shadow-soft border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-500">
                <FileText className="size-4" />
              </span>
              Clinical Tasks
            </h3>
            <button 
              onClick={() => onNavigate("healthsummary")}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
            >
              View All
            </button>
          </div>
          
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {/* Task 1 */}
            <div className="flex items-center justify-between p-4 bg-brand-50/50 rounded-2xl border border-brand-100/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white text-brand-500 flex items-center justify-center shadow-sm">
                  💊
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {medications[0]?.title ? medications[0].title.split(" ")[0] : "Atorvastatin"} 80 MG
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">8:00 AM • Oral Tablet</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full">Done</span>
            </div>

            {/* Task 2 */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white text-slate-400 flex items-center justify-center shadow-sm">
                  📋
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Symptom Survey</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">12:00 PM • Required</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full">Pending</span>
            </div>

            {/* Task 3 */}
            <div className="flex items-center justify-between p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white text-rose-500 flex items-center justify-center shadow-sm">
                  ❤️
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">BP Reading</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">6:00 PM • Monitor</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full">Pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vital Metrics Section */}
      <h3 className="font-extrabold text-slate-800 mb-6 text-xl tracking-tight">Vital Metrics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Heart Rate */}
        <div className="bg-white rounded-[32px] p-6 shadow-soft border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
              <Heart className="size-4 text-rose-500 fill-rose-500" />
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded border border-emerald-100">Normal</span>
          </div>
          <h4 className="text-3xl font-extrabold text-slate-800 mb-1">
            {dailyVitals.hr ? dailyVitals.hr.replace(/[^0-9]/g, '') : "70"} <span className="text-sm font-medium text-slate-400">bpm</span>
          </h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Heart Rate • Dec 21</p>
          {/* Sparkline */}
          <div className="h-10 w-full relative">
            <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0,25 C20,25 30,10 50,15 C70,20 80,5 100,5" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round"/>
              <path d="M0,25 C20,25 30,10 50,15 C70,20 80,5 100,5 L100,30 L0,30 Z" fill="url(#rose-grad)" opacity="0.15"/>
              <defs>
                <linearGradient id="rose-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="1"/>
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Blood Pressure */}
        <div className="bg-white rounded-[32px] p-6 shadow-soft border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              🩸
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded border border-emerald-100">Normal</span>
          </div>
          <h4 className="text-3xl font-extrabold text-slate-800 mb-1">
            {dailyVitals.bp || "120/81"} <span className="text-sm font-medium text-slate-400">mmHg</span>
          </h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Blood Pressure • Dec 21</p>
          <div className="h-10 w-full relative">
            <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0,20 C30,20 40,25 50,15 C60,5 70,20 100,10" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
              <path d="M0,20 C30,20 40,25 50,15 C60,5 70,20 100,10 L100,30 L0,30 Z" fill="url(#orange-grad)" opacity="0.15"/>
              <defs>
                <linearGradient id="orange-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="1"/>
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Glucose */}
        <div className="bg-white rounded-[32px] p-6 shadow-soft border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-500">
              🧪
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded border border-emerald-100">Stable</span>
          </div>
          <h4 className="text-3xl font-extrabold text-slate-800 mb-1">
            {dailyVitals.glucose ? dailyVitals.glucose.split(" ")[0] : "90.4"} <span className="text-sm font-medium text-slate-400">mg/dL</span>
          </h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Glucose • Dec 21</p>
          <div className="h-10 w-full relative">
            <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0,15 L20,15 L30,5 L40,25 L50,15 L100,15" fill="none" stroke="#d946ef" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M0,15 L20,15 L30,5 L40,25 L50,15 L100,15 L100,30 L0,30 Z" fill="url(#purple-grad)" opacity="0.15"/>
              <defs>
                <linearGradient id="purple-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity="1"/>
                  <stop offset="100%" stopColor="#d946ef" stopOpacity="0"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* BMI */}
        <div className="bg-white rounded-[32px] p-6 shadow-soft border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              ⚖️
            </div>
            <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold uppercase rounded border border-orange-100">Elevated</span>
          </div>
          <h4 className="text-3xl font-extrabold text-slate-800 mb-1">30.1 <span className="text-sm font-medium text-slate-400">kg/m²</span></h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">BMI • Dec 21</p>
          <div className="h-10 w-full relative">
            <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0,25 C30,25 50,15 100,5" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
              <path d="M0,25 C30,25 50,15 100,5 L100,30 L0,30 Z" fill="url(#blue-grad)" opacity="0.15"/>
              <defs>
                <linearGradient id="blue-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="1"/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Health Overview */}
      <h3 className="font-extrabold text-slate-800 mb-6 text-xl tracking-tight">Health Overview</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Medications Detailed Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-soft border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                💊
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-base leading-tight">Medications</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{medications.length} Prescribed • 5 Active</p>
              </div>
            </div>
            <div className="w-12 h-12 relative">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-brand-500" strokeWidth="3" stroke-dasharray="80, 100" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <text x="18" y="20.5" className="text-[10px] font-bold fill-slate-700" textAnchor="middle">80%</text>
              </svg>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next dose in</span>
              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">Upcoming</span>
            </div>
            <p className="font-bold text-slate-800 text-sm">2h 15m • 8:00 PM</p>
            <p className="text-xs text-slate-500 mt-1 font-semibold truncate">
              {medications.slice(0, 2).map(m => m.title.split(" ")[0]).join(", ") || "Simvastatin, Captopril"}
            </p>
          </div>

          <div className="flex gap-2 mb-6 p-1 bg-slate-50 rounded-xl">
            <button className="flex-1 py-1.5 text-xs font-bold bg-white text-slate-800 rounded-lg shadow-soft cursor-pointer">☀️ AM</button>
            <button className="flex-1 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer">🌅 PM</button>
            <button className="flex-1 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer">🌙 Night</button>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 gradient-bg text-white py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer">Mark as Taken</button>
            <button 
              onClick={() => onNavigate("healthsummary")}
              className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer animate-fade-in"
            >
              View Schedule
            </button>
          </div>
        </div>

        {/* Lab Reports Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-soft border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  📁
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-base">Lab Reports</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{labs.length} reports • Dec 2001</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Recent: Glucose</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-extrabold text-slate-800">90.38</span>
                  <span className="text-xs text-slate-400 font-bold pb-1">mg/dL</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-emerald-600 flex items-center justify-end gap-1 mb-2">
                  📈 Stable
                </p>
                <svg width="60" height="20" viewBox="0 0 60 20">
                  <path d="M0,10 L15,12 L30,5 L45,15 L60,8" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded-full border border-emerald-100">Urea Nitrogen: Normal</span>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded-full border border-amber-100">Creatinine: Monitor</span>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-full border border-slate-200">Pain Sev: Review</span>
            </div>
          </div>
          
          <button 
            onClick={() => onNavigate("healthsummary")}
            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            View Full Lab Details <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Needs Attention warning block */}
      <div className="bg-rose-50/40 border border-rose-100 rounded-[32px] p-6 mb-8 animate-fade-up">
        <div className="flex items-center gap-2 mb-4 px-2">
          <span>⚠️</span>
          <h3 className="font-bold text-rose-700 text-xs uppercase tracking-wider">Needs Attention</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-rose-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
              💔
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Myocardial Infarction</p>
              <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">History active since Feb 2002. Ensure ongoing monitoring.</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-amber-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
              ⚠️
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Allergy: Eggs</p>
              <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">Watery eyes recorded. Avoid exposure.</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-slate-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
              📋
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Missing Records</p>
              <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">Daily steps have not been recorded recently.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Questions (Try asking Hekma) */}
      <section className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-soft space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Try asking Hekma</h3>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              className="rounded-full border-brand-100 bg-white hover:bg-brand-50 hover:text-brand-700 text-slate-600 font-bold transition-all shadow-soft cursor-pointer"
              onClick={() => onSuggestion(s.text, s.recordId)}
            >
              {s.text}
            </Button>
          ))}
        </div>
      </section>

      {/* Footer Area */}
      <div className="text-center pt-8 pb-4">
        <p className="text-xs font-semibold text-slate-400 flex items-center justify-center gap-1.5">
          🔒 HIPAA & GDPR Compliant. Your data is end-to-end encrypted.
        </p>
      </div>
    </div>
  );
}
