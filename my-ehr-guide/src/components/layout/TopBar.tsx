import logoUrl from "@/assets/hekma-logo.png";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface Props {
  patient: { name: string; age: number; pronouns: string };
}

export function TopBar({ patient }: Props) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <img src={logoUrl} alt="" width={28} height={28} className="size-7" />
        <div className="font-serif text-2xl leading-none text-ink">Hekma</div>
        <span className="ml-3 hidden text-xs text-muted-foreground sm:inline">
          Your health, in your words
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium text-ink">{patient.name}</div>
          <div className="text-xs text-muted-foreground">{patient.age} · {patient.pronouns}</div>
        </div>
        <div
          aria-hidden
          className="grid size-9 place-items-center rounded-full bg-sage-soft font-serif text-sm text-ink"
        >
          {patient.name.split(" ").map((p) => p[0]).join("")}
        </div>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
}
