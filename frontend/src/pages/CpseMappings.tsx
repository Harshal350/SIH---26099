import { useMemo, useState } from "react";
import { Link2, FileSearch, ShieldCheck, ShieldX, FilterX, Loader2 } from "lucide-react";
import { useProto, Mapping } from "@/context/prototype-data";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

function statusTone(s: string) {
  if (s === "MAPPED") return "success" as const;
  if (s === "REVIEW") return "info" as const;
  return "warning" as const;
}

export default function CpseMappings() {
  const { mappings, approveMapping, rejectMapping } = useProto();
  const { toast } = useToast();

  const [cpse, setCpse] = useState("ALL");
  const [cat, setCat] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [conf, setConf] = useState("ALL");
  const [reviewer, setReviewer] = useState("ALL");
  const [page, setPage] = useState(0);
  const [docFor, setDocFor] = useState<Mapping | null>(null);
  const pageSize = 8;

  const cpseOptions = useMemo(() => Array.from(new Set(mappings.map((m) => m.cpse))).sort(), [mappings]);
  const reviewers = useMemo(() => Array.from(new Set(mappings.map((m) => m.createdBy))), [mappings]);

  const filtered = useMemo(() => {
    return mappings.filter((m) => {
      if (cpse !== "ALL" && m.cpse !== cpse) return false;
      if (cat !== "ALL" && m.nationalCode !== cat) return false;
      if (status !== "ALL" && m.mappingStatus !== status) return false;
      if (conf === "HIGH" && m.confidence < 0.8) return false;
      if (conf === "MEDIUM" && (m.confidence < 0.6 || m.confidence >= 0.8)) return false;
      if (conf === "LOW" && m.confidence >= 0.6) return false;
      if (reviewer !== "ALL" && m.createdBy !== reviewer) return false;
      return true;
    });
  }, [mappings, cpse, cat, status, conf, reviewer]);

  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const catOptions = useMemo(() => Array.from(new Set(mappings.map((m) => m.nationalDesc?.split(" ")[0] || m.nationalCode))), [mappings]);

  return (
    <div>
      <PageHeader
        title="CPSE Mappings"
        description="Every CPSE material code mapped to a National Code, with full provenance and source verification."
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Select value={cpse} onChange={(e) => { setCpse(e.target.value); setPage(0); }}>
            <option value="ALL">All CPSE</option>
            {cpseOptions.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
            <option value="ALL">All NMC categories</option>
            {catOptions.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="ALL">All status</option>
            <option value="MAPPED">Mapped</option>
            <option value="REVIEW">In review</option>
            <option value="PENDING">Pending</option>
          </Select>
          <Select value={conf} onChange={(e) => { setConf(e.target.value); setPage(0); }}>
            <option value="ALL">All confidence</option>
            <option value="HIGH">High (≥80%)</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
          <Select value={reviewer} onChange={(e) => { setReviewer(e.target.value); setPage(0); }}>
            <option value="ALL">All sources</option>
            {reviewers.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Button variant="outline" onClick={() => { setCpse("ALL"); setCat("ALL"); setStatus("ALL"); setConf("ALL"); setReviewer("ALL"); }}>
            <FilterX className="h-4 w-4" /> Reset
          </Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={<Link2 className="h-10 w-10 text-muted-foreground" />} title="No mappings match" description="Adjust filters." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>CPSE</TH>
                  <TH>Source code / raw</TH>
                  <TH>Normalized</TH>
                  <TH>National code</TH>
                  <TH>Mapping status</TH>
                  <TH>Confidence</TH>
                  <TH>Mapping source</TH>
                  <TH>Last updated</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((m) => (
                  <TR key={m.id}>
                    <TD><Badge>{m.cpse}</Badge></TD>
                    <TD className="max-w-[180px]">
                      <p className="font-mono text-sm">{m.sourceCode}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.rawDescription}</p>
                    </TD>
                    <TD className="max-w-[180px] text-sm text-muted-foreground">{m.normalizedDescription}</TD>
                    <TD>
                      <p className="font-mono text-sm font-medium text-primary">{m.nationalCode}</p>
                      <p className="text-xs text-muted-foreground">{m.nationalDesc}</p>
                    </TD>
                    <TD><Badge tone={statusTone(m.mappingStatus)}>{m.mappingStatus}</Badge></TD>
                    <TD>
                      <span className={`font-medium ${m.confidence >= 0.8 ? "text-success" : m.confidence >= 0.6 ? "text-warning" : "text-destructive"}`}>{Math.round(m.confidence * 100)}%</span>
                    </TD>
                    <TD className="text-xs">{m.mappingSource}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{new Date(m.lastUpdated).toLocaleDateString()}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip content="View source tender document"><Button variant="ghost" size="icon" onClick={() => setDocFor(m)}><FileSearch className="h-4 w-4" /></Button></Tooltip>
                        {m.mappingStatus !== "MAPPED" && (
                          <Button variant="outline" size="sm" onClick={() => { approveMapping(m.id, "steward"); toast("success", "Mapping approved", `${m.sourceCode} → ${m.nationalCode}`); }}>
                            Approve
                          </Button>
                        )}
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

      {docFor && <SourceDocPanel mapping={docFor} onClose={() => setDocFor(null)} onApprove={() => { approveMapping(docFor.id, "steward"); toast("success", "Mapping approved", "Now marked MAPPED."); setDocFor(null); }} onReject={() => { rejectMapping(docFor.id, "steward"); toast("info", "Mapping rejected", "Returned to pending."); setDocFor(null); }} />}
    </div>
  );
}

function SourceDocPanel({ mapping, onClose, onApprove, onReject }: { mapping: Mapping; onClose: () => void; onApprove: () => void; onReject: () => void }) {
  const [verifyState, setVerifyState] = useState<"idle" | "checking" | "ok" | "fail">("idle");

  function verify() {
    setVerifyState("checking");
    setTimeout(() => setVerifyState(mapping.tenderUrl ? "ok" : "fail"), 900);
  }

  return (
    <Modal open onClose={onClose} title="Source tender document" size="lg">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Info k="Tender document" v={mapping.tenderDocName} />
          <Info k="Source CPSE" v={mapping.cpse} />
          <Info k="Source code" v={mapping.sourceCode} />
          <Info k="Material description" v={mapping.rawDescription} />
          <Info k="Document URL" v={mapping.tenderUrl || "—"} />
          <Info k="Page / section" v="Section B · Item line" />
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="font-semibold">Relevant extracted text</p>
          <p className="mt-1 italic text-muted-foreground">
            “{mapping.rawDescription}” — referenced in the {mapping.tenderDocName} BOQ under the material code {mapping.sourceCode}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={verify}>
            {verifyState === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {verifyState === "checking" ? "Verifying..." : "Verify Source URL"}
          </Button>
          {verifyState === "ok" && <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" /> URL verified reachable</Badge>}
          {verifyState === "fail" && <Badge tone="danger"><ShieldX className="h-3.5 w-3.5" /> URL unreachable</Badge>}
          <a href={mapping.tenderUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs font-medium text-primary hover:underline">Open in new tab</a>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onReject}>Reject</Button>
          <Button variant="success" onClick={onApprove}>Approve mapping</Button>
        </div>
      </div>
    </Modal>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}
