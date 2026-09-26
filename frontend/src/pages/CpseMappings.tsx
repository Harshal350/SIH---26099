import { useMemo, useState } from "react";
import { Link2, FileSearch, FilterX, Layers, ArrowRight, ExternalLink } from "lucide-react";
import { useProto, Mapping, SourceMaterial } from "@/context/prototype-data";
import { isMatchable } from "@/lib/matching";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

const ORIGIN_TONE = { LIVE: "success", REFERENCE: "info", DEMO: "warning" } as const;

export default function CpseMappings() {
  const { mappings, revokeMapping, materials, nmcCodes } = useProto();
  const { toast } = useToast();

  const [cpse, setCpse] = useState("ALL");
  const [cat, setCat] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [page, setPage] = useState(0);
  const [docFor, setDocFor] = useState<Mapping | null>(null);
  const pageSize = 8;

  const cpseOptions = useMemo(() => Array.from(new Set(mappings.map((m) => m.cpse))).sort(), [mappings]);
  const catOptions = useMemo(
    () => Array.from(new Set(mappings.map((m) => m.nationalCode.split("-")[1] ?? ""))).filter(Boolean).sort(),
    [mappings],
  );

  const filtered = useMemo(() => {
    return mappings.filter((m) => {
      if (cpse !== "ALL" && m.cpse !== cpse) return false;
      if (cat !== "ALL" && m.nationalCode.split("-")[1] !== cat) return false;
      if (source !== "ALL" && m.mappingSource !== source) return false;
      return true;
    });
  }, [mappings, cpse, cat, source]);

  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  /**
   * "Before → after" grouping: every set of source records that a human folded
   * into one national code. This is the real end-to-end lineage of the platform.
   */
  const lineageGroups = useMemo(() => {
    const byKey = new Map<string, Mapping[]>();
    for (const m of mappings) {
      const key = m.decisionKey ?? m.nationalCode;
      byKey.set(key, [...(byKey.get(key) ?? []), m]);
    }
    return Array.from(byKey.entries())
      .map(([key, rows]) => ({ key, code: rows[0].nationalCode, desc: rows[0].nationalDesc, rows }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [mappings]);

  const materialByCode = useMemo(() => {
    const map = new Map<string, SourceMaterial>();
    for (const m of materials) map.set(`${m.sourceOrganization}|${m.originalMaterialCode}`, m);
    return map;
  }, [materials]);

  return (
    <div>
      <PageHeader
        title="CPSE Mappings"
        description="Source records that a human reviewer assigned to a National Material Code. A mapping exists only after an explicit approval — the matcher never creates one on its own."
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select value={cpse} onChange={(e) => { setCpse(e.target.value); setPage(0); }}>
            <option value="ALL">All source organisations</option>
            {cpseOptions.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
            <option value="ALL">All NMC categories</option>
            {catOptions.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={source} onChange={(e) => { setSource(e.target.value); setPage(0); }}>
            <option value="ALL">All assignment sources</option>
            <option value="AI + Human Reviewer">Approved from review queue</option>
            <option value="Steward mapping">Steward mapping</option>
          </Select>
          <Button variant="outline" onClick={() => { setCpse("ALL"); setCat("ALL"); setSource("ALL"); }}>
            <FilterX className="h-4 w-4" /> Reset
          </Button>
        </div>
      </Card>

      {lineageGroups.length > 0 && (
        <Card className="mb-5">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Before → after</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              How separate source descriptions from different organisations were standardised into one national identity.
            </p>
            <div className="mt-4 space-y-3">
              {lineageGroups.slice(0, 4).map((g) => (
                <div key={g.key} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold text-primary">{g.code}</p>
                      <p className="text-xs text-muted-foreground">{g.desc}</p>
                    </div>
                    <Badge tone="info">{g.rows.length} source record{g.rows.length === 1 ? "" : "s"}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {g.rows.map((r) => {
                      const src = materialByCode.get(`${r.cpse}|${r.sourceCode}`);
                      return (
                        <div key={r.id} className="rounded-md border bg-muted/20 p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Badge tone={src?.origin ? ORIGIN_TONE[src.origin] : "neutral"}>{src?.origin ?? "UNKNOWN"}</Badge>
                            <span className="truncate text-xs text-muted-foreground">{r.cpse}</span>
                          </div>
                          <p className="mt-1 font-mono text-xs">{r.sourceCode}</p>
                          <p className="text-xs text-muted-foreground">{r.rawDescription}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>
                      Approved by {g.rows[0].approvedBy ?? g.rows[0].createdBy} on{" "}
                      {new Date(g.rows[0].approvedAt ?? g.rows[0].lastUpdated).toLocaleDateString()}
                      {g.rows[0].confidence !== undefined && ` · match confidence ${(g.rows[0].confidence * 100).toFixed(1)}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-10 w-10 text-muted-foreground" />}
          title="No approved mappings yet"
          description="Mappings appear here once a reviewer approves a match in the review queue, or a steward assigns a record directly."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Source organisation</TH>
                  <TH>Source record</TH>
                  <TH>National code</TH>
                  <TH>Provenance</TH>
                  <TH>Confidence</TH>
                  <TH>Assignment</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((m) => {
                  const src = materialByCode.get(`${m.cpse}|${m.sourceCode}`);
                  return (
                    <TR key={m.id}>
                      <TD><Badge>{m.cpse}</Badge></TD>
                      <TD className="max-w-[260px]">
                        <p className="font-mono text-sm">{m.sourceCode}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.rawDescription}</p>
                      </TD>
                      <TD>
                        <p className="font-mono text-sm font-medium text-primary">{m.nationalCode}</p>
                        <p className="text-xs text-muted-foreground">{m.nationalDesc}</p>
                      </TD>
                      <TD>
                        {src ? (
                          <div className="space-y-1">
                            <Badge tone={ORIGIN_TONE[src.origin]}>{src.origin}</Badge>
                            {src.itemLevel ? (
                              <Badge tone="neutral">item level</Badge>
                            ) : (
                              <Badge tone="warning">notice level</Badge>
                            )}
                          </div>
                        ) : (
                          <Badge tone="neutral">—</Badge>
                        )}
                      </TD>
                      <TD>
                        {m.confidence === undefined ? (
                          <span className="text-xs text-muted-foreground">no match evidence</span>
                        ) : (
                          <span className={confTone(m.confidence)}>{(m.confidence * 100).toFixed(1)}%</span>
                        )}
                      </TD>
                      <TD className="text-xs">
                        <p>{m.mappingSource}</p>
                        <p className="text-muted-foreground">
                          {m.approvedBy ?? m.createdBy} · {new Date(m.approvedAt ?? m.lastUpdated).toLocaleDateString()}
                        </p>
                      </TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-1">
                          <Tooltip content="View source record">
                            <Button variant="ghost" size="icon" onClick={() => setDocFor(m)}>
                              <FileSearch className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              revokeMapping(m.id, "steward");
                              toast("info", "Assignment revoked", `${m.sourceCode} is unmapped again and the pair returned to review.`);
                            }}
                          >
                            Revoke
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
          </CardContent>
        </Card>
      )}

      {docFor && <SourceRecordPanel mapping={docFor} onClose={() => setDocFor(null)} />}
    </div>
  );
}

function confTone(c: number) {
  return `font-medium ${c >= 0.8 ? "text-success" : c >= 0.6 ? "text-warning" : "text-destructive"}`;
}

/**
 * Shows only fields that actually exist on the record. Nothing here is
 * reconstructed: if the source did not publish an item line, it says so.
 */
function SourceRecordPanel({ mapping, onClose }: { mapping: Mapping; onClose: () => void }) {
  const { materials, nmcCodes } = useProto();
  const src = materials.find((m) => m.sourceOrganization === mapping.cpse && m.originalMaterialCode === mapping.sourceCode);
  const nmc = nmcCodes.find((n) => n.nationalCode === mapping.nationalCode);

  return (
    <Modal open onClose={onClose} title="Source record & provenance" size="lg">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Info k="Source organisation" v={mapping.cpse} />
          <Info k="Source record id" v={<span className="font-mono">{mapping.sourceCode}</span>} />
          <Info k="Item description as published" v={mapping.rawDescription} />
          <Info k="Tender / notice" v={src?.sourceTenderTitle || mapping.tenderDocName || "—"} />
          <Info k="Provenance" v={src ? <Badge tone={ORIGIN_TONE[src.origin]}>{src.origin}</Badge> : "unknown"} />
          <Info
            k="Granularity"
            v={
              src?.itemLevel ? (
                <Badge tone="success">item level (BOQ line)</Badge>
              ) : (
                <Badge tone="warning">notice level — not an item line</Badge>
              )
            }
          />
          {src?.retrievedAt && <Info k="Retrieved at" v={new Date(src.retrievedAt).toLocaleString()} />}
          {src?.recordType && (
            <Info
              k="Record type"
              v={
                <Badge tone={isMatchable(src.recordType) ? "success" : "neutral"}>
                  {src.recordType}{isMatchable(src.recordType) ? "" : " — excluded from matching"}
                </Badge>
              }
            />
          )}
        </div>

        {src?.dna && (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="font-semibold">Extracted Material DNA</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(src.dna)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <Badge key={k} tone="neutral">{String(k)}: {String(v)}</Badge>
                ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Attributes shown here were recovered by the extraction rules. Anything not recovered is simply absent — it is
              never guessed.
            </p>
          </div>
        )}

        <div className="rounded-md border p-3">
          <p className="font-semibold">Assignment</p>
          <p className="mt-1">
            <span className="font-mono text-primary">{mapping.nationalCode}</span>
            {nmc ? ` — ${nmc.description}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {mapping.mappingSource} · approved by {mapping.approvedBy ?? mapping.createdBy} on{" "}
            {new Date(mapping.approvedAt ?? mapping.lastUpdated).toLocaleString()}
            {mapping.confidence !== undefined && ` · match confidence ${(mapping.confidence * 100).toFixed(1)}%`}
          </p>
        </div>

        {mapping.evidence && (
          <div className="rounded-md border p-3">
            <p className="font-semibold">Why the matcher proposed this</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {mapping.evidence.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {mapping.tenderUrl && (
            <a href={mapping.tenderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Open the real source page <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
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
