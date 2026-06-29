import { useEffect, useState } from "react";
import { categoryMeta, type FhirCategory, type FhirRecord } from "@/lib/mockFhir";
import { Button } from "@/components/ui/button";

interface Props {
  patient: { name: string; age: number; pronouns: string };
  records: FhirRecord[];
  onSuggestion: (q: string) => void;
}

const computeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const SUGGESTIONS = [
  "What was my last lab result?",
  "Explain my medications",
  "When was my last visit?",
  "Do I have any allergies on file?",
];

export function OverviewDashboard({ patient, records, onSuggestion }: Props) {
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => setGreeting(computeGreeting()), []);

  const counts = (Object.keys(categoryMeta) as FhirCategory[]).map((cat) => ({
    cat,
    count: records.filter((r) => r.resourceType === cat).length,
  }));
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm text-sage">{greeting},</p>
        <h1 className="font-serif text-5xl leading-tight text-ink">{patient.name.split(" ")[0]}.</h1>
        <p className="max-w-md text-base text-muted-foreground">
          Your records are organized on the left. Ask Hekma anything about your health in the panel on the right.
        </p>
      </header>

      <section aria-labelledby="snapshot">
        <h2 id="snapshot" className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Snapshot
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {counts.map(({ cat, count }) => (
            <div
              key={cat}
              className="rounded-2xl border border-border bg-card px-4 py-3"
            >
              <div className="font-serif text-3xl text-ink">{count}</div>
              <div className="text-xs text-muted-foreground">{categoryMeta[cat].label}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent activity
        </h2>
        <ul className="space-y-2">
          {recent.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{r.title}</div>
                {r.subtitle && (
                  <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>
                )}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ask">
        <h2 id="ask" className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Try asking
        </h2>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className="rounded-full border-sage/30 bg-card hover:bg-sage-soft"
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
