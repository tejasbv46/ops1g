import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfidenceBar, IntentChip } from "@/components/atoms";
import { format, formatDistanceToNow, isPast, isToday, addHours } from "date-fns";
import { CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useMountedNow } from "@/hooks/use-now";

export const Route = createFileRoute("/follow-ups")({
  head: () => ({
    meta: [{ title: "Follow-ups — Gharpayy" }, { name: "description", content: "Daily follow-up queue ranked by deal probability and urgency." }],
  }),
  component: FollowUpsPage,
});

type DoneModal = { id: string; leadName: string };

function NotesModal({ data, onConfirm, onClose }: { data: DoneModal; onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
        <h2 className="font-display text-base font-semibold">Mark Done — {data.leadName}</h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Add a note before closing</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Called, no response. Will try again tomorrow."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-24 resize-none"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => onConfirm(note)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function FollowUpsPage() {
  const { followUps, leads, completeFollowUp, selectLead } = useApp();
  const [, mounted] = useMountedNow();
  const [doneModal, setDoneModal] = useState<DoneModal | null>(null);
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});

  const enriched = useMemo(() => {
    return followUps
      .filter((f) => !f.done && !snoozed[f.id])
      .map((f) => ({ f, lead: leads.find((l) => l.id === f.leadId) }))
      .filter((x) => x.lead);
  }, [followUps, leads, snoozed]);

  const overdue = enriched.filter((x) => isPast(new Date(x.f.dueAt)) && !isToday(new Date(x.f.dueAt)));
  const today = enriched.filter((x) => isToday(new Date(x.f.dueAt)));
  const upcoming = enriched.filter((x) => !isPast(new Date(x.f.dueAt)) && !isToday(new Date(x.f.dueAt)));
  const hot = enriched.filter((x) => x.lead!.intent === "hot");

  function handleSnooze(id: string, leadName: string) {
    const until = addHours(new Date(), 24);
    setSnoozed((prev) => ({ ...prev, [id]: until.toISOString() }));
    toast.success(`Snoozed for 24h — back tomorrow at ${format(until, "h:mm a")}`);
  }

  function handleDoneConfirm(note: string) {
    if (!doneModal) return;
    completeFollowUp(doneModal.id);
    toast.success(note ? `Done · Note saved: "${note}"` : "Follow-up marked done");
    setDoneModal(null);
  }

  return (
    <AppShell>
      {doneModal && <NotesModal data={doneModal} onConfirm={handleDoneConfirm} onClose={() => setDoneModal(null)} />}
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Follow-up queue</h1>
          <p className="text-sm text-muted-foreground">
            {overdue.length} overdue · {today.length} today · {upcoming.length} upcoming · {hot.length} hot
            {Object.keys(snoozed).length > 0 && <span className="ml-2 text-yellow-500">· {Object.keys(snoozed).length} snoozed</span>}
          </p>
        </header>

        <Bucket
          title="Overdue" tone="destructive" items={overdue} mounted={mounted}
          onDone={(id, name) => setDoneModal({ id, leadName: name })}
          onSnooze={handleSnooze}
          onOpen={selectLead}
        />
        <Bucket
          title="Today" tone="accent" items={today} mounted={mounted}
          onDone={(id, name) => setDoneModal({ id, leadName: name })}
          onSnooze={handleSnooze}
          onOpen={selectLead}
        />
        <Bucket
          title="Upcoming" items={upcoming} mounted={mounted}
          onDone={(id, name) => setDoneModal({ id, leadName: name })}
          onSnooze={handleSnooze}
          onOpen={selectLead}
        />
      </div>
    </AppShell>
  );
}

function Bucket({
  title, items, tone = "default", mounted, onDone, onSnooze, onOpen,
}: {
  title: string;
  items: { f: import("@/lib/types").FollowUp; lead?: import("@/lib/types").Lead }[];
  tone?: "default" | "accent" | "destructive";
  mounted: boolean;
  onDone: (id: string, leadName: string) => void;
  onSnooze: (id: string, leadName: string) => void;
  onOpen: (id: string) => void;
}) {
  const toneCls = { default: "border-border", accent: "border-accent/30", destructive: "border-destructive/30" }[tone];
  const titleCls = { default: "text-foreground", accent: "text-accent", destructive: "text-destructive" }[tone];

  return (
    <section>
      <h2 className={`font-display text-sm font-semibold mb-2 ${titleCls}`}>{title} <span className="text-muted-foreground font-normal">({items.length})</span></h2>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Nothing here.</div>
      ) : (
        <div className={`rounded-xl border ${toneCls} bg-card overflow-hidden divide-y divide-border`}>
          {items.map(({ f, lead }) => (
            <div key={f.id} className="grid grid-cols-12 px-4 py-3 items-center gap-2 hover:bg-accent/5 transition-colors">
              <button onClick={() => onOpen(lead!.id)} className="col-span-3 text-left">
                <div className="font-medium text-sm">{lead!.name}</div>
                <div className="text-[11px] text-muted-foreground">{lead!.phone}</div>
              </button>
              <div className="col-span-2 flex items-center gap-2"><IntentChip intent={lead!.intent} /></div>
              <div className="col-span-2"><ConfidenceBar value={lead!.confidence} /></div>
              <div className="col-span-3 text-xs">
                <div>{f.reason}</div>
                <div className="text-muted-foreground text-[11px]">{format(new Date(f.dueAt), "MMM d, p")} · {mounted ? formatDistanceToNow(new Date(f.dueAt), { addSuffix: true }) : "—"}</div>
              </div>
              <div className="col-span-2 flex justify-end gap-1.5">
                <Button size="sm" variant="outline" className="h-8" onClick={() => onSnooze(f.id, lead!.name)}>
                  <Clock className="h-3 w-3 mr-1" /> Snooze
                </Button>
                <Button size="sm" className="h-8" onClick={() => onDone(f.id, lead!.name)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}