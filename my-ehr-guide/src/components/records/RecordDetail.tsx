import { useState } from "react";
import type { FhirRecord } from "@/lib/mockFhir";
import { categoryMeta } from "@/lib/mockFhir";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  record: FhirRecord;
  onAsk: (r: FhirRecord) => void;
}

export function RecordDetail({ record, onAsk }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const cat = categoryMeta[record.resourceType];

  return (
    <article className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8" aria-labelledby="record-title">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-sage">{cat.label}</div>
        <h1 id="record-title" tabIndex={-1} className="font-serif text-4xl text-ink">
          {record.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            {new Date(record.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {record.provider && (
            <>
              <span aria-hidden>·</span>
              <span>{record.provider}</span>
            </>
          )}
        </div>
      </header>

      <Button onClick={() => onAsk(record)} className="gap-2">
        <MessageSquarePlus className="size-4" />
        Ask Hekma about this
      </Button>

      <section className="rounded-2xl border border-border bg-card p-5">
        <dl className="divide-y divide-border">
          {record.fields.map((f) => (
            <div key={f.label} className="grid grid-cols-3 gap-4 py-2.5 first:pt-0 last:pb-0">
              <dt className="text-sm text-muted-foreground">{f.label}</dt>
              <dd className="col-span-2 text-sm font-medium text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {record.notes && (
        <section className="rounded-2xl bg-sage-soft/60 p-5">
          <h2 className="mb-1.5 font-serif text-lg text-ink">What this means</h2>
          <p className="text-sm leading-relaxed text-ink/85">{record.notes}</p>
        </section>
      )}

      <section>
        <button
          type="button"
          onClick={() => setShowRaw((s) => !s)}
          aria-expanded={showRaw}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ink"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", !showRaw && "-rotate-90")} />
          View FHIR source
        </button>
        {showRaw && (
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-ink/95 p-4 text-xs text-background">
            {JSON.stringify(record.raw, null, 2)}
          </pre>
        )}
      </section>
    </article>
  );
}
