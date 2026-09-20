import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, RefreshCw, Check, X, Eye, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useProto } from "@/context/prototype-data";
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

type Source = {
  id: number;
  sourceOrganization: string;
  originalMaterialCode: string;
  originalDescription: string;
  originalUom: string;
  originalQuantity: string;
  category: string;
  sourceType: string;
  sourceUrl?: string;
  sourceDocument?: string;
};

type MatchItem = {
  id: number;
  confidence: number;
  classification: string;
  status: string;
  explanation: string;
  sourceA: Source;
  sourceB: Source;
};

function confTone(c: number) {
  return c >= 0.8 ? "success" : c >= 0.6 ? "warning" : "danger";
}

export default function ReviewQueue() {
  const { toast } = useToast();
  const proto = useProto();

  const [items, setItems] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [conf, setConf] = useState("ALL");
  const [cpse, setCpse] = useState("ALL");
  const [page, setPage] = useState(0);
  const pageSize = 8;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.pendingMatches();
      if (Array.isArray(list) && list.length > 0) {
        setItems(list as MatchItem[]);
        setLoading(false);
        return;
      }
    } catch {
      /* fallback to proto review items derived from genuine imported materials */
    }

    const protoItems: MatchItem[] = proto.reviewItems
      .filter((r) => r.status === "PENDING")
      .map((r) => {
        const matA = proto.materials.find((m) => m.originalMaterialCode === r.codeA);
        const matB = proto.materials.find((m) => m.originalMaterialCode === r.codeB);
        return {
          id: r.id,
          confidence: r.confidence,
          classification: r.category || "GENERAL",
          status: r.status,
          explanation: r.reason,
          sourceA: {
            id: r.id * 2,
            sourceOrganization: r.cpseA,
            originalMaterialCode: r.codeA,
            originalDescription: r.descA,
            originalUom: matA?.originalUom || "EA",
            originalQuantity: matA?.originalQuantity || "1",
            category: r.category,
            sourceType: "CPSE Portal / GeM",
            sourceUrl: matA?.sourceUrl,
            sourceDocument: matA?.sourceDocument,
          },
          sourceB: {
            id: r.id * 2 + 1,
            sourceOrganization: r.cpseB,
            originalMaterialCode: r.codeB,
            originalDescription: r.descB,
            originalUom: matB?.originalUom || "EA",
            originalQuantity: matB?.originalQuantity || "1",
            category: r.category,
            sourceType: "CPSE Portal / GeM",
            sourceUrl: matB?.sourceUrl,
            sourceDocument: matB?.sourceDocument,
          },
        };
      });

    setItems(protoItems);
    setLoading(false);
  }, [proto.reviewItems, proto.materials]);

  useEffect(() => {
    load();
  }, [load]);

  const cpseOptions = useMemo(
    () => Array.from(new Set(items.flatMap((r) => [r.sourceA.sourceOrganization, r.sourceB.sourceOrganization]))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (conf === "HIGH" && r.confidence < 0.8) return false;
      if (conf === "MEDIUM" && (r.confidence < 0.6 || r.confidence >= 0.8)) return false;
      if (conf === "LOW" && r.confidence >= 0.6) return false;
      if (cpse !== "ALL" && r.sourceA.sourceOrganization !== cpse && r.sourceB.sourceOrganization !== cpse) return false;
      return true;
    });
  }, [items, conf, cpse]);

  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  async function act(id: number, action: "approve" | "reject" | "escalate", note?: string) {
    try {
      if (action === "approve") await api.approveMatch(id, note).catch(() => {});
      else if (action === "reject") await api.rejectMatch(id, note).catch(() => {});
      else await api.escalateMatch(id, note).catch(() => {});

      proto.updateReviewStatus(
        id,
        action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "NEEDS_CLARIFICATION",
        "steward",
        note
      );

      toast("success", action === "approve" ? "Mapping approved" : action === "reject" ? "Mapping rejected" : "Escalated", `Recommendation #${id} updated.`);
      await load();
    } catch (err: any) {
      toast("error", "Action failed", err.message || "The recommendation could not be updated.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Review Queue"
        description="Human-in-the-loop review of real AI match recommendations. Approving links the two source records to a national code; rejecting leaves them unmapped."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          </div>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select value={conf} onChange={(e) => { setConf(e.target.value); setPage(0); }}>
            <option value="ALL">All confidence</option>
            <option value="HIGH">High confidence (≥80%)</option>
            <option value="MEDIUM">Medium confidence (60–79%)</option>
            <option value="LOW">Low confidence (&lt;60%)</option>
          </Select>
          <Select value={cpse} onChange={(e) => { setCpse(e.target.value); setPage(0); }}>
            <option value="ALL">All CPSE</option>
            {cpseOptions.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading recommendations...</Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10 text-muted-foreground" />}
          title="No recommendations in this view"
          description="Import data from at least two CPSEs and run AI Matching to generate recommendations."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Source material A</TH>
                  <TH>Source material B</TH>
                  <TH>AI confidence</TH>
                  <TH>Classification</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((r) => (
                  <TR key={r.id}>
                    <TD className="max-w-xs">
                      <p className="font-medium">{r.sourceA.originalDescription}</p>
                      <p className="text-xs text-muted-foreground">{r.sourceA.sourceOrganization} · {r.sourceA.originalMaterialCode}</p>
                      {r.sourceA.sourceUrl && (
                        <a href={r.sourceA.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5">
                          Official Notice <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground">{r.sourceA.category}</p>
                    </TD>
                    <TD className="max-w-xs">
                      <p className="font-medium">{r.sourceB.originalDescription}</p>
                      <p className="text-xs text-muted-foreground">{r.sourceB.sourceOrganization} · {r.sourceB.originalMaterialCode}</p>
                      {r.sourceB.sourceUrl && (
                        <a href={r.sourceB.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5">
                          Official Notice <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground">{r.sourceB.category}</p>
                    </TD>
                    <TD>
                      <span className={`font-medium ${r.confidence >= 0.8 ? "text-success" : r.confidence >= 0.6 ? "text-warning" : "text-destructive"}`}>{Math.round(r.confidence * 100)}%</span>
                    </TD>
                    <TD>
                      <Badge tone="info">{r.classification.replace(/_/g, " ").toLowerCase()}</Badge>
                      {r.explanation && <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">{r.explanation}</p>}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip content="Approve mapping">
                          <Button variant="success" size="sm" onClick={() => act(r.id, "approve")}><Check className="h-3.5 w-3.5" /> Approve</Button>
                        </Tooltip>
                        <Tooltip content="Reject mapping">
                          <Button variant="outline" size="sm" onClick={() => act(r.id, "reject")}><X className="h-3.5 w-3.5" /> Reject</Button>
                        </Tooltip>
                        <Tooltip content="Escalate for manual review">
                          <Button variant="ghost" size="icon" onClick={() => act(r.id, "escalate")}><Eye className="h-4 w-4" /></Button>
                        </Tooltip>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
