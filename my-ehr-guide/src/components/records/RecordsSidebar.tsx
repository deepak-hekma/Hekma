import { useMemo, useState } from "react";
import { categoryMeta, type FhirCategory, type FhirRecord } from "@/lib/mockFhir";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Pill,
  Stethoscope,
  CalendarDays,
  Syringe,
  AlertTriangle,
  Search,
  ArrowDownUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<FhirCategory, React.ComponentType<{ className?: string }>> = {
  Observation: Activity,
  MedicationStatement: Pill,
  Condition: Stethoscope,
  Encounter: CalendarDays,
  Immunization: Syringe,
  AllergyIntolerance: AlertTriangle,
};

const STATUS_DOT: Record<string, string> = {
  normal: "bg-sage",
  borderline: "bg-amber-500",
  high: "bg-orange-500",
  low: "bg-sky-500",
  active: "bg-sage",
  resolved: "bg-muted-foreground",
  completed: "bg-muted-foreground",
};

interface Props {
  records: FhirRecord[];
  selectedId: string | null;
  onSelect: (r: FhirRecord) => void;
}

export function RecordsSidebar({ records, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [sortByDate, setSortByDate] = useState(false);
  const [openCats, setOpenCats] = useState<Set<FhirCategory>>(
    () => new Set(Object.keys(categoryMeta) as FhirCategory[]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.subtitle?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<FhirCategory, FhirRecord[]>();
    for (const r of filtered) {
      if (!map.has(r.resourceType)) map.set(r.resourceType, []);
      map.get(r.resourceType)!.push(r);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }, [filtered]);

  const flatByDate = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  const toggleCat = (c: FhirCategory) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-border bg-background"
      aria-label="Your records"
    >
      <div className="space-y-2 border-b border-border px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records"
            className="h-9 pl-8"
            aria-label="Search records"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setSortByDate((s) => !s)}
          >
            <ArrowDownUp className="size-3" />
            {sortByDate ? "Sort by category" : "Sort by date"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No records match "{query}".
          </div>
        ) : sortByDate ? (
          <ul className="space-y-1">
            {flatByDate.map((r) => (
              <RecordRow key={r.id} record={r} selected={r.id === selectedId} onSelect={onSelect} />
            ))}
          </ul>
        ) : (
          (Object.keys(categoryMeta) as FhirCategory[])
            .sort((a, b) => categoryMeta[a].order - categoryMeta[b].order)
            .map((cat) => {
              const items = grouped.get(cat) ?? [];
              if (items.length === 0) return null;
              const Icon = ICONS[cat];
              const open = openCats.has(cat);
              return (
                <div key={cat} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleCat(cat)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-sage-soft/40"
                    aria-expanded={open}
                  >
                    <Icon className="size-3.5" />
                    <span className="flex-1">{categoryMeta[cat].label}</span>
                    <span className="rounded-full bg-sage-soft px-1.5 py-0.5 text-[10px] font-medium text-ink">
                      {items.length}
                    </span>
                    <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
                  </button>
                  {open && (
                    <ul className="mt-0.5 space-y-0.5">
                      {items.map((r) => (
                        <RecordRow key={r.id} record={r} selected={r.id === selectedId} onSelect={onSelect} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
        )}
      </div>
    </aside>
  );
}

function RecordRow({
  record,
  selected,
  onSelect,
}: {
  record: FhirRecord;
  selected: boolean;
  onSelect: (r: FhirRecord) => void;
}) {
  const dot = record.status ? STATUS_DOT[record.status] ?? "bg-muted-foreground" : "bg-muted-foreground";
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(record)}
        className={cn(
          "group flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
          selected ? "bg-sage-soft" : "hover:bg-sage-soft/50",
        )}
        aria-current={selected ? "true" : undefined}
      >
        <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{record.title}</span>
          {record.subtitle && (
            <span className="block truncate text-xs text-muted-foreground">{record.subtitle}</span>
          )}
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/80">
          {new Date(record.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
        </span>
      </button>
    </li>
  );
}
