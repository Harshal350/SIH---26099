import { useNavigate, Link } from "react-router-dom";
import {
  HardDrive, Landmark, Sparkles, Inbox, ShieldAlert, BadgeCheck, UploadCloud,
  ExternalLink, ChevronRight,
} from "lucide-react";
import { useProto } from "@/context/prototype-data";
import { DECISION_POLICY } from "@/lib/matching";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const proto = useProto();
  const navigate = useNavigate();
  const { loading } = proto;

  const stats = proto.matchingStats;
  const materialsTotal = proto.materials.length;
  const connectedRepos = proto.repos.filter((r) => r.status !== "DISCONNECTED");
  const dqOpen = proto.dqRecords.filter((r) => r.status !== "REMEDIATED").length;

  const liveCount = proto.materials.filter((m) => m.origin === "LIVE").length;
  const referenceCount = proto.materials.filter((m) => m.origin === "REFERENCE").length;
  const demoCount = proto.materials.filter((m) => m.origin === "DEMO").length;

  const assignedCodes = new Set(proto.mappings.map((m) => m.nationalCode));
  const mappedRecords = proto.materials.filter((m) => Boolean(m.nmcCode)).length;
  const coveragePct = materialsTotal ? Math.round((mappedRecords / materialsTotal) * 100) : 0;

  const asOf = proto.lastMatchedAt
    ? new Date(proto.lastMatchedAt).toLocaleString()
    : "not run in this session";

  const cards = [
    {
      label: "Connected Repositories",
      icon: <HardDrive className="h-5 w-5" />,
      value: `${connectedRepos.length} of ${proto.repos.length}`,
      to: "/repositories",
      description: "Source portals configured for this workspace. Health and last successful sync are tracked per portal.",
      footer: (
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{connectedRepos.filter((r) => r.health === "Healthy").length} healthy</Badge>
          <Badge tone="warning">{connectedRepos.filter((r) => r.health !== "Healthy" && r.status !== "DISCONNECTED").length} need attention</Badge>
        </div>
      ),
    },
    {
      label: "Source Records",
      icon: <Landmark className="h-5 w-5" />,
      value: materialsTotal.toLocaleString(),
      to: "/material-master",
      description: `Every record ingested. ${stats.matchableMaterials} classified as MATERIAL and eligible for matching; ${stats.excludedNonMaterial} classified as service, work or consultancy and excluded.`,
      footer: (
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{liveCount} live</Badge>
          <Badge tone="info">{referenceCount} reference</Badge>
          <Badge tone="warning">{demoCount} demo</Badge>
        </div>
      ),
    },
    {
      label: "Match Candidates",
      icon: <Sparkles className="h-5 w-5" />,
      value: stats.candidatesEvaluated.toLocaleString(),
      to: "/ai-matching",
      description: `Candidate pairs scored by the deterministic matcher across ${stats.matchableMaterials} material records. A pair is only surfaced when its confidence reaches the ${DECISION_POLICY.candidateFloor} candidate floor.`,
      footer: (
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{stats.recommended} recommended</Badge>
          <Badge tone="danger">{stats.blocked} conflict-blocked</Badge>
          <Badge tone="neutral">{stats.candidatesRejected} below floor</Badge>
        </div>
      ),
    },
    {
      label: "Human Decisions",
      icon: <Inbox className="h-5 w-5" />,
      value: `${stats.pendingReview} pending`,
      to: "/review-queue",
      description:
        "No record is ever merged automatically. A pair becomes a national material code only after a reviewer approves it.",
      footer: (
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{stats.approved} approved</Badge>
          <Badge tone="neutral">{stats.rejected} rejected</Badge>
          <Badge tone="warning">
            {proto.reviewItems.filter((r) => r.priority === "HIGH" && r.status === "PENDING").length} high priority
          </Badge>
        </div>
      ),
    },
    {
      label: "National Material Codes",
      icon: <BadgeCheck className="h-5 w-5" />,
      value: `${assignedCodes.size} assigned`,
      to: "/procurement",
      description: `Distinct NMC codes created by human approval, covering ${mappedRecords} of ${materialsTotal} source records (${coveragePct}%). Codes are never created by the matcher alone.`,
      footer: (
        <div className="space-y-1.5">
          <Progress value={coveragePct / 100} tone={coveragePct >= 70 ? "success" : coveragePct >= 40 ? "warning" : "danger"} />
          <p className="text-xs text-muted-foreground">
            {coveragePct}% of {materialsTotal} source records carry an approved NMC
          </p>
        </div>
      ),
    },
    {
      label: "Data Quality",
      icon: <ShieldAlert className="h-5 w-5" />,
      value: `${dqOpen} open`,
      to: "/data-quality",
      description: `Open extraction issues detected in ${proto.dqRecords.length} flagged record(s), each generated from a specific missing or contradictory attribute.`,
      footer: (
        <div className="flex flex-wrap gap-2">
          <Badge tone={dqOpen > 0 ? "warning" : "success"}>{dqOpen} open</Badge>
          <Badge tone="success">{proto.dqRecords.length - dqOpen} remediated</Badge>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A live view of the CPSE material ingestion, normalization, AI matching, review and procurement workflow."
        action={
          <Link to="/migration">
            <Button>
              <UploadCloud className="h-4 w-4" /> Import Material Data
            </Button>
          </Link>
        }
      />

      {loading && materialsTotal === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="mb-3 h-5 w-32" /><Skeleton className="h-8 w-40" /><Skeleton className="mt-3 h-3 w-full" /></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <button
              key={c.label}
              onClick={() => navigate(c.to)}
              className="rounded-lg border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">{c.icon}</span>
                  {c.label}
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{c.value}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{c.description}</p>
              {c.footer && <div className="mt-3">{c.footer}</div>}
            </button>
          ))}
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h3 className="font-semibold">Your workflow</h3>
            <p className="text-sm text-muted-foreground">
              Import or sync CPSE data → resolve data quality → run matching → human review and approval → national codes are created and reflected across every module.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/data-quality")}>Fix data quality</Button>
            <Button onClick={() => navigate("/ai-matching")}>Run matching</Button>
          </div>
        </div>
        <div className="border-t bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
          Match statistics as of <span className="font-medium text-foreground">{asOf}</span>. Counts are computed from the
          records currently loaded in this browser; nothing here is pre-computed or hard-coded.
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Recent activity</h3>
        <div className="mt-3 space-y-1.5 text-sm">
          {proto.auditEvents.slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0">
              <span className="truncate text-muted-foreground">{e.detail}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {proto.auditEvents.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        </div>
      </Card>
    </div>
  );
}
