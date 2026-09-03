import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, CheckCircle2, Loader2, Inbox } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type PendingItem = {
  id: number;
  confidence: number;
  classification: string;
  status: string;
  explanation: string;
  sourceA: {
    sourceOrganization: string;
    originalMaterialCode: string;
    originalDescription: string;
    category: string;
    sourceType: string;
  };
  sourceB: {
    sourceOrganization: string;
    originalMaterialCode: string;
    originalDescription: string;
    category: string;
    sourceType: string;
  };
};

const stages = [
  { key: "validate", label: "Raw data validation" },
  { key: "block", label: "Candidate generation" },
  { key: "ai", label: "AI description + DNA comparison" },
  { key: "confidence", label: "Confidence scoring" },
  { key: "conflict", label: "Conflict detection" },
  { key: "queue", label: "Review queue generation" },
];

export default function AiMatching() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [running, setRunning] = useState(false);
  const [stageIdx, setStageIdx] = useState(-1);
  const [created, setCreated] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    api
      .pendingMatches()
      .then((r) => setPending(r))
      .catch(() => setPending([]))
      .finally(() => setLoadingPending(false));
  }, []);

  const pendingList = pending.filter((r) => r.status === "PENDING");

  async function run() {
    setRunning(true);
    setStageIdx(0);
    setCreated(null);
    let i = 0;
    const stg = setInterval(() => {
      i++;
      if (i >= stages.length) {
        clearInterval(stg);
        clearInterval(timerRef.current);
        api
          .runMatching()
          .then(async (res: any) => {
            setCreated(res.created ?? pending.length);
            setLastRun(new Date().toISOString());
            const list = await api.pendingMatches().catch(() => []);
            setPending(list);
            toast("success", "Matching complete", `${Number.isFinite(res.created) ? `${res.created} recommendation(s) created` : "Review queue updated"}.`);
          })
          .catch((err: any) => {
            toast("error", "Matching failed", err.message || "The matcher could not be run.");
          })
          .finally(() => setRunning(false));
      } else {
        setStageIdx(i);
      }
    }, 500);
    timerRef.current = stg;
  }

  const canRun = !running;

  return (
    <div>
      <PageHeader
        title="AI Matching"
        description="Run the AI multi-layer matcher to compare your imported records with other CPSEs already loaded, producing real match recommendations for review."
        action={
          <Button onClick={run} disabled={!canRun}>
            {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Matching in progress...</> : <><Sparkles className="h-4 w-4" /> Run AI Matching</>}
          </Button>
        }
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Matching workflow</CardTitle>
          <CardDescription>Your imported records are compared against existing cross-CPSE materials through the AI service. Only matching records from different CPSEs produce recommendations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {stages.map((s, i) => {
              const state = running ? (i < stageIdx ? "done" : i === stageIdx ? "active" : "pending") : "done";
              return (
                <div
                  key={s.key}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${
                    state === "active" ? "border-primary bg-primary/10 text-primary" : state === "done" ? "border-success/30 bg-success/10 text-success" : "text-muted-foreground"
                  }`}
                >
                  {state === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "done" ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />}
                  <span className="font-medium">{i + 1}. {s.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Run status</span>
              <span className="font-medium">{running ? "Generating candidate pairs and scoring confidence..." : created !== null ? `${created} recommendation(s) created` : "Ready to run"}</span>
            </div>
            <Progress value={running ? Math.max(10, Math.min(95, (stageIdx / stages.length) * 100)) : 100} tone={running ? "primary" : "success"} />
            {running && <p className="text-xs text-muted-foreground">{stages[stageIdx]?.label}...</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBox label="Recommendations created (last run)" value={created === null ? "—" : created.toLocaleString()} tone="neutral" />
        <StatBox label="Awaiting review" value={pendingList.length.toLocaleString()} tone="warning" />
        <StatBox label="Last run" value={lastRun ? new Date(lastRun).toLocaleTimeString() : "—"} tone="neutral" />
      </div>

      <Card className="mt-5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recommendations in review</CardTitle>
            <CardDescription>{lastRun ? `Last run: ${new Date(lastRun).toLocaleString()}` : "Real match recommendations generated from your imported records."}</CardDescription>
          </div>
          <Button variant="outline" onClick={() => navigate("/review-queue")}>
            <Inbox className="h-4 w-4" /> Open Review Queue
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingPending ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading recommendations...</div>
          ) : pendingList.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No recommendations awaiting review. Import material data from at least two CPSEs, then run the matcher.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Source material A</TH>
                  <TH>Source material B</TH>
                  <TH>AI confidence</TH>
                  <TH>Classification</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {pendingList.slice(0, 8).map((r) => (
                  <TR key={r.id} className="cursor-pointer" onClick={() => navigate("/review-queue")}>
                    <TD className="max-w-xs">
                      <p className="font-medium">{r.sourceA.originalDescription}</p>
                      <p className="text-xs text-muted-foreground">{r.sourceA.sourceOrganization} · {r.sourceA.originalMaterialCode}</p>
                    </TD>
                    <TD className="max-w-xs">
                      <p className="font-medium">{r.sourceB.originalDescription}</p>
                      <p className="text-xs text-muted-foreground">{r.sourceB.sourceOrganization} · {r.sourceB.originalMaterialCode}</p>
                    </TD>
                    <TD>
                      <span className={`font-medium ${r.confidence >= 0.8 ? "text-success" : r.confidence >= 0.6 ? "text-warning" : "text-destructive"}`}>{Math.round(r.confidence * 100)}%</span>
                    </TD>
                    <TD><Badge tone="info">{r.classification.replace(/_/g, " ").toLowerCase()}</Badge></TD>
                    <TD><Badge tone="warning">Pending</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "";
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </Card>
  );
}
