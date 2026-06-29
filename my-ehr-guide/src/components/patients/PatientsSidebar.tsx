import { patients, type PatientSummary } from "@/lib/mockFhir";

interface Props {
  selectedId: string;
  onSelect: (p: PatientSummary) => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

export function PatientsSidebar({ selectedId, onSelect }: Props) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-ink/10 bg-background">
      <div className="border-b border-ink/10 px-4 py-4">
        <h2 className="font-serif text-lg text-ink">Patients</h2>
        <p className="text-xs text-muted-foreground">{patients.length} in your panel</p>
      </div>
      <ul className="flex-1 overflow-y-auto py-2">
        {patients.map((p) => {
          const active = p.id === selectedId;
          return (
            <li key={p.id}>
              <button
                onClick={() => onSelect(p)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  active ? "bg-sage/10" : "hover:bg-ink/5"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    active ? "bg-sage text-white" : "bg-ink/10 text-ink"
                  }`}
                >
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.age} · {p.pronouns}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{p.reason}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
