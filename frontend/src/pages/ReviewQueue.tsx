import { useMemo, useState } from "react";
import { Inbox, Check, X, Eye, ExternalLink, ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";
import { useProto, ReviewItem, canApproveCandidate } from "@/context/prototype-data";
import { ATTRIBUTE_LABEL, RECOMMENDATION_LABEL, DECISION_POLICY } from "@/lib/matching";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";

const ORIGIN_TONE = { LIVE: "success", REFERENCE: "info", DEMO: "warning" } as const;

export default function ReviewQueue() {
  const { toast } = useToast();
  const proto = useProto();

  const [conf, setConf] = useState("ALL");
  const [status, setStatus] = useState("PENDING");
  const [cpse, setCpse] = useState("ALL");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const pageSize = 8;

  const items = proto.reviewItems;

  const cpseOptions = useMemo(
    () => Array.from(new Set(items.flatMap((r) => [r.cpseA, r.cpseB]))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (status === "BLOCKED" && !r.autoMergeBlocked) return false;
      if (status !== "ALL" && status !== "BLOCKED" && r.status !== status) return false;
      if (conf === "HIGH" && r.confidence < 0.8) return false;
      if (conf === "MEDIUM" && (r.confidence < 0.6 || r.confidence >= 0.8)) return false;
      if (conf === "LOW" && r.confidence >= 0.6) return false;
      if (cpse !== "ALL" && r.cpseA !== cpse && r.cpseB !== cpse) return false;
      return true;
    });
  }, [items, conf, status, cpse]);

  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const blockedCount = items.filter((r) => r.autoMergeBlocked).length;

  function act(item: ReviewItem, action: "approve" | "reject" | "escalate", note?: string) {
    if (action === "approve") {
      const verdict = canApproveCandidate(item);
      if (!verdict.ok) {
        toast("error", "Cannot approve", verdict.reason);
        return;
      }
    }
    proto.updateReviewStatus(
      item.id,
      action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "NEEDS_CLARIFICATION",
      "steward",
      note,
    );
    toast(
      action === "approve" ? "success" : action === "reject" ? "info" : "warning",
      action === "approve" ? "Match approved" : action === "reject" ? "Match rejected" : "Escalated",
      action === "approve"
        ? `${item.codeA} and ${item.codeB} are now assigned ${item.suggestedNmc}.`
        : action === "reject"
          ? "The records stay separate and unmapped."
          : "Flagged for a subject-matter expert.",
    );
  }

  function bulkApprove() {
    const ids = pageItems.filter((r) => r.status === "PENDING" && !r.autoMergeBlocked).map((r) => r.id);
    if (ids.length === 0) {
      toast("info", "Nothing to approve", "No unblocked pending item on this page.");
      return;
    }
    proto.bulkUpdateReviewStatus(ids, "steward");
  }

  return (
    <div>
      <PageHeader
        title="Review Queue"
        description="Human-in-the-loop decisions on match candidates produced by the deterministic matcher. Nothing is merged automatically: a national code appears only after a reviewer approves it."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={bulkApprove}>Approve unblocked on this page</Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pending" value={items.filter((r) => r.status === "PENDING").length} tone="warning" />
        <Stat label="Blocked by conflict" value={blockedCount} tone="danger" />
        <Stat label="Approved" value={items.filter((r) => r.status === "APPROVED").length} tone="success" />
        <Stat label="Rejected" value={items.filter((r) => r.status === "REJECTED").length} tone="neutral" />
      </div>

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="PENDING">Pending decisions</option>
            <option value="BLOCKED">Blocked by technical conflict</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All candidates</option>
          </Select>
          <Select value={conf} onChange={(e) => { setConf(e.target.value); setPage(0); }}>
            <option value="ALL">All confidence</option>
            <option value="HIGH">High (≥80%)</option>
            <option value="MEDIUM">Medium (60–79%)</option>
            <option value="LOW">Low (&lt;60%)</option>
          </Select>
          <Select value={cpse} onChange={(e) => { setCpse(e.target.value); setPage(0); }}>
            <option value="ALL">All source organisations</option>
            {cpseOptions.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          A candidate is only listed when its confidence reaches the {DECISION_POLICY.candidateFloor} candidate floor.
          Bulk approval deliberately skips anything with a technical conflict.
        </p>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10 text-muted-foreground" />}
          title="No candidates in this view"
          description="Candidates appear once at least two MATERIAL records from different source records are scored above the candidate floor."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Source record A</TH>
                  <TH>Source record B</TH>
                  <TH>Confidence</TH>
                  <TH>Engine verdict</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Decision</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((r) => {
                  const open = expanded === r.id;
                  return (
                    <>
                      <TR key={r.id}>
                        <TD className="max-w-[220px]">
                          <button
                            className="flex items-center gap-1 text-left"
                            onClick={() => setExpanded(open ? null : r.id)}
                          >
                            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <span className="font-medium">{r.descA}</span>
                          </button>
                          <p className="mt-0.5 pl-4.5 text-xs text-muted-foreground">{r.cpseA} · {r.codeA}</p>
                        </TD>
                        <TD className="max-w-[220px]">
                          <p className="font-medium">{r.descB}</p>
                          <p className="text-xs text-muted-foreground">{r.cpseB} · {r.codeB}</p>
                        </TD>
                        <TD>
                          <span className={`font-medium ${r.confidence >= 0.8 ? "text-success" : r.confidence >= 0.6 ? "text-warning" : "text-destructive"}`}>
                            {(r.confidence * 100).toFixed(1)}%
                          </span>
                        </TD>
                        <TD>
                          <div className="flex flex-col gap-1">
                            {r.autoMergeBlocked ? (
                              <Badge tone="danger"><ShieldAlert className="h-3 w-3" /> AUTO-MERGE BLOCKED</Badge>
                            ) : (
                              <Badge tone={r.recommendation === "RECOMMEND_APPROVAL" ? "success" : "warning"}>
                                {r.recommendation ? RECOMMENDATION_LABEL[r.recommendation] : "review"}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{r.classification?.replace(/_/g, " ").toLowerCase()}</span>
                          </div>
                        </TD>
                        <TD>
                          <Badge tone={r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "neutral" : r.status === "NEEDS_CLARIFICATION" ? "info" : "warning"}>
                            {r.status.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                          {r.reviewedBy && <p className="mt-0.5 text-xs text-muted-foreground">by {r.reviewedBy}</p>}
                        </TD>
                        <TD className="text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip
                              content={
                                canApproveCandidate(r).ok
                                  ? `Approve and assign ${r.suggestedNmc}`
                                  : (canApproveCandidate(r) as { ok: false; reason: string }).reason
                              }
                            >
                              <span>
                                <Button
                                  variant="success"
                                  size="sm"
                                  disabled={!canApproveCandidate(r).ok || r.status === "APPROVED"}
                                  onClick={() => act(r, "approve")}
                                >
                                  <Check className="h-3.5 w-3.5" /> Approve
                                </Button>
                              </span>
                            </Tooltip>
                            <Tooltip content="Keep the records separate">
                              <Button variant="outline" size="sm" disabled={r.status === "REJECTED"} onClick={() => act(r, "reject")}>
                                <X className="h-3.5 w-3.5" /> Reject
                              </Button>
                            </Tooltip>
                            <Tooltip content="Escalate to a subject-matter expert">
                              <Button variant="ghost" size="icon" onClick={() => act(r, "escalate")}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          </div>
                        </TD>
                      </TR>
                      {open && (
                        <TR key={`${r.id}-detail`}>
                          <TD colSpan={6} className="bg-muted/20">
                            <EvidencePanel item={r} />
                          </TD>
                        </TR>
                      )}
                    </>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EvidencePanel({ item }: { item: ReviewItem }) {
  const { materials } = useProto();
  const srcA = materials.find((m) => m.id === item.materialIdA);
  const srcB = materials.find((m) => m.id === item.materialIdB);

  return (
    <div className="space-y-3 py-2 text-xs">
      <div className="grid gap-3 sm:grid-cols-2">
        <SourceBlock label="Record A" desc={item.descA} org={item.cpseA} code={item.codeA} url={srcA?.sourceUrl} origin={srcA?.origin} itemLevel={srcA?.itemLevel} />
        <SourceBlock label="Record B" desc={item.descB} org={item.cpseB} code={item.codeB} url={srcB?.sourceUrl} origin={srcB?.origin} itemLevel={srcB?.itemLevel} />
      </div>

      {item.evidence && (
        <>
          <div>
            <p className="font-semibold">Attribute comparison</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {item.evidence.attributes.map((a) => (
                <Badge
                  key={a.attribute}
                  tone={a.status === "SAME" ? "success" : a.status === "DIFF" ? "danger" : "neutral"}
                >
                  {ATTRIBUTE_LABEL[a.attribute]}:{" "}
                  {a.status === "DIFF" ? `${a.sourceA} ≠ ${a.sourceB}` : a.status === "MISSING" ? "missing on one side" : a.sourceA}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold">Why the engine decided this</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {item.evidence.reasons.map((r, i) => <li key={i}>{r}</li>)}
              
            </ul>
          </div>

          {item.evidence && item.evidence.blockers.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
              <p className="font-semibold text-destructive">Blockers — this pair cannot be merged automatically</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-destructive">
                {item.evidence.blockers.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          )}

          <p className="text-muted-foreground">
            Confidence is computed as 55% description agreement + 45% technical attribute agreement, reduced for
            attributes missing on either side. It is a computed score, not a probability that these are the same item.
          </p>
        </>
      )}

      {item.note && <p className="text-muted-foreground">Reviewer note: {item.note}</p>}

      {!item.autoMergeBlocked && item.status === "PENDING" && (
        <p className="text-muted-foreground">
          Approving will assign <span className="font-mono text-primary">{item.suggestedNmc}</span> to both records.
        </p>
      )}
    </div>
  );
}

function SourceBlock({
  label, desc, org, code, url, origin, itemLevel,
}: {
  label: string;
  desc: string;
  org: string;
  code: string;
  url?: string;
  origin?: "LIVE" | "REFERENCE" | "DEMO";
  itemLevel?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{label}</span>
        {origin && <Badge tone={ORIGIN_TONE[origin]}>{origin}</Badge>}
        {itemLevel !== undefined && (
          <Badge tone={itemLevel ? "neutral" : "warning"}>{itemLevel ? "item level" : "notice level"}</Badge>
        )}
      </div>
      <p className="mt-1 font-medium">{desc}</p>
      <p className="text-muted-foreground">{org} · <span className="font-mono">{code}</span></p>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
          Open the real source record <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" | "neutral" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">
        <Badge tone={tone}>{value}</Badge>
      </p>
    </div>
  );
}
