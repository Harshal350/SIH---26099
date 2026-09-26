import { useMemo, useState } from "react";
import { ShieldCheck, Search, Download, Sparkles, CheckCircle2, FilterX, ArrowRight } from "lucide-react";
import { useProto, DqRecord, DqSeverity } from "@/context/prototype-data";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Select, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

function sevTone(s: DqSeverity) {
  return s === "ERROR" ? ("danger" as const) : ("warning" as const);
}

export default function DataQuality() {
  const { dqRecords, remediateDq, sendDqToAi, materials } = useProto();
  const { toast } = useToast();

  const [cpse, setCpse] = useState("ALL");
  const [issue, setIssue] = useState("ALL");
  const [sev, setSev] = useState("ALL");
  const [status, setStatus] = useState("OPEN");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [inspecting, setInspecting] = useState<DqRecord | null>(null);
  const pageSize = 8;

  const openCount = dqRecords.filter((r) => r.status !== "REMEDIATED").length;
  const errorCount = dqRecords.filter((r) => r.severity === "ERROR" && r.status !== "REMEDIATED").length;
  const remediatedCount = dqRecords.filter((r) => r.status === "REMEDIATED").length;

  const cpseOptions = useMemo(() => Array.from(new Set(dqRecords.map((r) => r.cpse))).sort(), [dqRecords]);
  const issueOptions = useMemo(
    () => Array.from(new Set(dqRecords.map((r) => r.issueType))).sort(),
    [dqRecords],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return dqRecords.filter((r) => {
      if (cpse !== "ALL" && r.cpse !== cpse) return false;
      if (issue !== "ALL" && r.issueType !== issue) return false;
      if (sev !== "ALL" && r.severity !== sev) return false;
      if (status !== "ALL" && r.status !== status) return false;
      if (q && !`${r.rawDescription} ${r.sourceCode} ${r.cpse} ${r.field ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [dqRecords, cpse, issue, sev, status, query]);

  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const pageHasRemediated = pageItems.some((r) => r.status === "REMEDIATED");

  function sendToMatching(ids: number[]) {
    sendDqToAi(ids);
    toast(
      "success",
      "Re-processed",
      "Attributes were re-extracted from the corrected text and the records were re-run through the matcher.",
    );
  }

  function resetFilters() {
    setStatus("ALL");
    setCpse("ALL");
    setIssue("ALL");
    setSev("ALL");
    setQuery("");
    setPage(0);
  }

  return (
    <div>
      <PageHeader
        title="Data Quality"
        description="Every issue below is derived from a record in the current dataset: it names the field at fault and the step that would resolve it. Scores come from the deterministic extractor, not from an AI judgement."
        action={
          <Button
            variant="outline"
            onClick={() => {
              const header = "CPSE,SourceCode,RecordType,Field,IssueType,Severity,Status,RecommendedAction";
              const rows = dqRecords.map((r) =>
                [
                  r.cpse,
                  r.sourceCode,
                  materials.find((m) => m.id === Math.floor(r.id / 100))?.recordType ?? "",
                  `"${r.field ?? ""}"`,
                  r.issueType,
                  r.severity,
                  r.status,
                  `"${(r.recommendedAction ?? "").replace(/"/g, "'")}"`,
                ].join(","),
              );
              const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "data-quality-report.csv";
              a.click();
            }}
          >
            <Download className="h-4 w-4" /> Download report
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Open issues</p>
          <p className="text-2xl font-semibold">{openCount}</p>
          <p className="text-xs text-muted-foreground">across {materials.length} ingested records</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Errors (blocking)</p>
          <p className="text-2xl font-semibold text-destructive">{errorCount}</p>
          <p className="text-xs text-muted-foreground">record cannot be compared without a code and description</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Remediated this session</p>
          <p className="text-2xl font-semibold text-success">{remediatedCount}</p>
          <p className="text-xs text-muted-foreground">corrections re-fed into extraction and matching</p>
        </Card>
      </div>

      <Card className="mb-4 mt-6 p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search descriptions, codes or fields..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select value={cpse} onChange={(e) => { setCpse(e.target.value); setPage(0); }}>
            <option value="ALL">All source organisations</option>
            {cpseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={issue} onChange={(e) => { setIssue(e.target.value); setPage(0); }}>
            <option value="ALL">All issue types</option>
            {issueOptions.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </Select>
          <Select value={sev} onChange={(e) => { setSev(e.target.value); setPage(0); }}>
            <option value="ALL">All severities</option>
            <option value="ERROR">Error</option>
            <option value="WARNING">Warning</option>
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="OPEN">Open</option>
            <option value="REMEDIATED">Remediated</option>
            <option value="REVIEW">In review</option>
            <option value="ALL">All status</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-10 w-10 text-muted-foreground" />}
          title="No issues in this view"
          description="Adjust the filters, or note that a fully clean dataset still shows no open issues by definition."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <span className="text-sm text-muted-foreground">{filtered.length} issues</span>
              <div className="flex gap-2">
                <Button
                  variant="success"
                  size="sm"
                  disabled={!pageHasRemediated}
                  onClick={() => sendToMatching(pageItems.filter((r) => r.status === "REMEDIATED").map((r) => r.id))}
                >
                  <Sparkles className="h-4 w-4" /> Re-run matching on remediated
                </Button>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <FilterX className="h-4 w-4" /> Reset
                </Button>
              </div>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Source code</TH>
                  <TH>Field at fault</TH>
                  <TH>Raw description</TH>
                  <TH>Recommended action</TH>
                  <TH>DNA</TH>
                  <TH>Severity</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <p className="font-mono text-sm">{r.sourceCode || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.cpse}</p>
                    </TD>
                    <TD>
                      <p className="text-sm font-medium">{r.field ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{humanize(r.issueType)}</p>
                    </TD>
                    <TD className="max-w-[200px] text-sm">
                      {r.rawDescription || <span className="text-muted-foreground">missing</span>}
                    </TD>
                    <TD className="max-w-[280px] text-sm text-muted-foreground">
                      {r.recommendedAction ?? "—"}
                    </TD>
                    <TD><Badge tone={r.dnaStatus === "COMPLETE" ? "success" : r.dnaStatus === "PARTIAL" ? "warning" : "danger"}>{r.dnaStatus}</Badge></TD>
                    <TD><Badge tone={sevTone(r.severity)}>{r.severity}</Badge></TD>
                    <TD>
                      <Badge tone={r.status === "REMEDIATED" ? "success" : r.status === "REVIEW" ? "info" : "warning"}>
                        {r.status}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setInspecting(r)}>
                        Inspect / Remediate
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
          </CardContent>
        </Card>
      )}

      {inspecting && (
        <RemediateDialog
          record={inspecting}
          onClose={() => setInspecting(null)}
          onSave={(patch) => {
            remediateDq(inspecting.id, patch);
            toast(
              "success",
              "Record remediated",
              `${inspecting.sourceCode} updated. The corrected wording is now what extraction and matching read; the raw source text is unchanged.`,
            );
            setInspecting(null);
          }}
          onSendToMatching={() => {
            remediateDq(inspecting.id, {});
            sendToMatching([inspecting.id]);
            setInspecting(null);
          }}
        />
      )}
    </div>
  );
}

