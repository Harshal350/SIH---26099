import { useNavigate, Link } from "react-router-dom";
import {
  HardDrive, Landmark, Sparkles, Inbox, ShieldAlert, BadgeCheck, UploadCloud,
  ExternalLink, ChevronRight,
} from "lucide-react";
import { useProto } from "@/context/prototype-data";
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

  const materialsTotal = proto.materials.length;
  const connectedRepos = proto.repos.filter((r) => r.status !== "DISCONNECTED");
  const pendingReviews = proto.reviewItems.filter((r) => r.status === "PENDING").length;
  const mapped = proto.mappings.filter((m) => m.mappingStatus === "MAPPED").length;
  const dqOpen = proto.dqRecords.filter((r) => r.status !== "REMEDIATED").length;
  const normPct = Math.min(100, Math.round((mapped / Math.max(proto.mappings.length || 1, 1)) * 100));
  const dqScore = Math.max(0, 100 - dqOpen * 3);

  const cards = [
    {
      label: "Connected CPSE Repositories",
      icon: <HardDrive className="h-5 w-5" />,
      value: `${connectedRepos.length} repositories`,
      to: "/repositories",
      description: "Repositories actively feeding material records into the platform. Health, last sync time and sources are managed here.",
      footer: (
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{connectedRepos.filter((r) => r.health === "Healthy").length} healthy</Badge>
          <Badge tone="warning">{connectedRepos.filter((r) => r.health !== "Healthy" && r.status !== "DISCONNECTED").length} need attention</Badge>
        </div>
      ),
    },
    {
      label: "Normalized Materials",
      icon: <Landmark className="h-5 w-5" />,
      value: `${materialsTotal.toLocaleString()}`,
      to: "/material-master",
      description: "Source material records consolidated and normalized. Shows share of records already mapped to a National Code.",
      footer: (
        <div className="space-y-1.5">
          <Progress value={normPct / 100} tone={normPct >= 70 ? "success" : normPct >= 40 ? "warning" : "danger"} />
          <p className="text-xs text-muted-foreground">{normPct}% mapped · {materialsTotal - mapped} awaiting mapping</p>
        </div>
      ),
    },
    {
      label: "AI Matching",
      icon: <Sparkles className="h-5 w-5" />,
      value: `${proto.matchingStats.highConfidence.toLocaleString()} matched`,
      to: "/ai-matching",
      description: "Records assessed by the AI multi-layer deterministic matcher. High-confidence results become mappings; uncertain ones enter review.",
      footer: (
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{proto.matchingStats.highConfidence.toLocaleString()} high-conf</Badge>
          <Badge tone="warning">{proto.matchingStats.review.toLocaleString()} for review</Badge>
        </div>
      ),
    },
    {
      label: "Review Queue",
      icon: <Inbox className="h-5 w-5" />,
      value: `${pendingReviews} pending`,
      to: "/review-queue",
      description: "Human-in-the-loop approvals for AI match recommendations. High-priority items need attention first.",
      footer: (
        <div className="flex items-center justify-between">
          <Badge tone={pendingReviews > 0 ? "warning" : "success"}>
            {proto.reviewItems.filter((r) => r.priority === "HIGH" && r.status === "PENDING").length} high-priority
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">Open queue <ChevronRight className="h-3 w-3" /></span>
        </div>
      ),
    },
    {
      label: "Data Quality",
      icon: <ShieldAlert className="h-5 w-5" />,
      value: `${dqOpen} records need attention`,
      to: "/data-quality",
      description: "Records flagged for missing/invalid codes, duplicate materials, poor extraction or incomplete normalization. Remediation score shown.",
      footer: (
        <div className="flex items-center justify-between">
          <Badge tone={dqOpen > 0 ? "warning" : "success"}>{dqOpen} open</Badge>
          <span className="text-xs text-muted-foreground">DQ score {Math.round(dqScore)}%</span>
        </div>
      ),
    },
    {
      label: "Procurement Intelligence",
      icon: <BadgeCheck className="h-5 w-5" />,
      value: `${proto.procurement.standardizationOpps} opportunities`,
      to: "/procurement",
      description: "Aggregated spend and demand insights, standardization opportunities, duplicate detection and migration readiness across CPSEs.",
      footer: (
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{proto.procurement.nmcCoverage}% NMC coverage</Badge>
          <Badge tone={proto.procurement.unmappedPct > 20 ? "danger" : "success"}>{proto.procurement.unmappedPct}% unmapped</Badge>
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
              Import CPSE data → resolve data quality → run AI matching → review and approve → national codes are created and reflected across every module.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/data-quality")}>Fix data quality</Button>
            <Button onClick={() => navigate("/ai-matching")}>Run AI matching</Button>
          </div>
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
