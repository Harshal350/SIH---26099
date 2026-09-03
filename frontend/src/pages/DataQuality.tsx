import { useMemo, useState } from "react";
import { ShieldCheck, Search, Download, Sparkles, CheckCircle2, FilterX } from "lucide-react";
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
  const { dqRecords, remediateDq, sendDqToAi } = useProto();
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
  const dqScore = Math.max(0, Math.round(100 - openCount * 2.5));

  const cpseOptions = useMemo(() => Array.from(new Set(dqRecords.map((r) => r.cpse))).sort(), [dqRecords]);
  const issueOptions = useMemo(() => Array.from(new Set(dqRecords.map((r) => r.issueType))).sort(), [dqRecords]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return dqRecords.filter((r) => {
      if (cpse !== "ALL" && r.cpse !== cpse) return false;
      if (issue !== "ALL" && r.issueType !== issue) return false;
      if (sev !== "ALL" && r.severity !== sev) return false;
      if (status !== "ALL" && r.status !== status) return false;
      if (q && !`${r.rawDescription} ${r.sourceCode} ${r.cpse}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dqRecords, cpse, issue, sev, status, query]);
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  function sendToAi(ids: number[]) {
    sendDqToAi(ids);
    toast("success", "Sent to AI matching", `${ids.length} remediated records were queued for AI matching.`);
  }

  return (
    <div>
      <PageHeader
        title="Data Quality"
        description="Records that need attention, and remediation tools to make data AI-matching ready."
        action={
          <Button variant="outline" onClick={() => {
            const csv = ["CPSE,SourceCode,RawDescription,IssueType,Severity,Status"].concat(
              dqRecords.map((r) => `${r.cpse},${r.sourceCode},"${r.rawDescription}",${r.issueType},${r.severity},${r.status}`)
            ).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "data-quality-report.csv"; a.click();
          }}>
            <Download className="h-4 w-4" /> Download report
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Records needing attention</p><p className="text-2xl font-semibold">{openCount}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Errors (blocking)</p><p className="text-2xl font-semibold text-destructive">{errorCount}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Data-quality score</p><p className={`text-2xl font-semibold ${dqScore >= 70 ? "text-success" : "text-warning"}`}>{dqScore}%</p></Card>
      </div>

      <Card className="mb-4 mt-6 p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search records..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select value={cpse} onChange={(e) => { setCpse(e.target.value); setPage(0); }}><option value="ALL">All CPSE</option>{cpseOptions.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select value={issue} onChange={(e) => { setIssue(e.target.value); setPage(0); }}><option value="ALL">All issue types</option>{issueOptions.map((c) => <option key={c}>{humanize(c)}</option>)}</Select>
          <Select value={sev} onChange={(e) => { setSev(e.target.value); setPage(0); }}><option value="ALL">All severity</option><option value="ERROR">Error</option><option value="WARNING">Warning</option></Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="ALL">All status</option><option value="OPEN">Open</option><option value="REMEDIATED">Remediated</option><option value="REVIEW">In review</option></Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-10 w-10 text-muted-foreground" />} title="No records match" description="Adjust filters or search." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <span className="text-sm text-muted-foreground">{filtered.length} records</span>
              <div className="flex gap-2">
                <Button variant="success" size="sm" onClick={() => sendToAi(filtered.map((r) => r.id))}><Sparkles className="h-4 w-4" /> Send remediated to AI</Button>
                <Button variant="outline" size="sm" onClick={() => { setStatus("ALL"); setCpse("ALL"); setIssue("ALL"); setSev("ALL"); setQuery(""); }}><FilterX className="h-4 w-4" /> Reset</Button>
              </div>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>CPSE</TH>
                  <TH>Source code</TH>
                  <TH>Raw description</TH>
                  <TH>Extracted / issue</TH>
                  <TH>DNA status</TH>
                  <TH>Remediation</TH>
                  <TH>Issue type</TH>
                  <TH>Severity</TH>
                  <TH>Status</TH>
                  <TH>Last updated</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((r) => (
                  <TR key={r.id}>
                    <TD><Badge>{r.cpse}</Badge></TD>
                    <TD className="font-mono text-sm">{r.sourceCode}</TD>
                    <TD className="max-w-[200px] text-sm">{r.rawDescription}</TD>
                    <TD className="max-w-[160px] text-sm text-muted-foreground">{r.extractedDescription}</TD>
                    <TD><Badge tone={r.dnaStatus === "COMPLETE" ? "success" : "warning"}>{r.dnaStatus}</Badge></TD>
                    <TD>{r.remediationRequired ? <Badge tone="warning">Required</Badge> : <Badge tone="success">None</Badge>}</TD>
                    <TD className="text-sm">{humanize(r.issueType)}</TD>
                    <TD><Badge tone={sevTone(r.severity)}>{r.severity}</Badge></TD>
                    <TD><Badge tone={r.status === "REMEDIATED" ? "success" : r.status === "REVIEW" ? "info" : "warning"}>{r.status}</Badge></TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{new Date(r.lastUpdated).toLocaleDateString()}</TD>
                    <TD className="text-right"><Button variant="outline" size="sm" onClick={() => setInspecting(r)}>Inspect / Remediate</Button></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
          </CardContent>
        </Card>
      )}

      {inspecting && <RemediateDialog record={inspecting} onClose={() => setInspecting(null)} onSave={(patch) => { remediateDq(inspecting.id, patch); toast("success", "Record remediated", `${inspecting.sourceCode} marked remediated and data-quality metrics updated.`); setInspecting(null); }} onSendToAi={() => { remediateDq(inspecting.id, {}); sendToAi([inspecting.id]); setInspecting(null); }} />}
    </div>
  );
}

function RemediateDialog({ record, onClose, onSave, onSendToAi }: { record: DqRecord; onClose: () => void; onSave: (p: Partial<DqRecord>) => void; onSendToAi: () => void }) {
  const [extracted, setExtracted] = useState(record.extractedDescription);
  const [sourceCode, setSourceCode] = useState(record.sourceCode);
  const [dnaStatus, setDnaStatus] = useState(record.dnaStatus);

  return (
    <Modal open onClose={onClose} title={`Remediate record ${record.sourceCode}`} size="md">
      <div className="space-y-4 text-sm">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Raw description</p>
          <p>{record.rawDescription}</p>
          <p className="mt-1 text-xs text-muted-foreground">CPSE: {record.cpse} · Issue: {humanize(record.issueType)} · Severity: <Badge tone={sevTone(record.severity)}>{record.severity}</Badge></p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Corrected source code</label>
          <Input value={sourceCode} onChange={(e) => setSourceCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Edit extracted description</label>
          <Textarea value={extracted} onChange={(e) => setExtracted(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">DNA / normalization status</label>
          <Select value={dnaStatus} onChange={(e) => setDnaStatus(e.target.value)}>
            <option>INCOMPLETE</option>
            <option>PARTIAL</option>
            <option>COMPLETE</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="success" size="sm" onClick={onSendToAi}><Sparkles className="h-4 w-4" /> Fix & send to AI</Button>
            <Button onClick={() => onSave({ extractedDescription: extracted, sourceCode, dnaStatus })}><CheckCircle2 className="h-4 w-4" /> Mark remediated</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function humanize(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
