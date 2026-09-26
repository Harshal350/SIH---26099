import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, Sparkles, ShieldAlert, Info } from "lucide-react";
import { useProto, ReviewItem } from "@/context/prototype-data";
import { RECOMMENDATION_LABEL, DECISION_POLICY } from "@/lib/matching";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

/**
 * The actual pipeline, in the order the engine applies it. These are static
 * documentation, not an animated progress bar: matching runs synchronously in
 * the browser over the records already in memory, so there is no staged job
 * queue to report progress from.
 */
const stages = [
  { key: "validate", label: "Record validation", detail: "Record type and item-level granularity checked" },
  { key: "extract", label: "Attribute extraction", detail: "Grade, size, pressure, voltage, rating pulled from the description" },
  { key: "generate", label: "Candidate generation", detail: "Every material pair from different source records" },
  { key: "score", label: "Similarity scoring", detail: "Description agreement + attribute agreement" },
  { key: "conflict", label: "Conflict detection", detail: "Contradicting attributes block automation" },
  { key: "queue", label: "Review queue", detail: "Undecided candidates queued for a human" },
];

const ORIGIN_TONE = { LIVE: "success", REFERENCE: "info", DEMO: "warning" } as const;

export default function AiMatching() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const proto = useProto();

  const [lastStats, setLastStats] = useState<{
    candidatesEvaluated: number;
    recommended: number;
    blocked: number;
    candidatesRejected: number;
  } | null>(null);
  const [running, setRunning] = useState(false);

  const pending = useMemo(
    () => proto.reviewItems.filter((r) => r.status === "PENDING"),
    [proto.reviewItems],
  );

  async function run() {
    setRunning(true);
    try {
      const stats = await proto.runAiMatching();
      if (!stats) {
        toast("error", "Matching failed", "The matcher returned no statistics.");
        return;
      }
      setLastStats(stats);
      toast(
        "success",
        "Matching complete",
        `${stats.candidatesEvaluated} pairs evaluated: ${stats.recommended} recommended, ` +
          `${stats.blocked} blocked by conflicts, ${stats.candidatesRejected} below the candidate floor.`,
      );
    } catch (err: any) {
      toast("error", "Matching failed", err.message || "The matcher could not be run.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Matching Engine"
        description="Compares every material record against the others with the deterministic matcher and queues the survivors for human review. Nothing is merged automatically."
        action={
          <Button onClick={run} disabled={running}>
            <Sparkles className="h-4 w-4" /> {running ? "Running..." : "Run matching"}
          </Button>
        }
      />

      <Card className="mb-4 border-info/40 bg-info/5">
        <CardContent className="flex gap-3 p-4">
          <Info className="h-5 w-5 shrink-0 text-info" />
          <div className="text-sm">
            <p className="font-semibold">This is a rule-based engine, not a trained model</p>
            <p className="mt-1 text-muted-foreground">
              Confidence is a computed score combining description agreement and attribute agreement, applying the
              same weights and thresholds as the backend <span className="font-mono">MatchService</span> and{" "}
              <span className="font-mono">matcher.py</span>. It is not a probability that two records are the same
              item, and no language model is involved. A candidate must reach the{" "}
              {DECISION_POLICY.candidateFloor} floor to be queued, and any attribute conflict blocks it regardless of
              score.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>How a run is computed</CardTitle>
          <CardDescription>
            Applied synchronously to the {proto.materials.length} records currently loaded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {stages.map((s, i) => (
              <div key={s.key} className="rounded-md border px-3 py-2.5 text-sm">
                <p className="font-medium">{i + 1}. {s.label}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </div>

          {lastStats && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <RunStat label="Pairs evaluated" value={lastStats.candidatesEvaluated} />
              <RunStat label="Recommended" value={lastStats.recommended} />
              <RunStat label="Blocked by conflict" value={lastStats.blocked} danger={lastStats.blocked > 0} />
              <RunStat label="Below floor" value={lastStats.candidatesRejected} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBox label="Candidates awaiting review" value={pending.length.toLocaleString()} tone="warning" />
        <StatBox label="Blocked by conflict" value={proto.reviewItems.filter((r) => r.autoMergeBlocked).length.toLocaleString()} tone="danger" />
        <StatBox
          label="Last run"
          value={proto.lastMatchedAt ? new Date(proto.lastMatchedAt).toLocaleString() : "—"}
          tone="neutral"
        />
      </div>

      <Card className="mt-5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Candidates awaiting review</CardTitle>
            <CardDescription>
              Each row is an undecided pair produced by the engine. Full evidence is on the review queue.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => navigate("/review-queue")}>
            <Inbox className="h-4 w-4" /> Open Review Queue
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No candidates awaiting review. Ingest material records from at least two source documents, then run the
              matcher.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Record A</TH>
                  <TH>Record B</TH>
                  <TH>Confidence</TH>
                  <TH>Engine verdict</TH>
                  <TH>Suggested code</TH>
                </TR>
              </THead>
              <TBody>
                {pending.slice(0, 8).map((r) => (
                  <TR key={r.id} className="cursor-pointer" onClick={() => navigate("/review-queue")}>
                    <TD className="max-w-xs">
                      <p className="font-medium">{r.descA}</p>
                      <p className="text-xs text-muted-foreground">{r.cpseA} · {r.codeA}</p>
                      <OriginTag materialId={r.materialIdA} />
                    </TD>
                    <TD className="max-w-xs">
                      <p className="font-medium">{r.descB}</p>
                      <p className="text-xs text-muted-foreground">{r.cpseB} · {r.codeB}</p>
                      <OriginTag materialId={r.materialIdB} />
                    </TD>
                    <TD>
                      <span className={`font-medium ${r.confidence >= 0.8 ? "text-success" : r.confidence >= 0.6 ? "text-warning" : "text-destructive"}`}>
                        {Math.round(r.confidence * 100)}%
                      </span>
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-1">
                        {r.autoMergeBlocked ? (
                          <Badge tone="danger"><ShieldAlert className="h-3 w-3" /> BLOCKED</Badge>
                        ) : (
                          <Badge tone={r.recommendation === "RECOMMEND_APPROVAL" ? "success" : "warning"}>
                            {r.recommendation ? RECOMMENDATION_LABEL[r.recommendation] : "review"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {(r.classification ?? r.category).replace(/_/g, " ").toLowerCase()}
                        </span>
                      </div>
                    </TD>
                    <TD><span className="font-mono text-xs">{r.suggestedNmc}</span></TD>
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

/** Provenance resolved from the record itself rather than assumed. */
function OriginTag({ materialId }: { materialId?: number }) {
  const { materials } = useProto();
  const m = materials.find((x) => x.id === materialId);
  if (!m?.origin) return null;
  return (
    <Badge tone={ORIGIN_TONE[m.origin]} className="mt-1">
      {m.origin}
      {m.itemLevel === false ? " · notice" : ""}
    </Badge>
  );
}

function RunStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-md border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${danger ? "text-destructive" : ""}`}>{value}</p>
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