function RemediateDialog({
  record, onClose, onSave, onSendToMatching,
}: {
  record: DqRecord;
  onClose: () => void;
  onSave: (p: Partial<DqRecord>) => void;
  onSendToMatching: () => void;
}) {
  const { materials } = useProto();
  const [extracted, setExtracted] = useState(record.extractedDescription);
  const [sourceCode, setSourceCode] = useState(record.sourceCode);
  const [dnaStatus, setDnaStatus] = useState(record.dnaStatus);

  const source = materials.find((m) => m.id === Math.floor(record.id / 100));
  const alreadyRemediated = record.status === "REMEDIATED";

  return (
    <Modal open onClose={onClose} title={`Inspect ${record.sourceCode || "record"}`} size="md">
      <div className="space-y-4 text-sm">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Raw source text (read-only)</p>
          <p>{record.rawDescription || "— missing —"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {record.cpse}
            {source?.origin && <> · <Badge tone={source.origin === "LIVE" ? "success" : source.origin === "REFERENCE" ? "info" : "warning"}>{source.origin}</Badge></>}
            {source?.itemLevel === false && <> · notice level</>}
          </p>
        </div>

        <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">Issue: {humanize(record.issueType)} on “{record.field ?? "record"}”</p>
          <p className="mt-1">{record.recommendedAction}</p>
        </div>

        {alreadyRemediated && (
          <p className="rounded-md border border-success/40 bg-success/5 p-2 text-xs text-success">
            Already remediated {new Date(record.lastUpdated).toLocaleString()}. Further edits update the record again.
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Corrected source code</label>
          <Input value={sourceCode} onChange={(e) => setSourceCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Normalised description used for matching</label>
          <Textarea value={extracted} onChange={(e) => setExtracted(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Attributes are re-extracted from this text. The original source wording is never overwritten.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Extraction status</label>
          <Select value={dnaStatus} onChange={(e) => setDnaStatus(e.target.value)}>
            <option>INCOMPLETE</option>
            <option>PARTIAL</option>
            <option>COMPLETE</option>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="success" size="sm" onClick={onSendToMatching}>
              <Sparkles className="h-4 w-4" /> Save and re-run matching
            </Button>
            <Button onClick={() => onSave({ extractedDescription: extracted, sourceCode, dnaStatus })}>
              <CheckCircle2 className="h-4 w-4" /> Save only
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function humanize(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
