import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { format, isPast, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useMountedNow } from "@/hooks/use-now";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/tours")({
  head: () => ({
    meta: [{ title: "Tours — Gharpayy" }, { name: "description", content: "Live tour pipeline with post-tour enforcement on every completed visit." }],
  }),
  component: ToursPage,
});

type PostTourForm = { tourId: string; leadName: string };

function PostTourModal({ data, onClose }: { data: PostTourForm; onClose: () => void }) {
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  
  // 🟢 NEW: Pull in the update function from your global store
  const { updateTour } = useApp();

  function handleSubmit() {
    if (!outcome) { toast.error("Please select an outcome"); return; }
    
    // 🟢 NEW: Update the specific tour with the new form data
    if (updateTour) {
       updateTour(data.tourId, { 
         postTour: { 
            filledAt: new Date().toISOString(), 
            outcome, 
            notes, 
            nextAction 
         } 
       });
    }

    toast.success(`Post-tour form saved for ${data.leadName}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="font-display text-lg font-semibold">Post-Tour Form — {data.leadName}</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tour Outcome *</label>
          <select
            value={outcome} onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select outcome...</option>
            <option value="interested">Interested — wants to book</option>
            <option value="considering">Considering — needs time</option>
            <option value="not_interested">Not Interested</option>
            <option value="ghosted">No show / Ghosted</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="What did the lead say? Any objections?"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-24 resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Next Action</label>
          <select
            value={nextAction} onChange={(e) => setNextAction(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select next action...</option>
            <option value="follow_up">Schedule follow-up call</option>
            <option value="send_proposal">Send proposal</option>
            <option value="second_tour">Schedule second tour</option>
            <option value="close">Initiate booking</option>
            <option value="drop">Drop lead</option>
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSubmit}>Save Form</Button>
        </div>
      </div>
    </div>
  );
}

function ToursPage() {
  const { tours, leads, properties, tcms, selectLead } = useApp();
  const [now, mounted] = useMountedNow();
  const [postTourData, setPostTourData] = useState<PostTourForm | null>(null);

  const sorted = [...tours].sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
  const upcoming = sorted.filter((t) => t.status === "scheduled");
  const completed = sorted.filter((t) => t.status === "completed");
  const incomplete = completed.filter((t) => !t.postTour.filledAt);

  return (
    <AppShell>
      {postTourData && <PostTourModal data={postTourData} onClose={() => setPostTourData(null)} />}
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Tours</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} upcoming · {completed.length} completed · <span className="text-destructive font-medium">{incomplete.length} pending post-tour</span>
          </p>
        </header>

        {incomplete.length > 0 && (
          <Section title="Post-tour enforcement" tone="destructive" icon={AlertTriangle}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {incomplete.map((t) => {
                const lead = leads.find((l) => l.id === t.leadId);
                const prop = properties.find((p) => p.id === t.propertyId);
                const tcm = tcms.find((x) => x.id === t.tcmId);
                if (!lead) return null;
                const hours = mounted ? Math.round((now - +new Date(t.scheduledAt)) / 36e5) : null;
                return (
                  <div key={t.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{lead.name}</span>
                      <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                        {hours === null ? "Overdue" : `${hours}h overdue`}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 mb-2">{prop?.name} · {tcm?.name}</div>
                    <Button size="sm" className="w-full" onClick={() => setPostTourData({ tourId: t.id, leadName: lead.name })}>
                      Fill Post-Tour Form
                    </Button>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Upcoming tours" icon={Clock}>
          <TourList tours={upcoming} onPostTour={(tourId, leadName) => setPostTourData({ tourId, leadName })} />
        </Section>
        <Section title="Completed" icon={CheckCircle2}>
          <TourList tours={completed} onPostTour={(tourId, leadName) => setPostTourData({ tourId, leadName })} />
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, icon: Icon, tone = "default", children }: { title: string; icon: typeof Clock; tone?: "default" | "destructive"; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
        <h2 className="font-display text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TourList({ tours, onPostTour }: { tours: import("@/lib/types").Tour[]; onPostTour: (tourId: string, leadName: string) => void }) {
  const { leads, properties, tcms } = useApp();
  if (tours.length === 0) {
    return <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No tours.</div>;
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
      {tours.map((t) => {
        const lead = leads.find((l) => l.id === t.leadId);
        const prop = properties.find((p) => p.id === t.propertyId);
        const tcm = tcms.find((x) => x.id === t.tcmId);
        if (!lead) return null;
        const when = new Date(t.scheduledAt);
        const overdue = t.status === "scheduled" && isPast(when) && !isToday(when);
        const needsForm = t.status === "completed" && !t.postTour.filledAt;
        return (
          <div key={t.id} className="w-full text-left grid grid-cols-12 px-4 py-3 items-center hover:bg-accent/5 transition-colors">
            <div className="col-span-3">
              <div className="font-medium text-sm">{lead.name}</div>
              <div className="text-[11px] text-muted-foreground">{lead.phone}</div>
            </div>
            <div className="col-span-3 text-xs">{prop?.name}</div>
            <div className="col-span-2 text-xs">{tcm?.name}</div>
            <div className="col-span-2 text-xs font-mono">{format(when, "MMM d, p")}</div>
            <div className="col-span-2 flex items-center gap-1.5 justify-end flex-wrap">
              <Badge variant="outline" className="capitalize text-[10px]">{t.status}</Badge>
              {overdue && <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Late</Badge>}
              {needsForm && (
                <Button size="sm" variant="outline" className="h-7 text-[10px] border-destructive/40 text-destructive"
                  onClick={() => onPostTour(t.id, lead.name)}>
                  Fill Form
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}