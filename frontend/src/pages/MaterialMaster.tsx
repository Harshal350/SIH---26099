import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, FilterX, ChevronRight, MapPin, Boxes } from "lucide-react";
import { useProto, SourceMaterial } from "@/context/prototype-data";
import { isMatchable } from "@/lib/matching";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import MaterialDetail from "@/components/material-detail";
import { NmcMapDialog } from "@/components/nmc-map";

function statusTone(s: string) {
  if (s === "MAPPED") return "success" as const;
  if (s === "PENDING") return "warning" as const;
  if (s === "REVIEW") return "info" as const;
  return "neutral" as const;
}

export default function MaterialMaster() {
  const { materials } = useProto();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [cpse, setCpse] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [recordType, setRecordType] = useState("ALL");
  const [origin, setOrigin] = useState("ALL");
  const [mapping, setMapping] = useState("ALL");
  const [nmc, setNmc] = useState("ALL");
  const [dq, setDq] = useState("ALL");
  const [page, setPage] = useState(0);
  const pageSize = 8;

  const [detail, setDetail] = useState<SourceMaterial | null>(null);
  const [mapFor, setMapFor] = useState<SourceMaterial | null>(null);

  useEffect(() => setPage(0), [query, cpse, category, recordType, origin, mapping, nmc, dq]);

  const cpseOptions = useMemo(() => Array.from(new Set(materials.map((m) => m.sourceOrganization))).sort(), [materials]);
  const catOptions = useMemo(() => Array.from(new Set(materials.map((m) => m.category))).sort(), [materials]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials
      .filter((m) => {
        if (q) {
          const hay = `${m.originalMaterialCode} ${m.originalDescription} ${m.stewardDescription ?? ""} ${m.normalizedDescription} ${m.nmcCode || ""} ${m.category} ${m.sourceOrganization}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (cpse !== "ALL" && m.sourceOrganization !== cpse) return false;
        if (category !== "ALL" && m.category !== category) return false;
        if (recordType !== "ALL" && m.recordType !== recordType) return false;
        if (origin !== "ALL" && m.origin !== origin) return false;
        if (mapping !== "ALL" && m.mappingStatus !== mapping) return false;
        if (nmc === "MAPPED" && !m.nmcCode) return false;
        if (nmc === "UNMAPPED" && m.nmcCode) return false;
        if (dq !== "ALL") {
          if (dq === "COMPLETE" && m.dataQuality !== "COMPLETE") return false;
          if (dq === "INCOMPLETE" && m.dataQuality === "COMPLETE") return false;
        }
        return true;
      })
      .sort((a, b) => a.originalMaterialCode.localeCompare(b.originalMaterialCode));
  }, [materials, query, cpse, category, recordType, origin, mapping, nmc, dq]);

  const hasFilters = query || cpse !== "ALL" || category !== "ALL" || recordType !== "ALL" || origin !== "ALL" || mapping !== "ALL" || nmc !== "ALL" || dq !== "ALL";
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  function resetFilters() {
    setQuery("");
    setCpse("ALL"); setCategory("ALL"); setRecordType("ALL"); setOrigin("ALL");
    setMapping("ALL"); setNmc("ALL"); setDq("ALL");
  }

  return (
    <div>
      <PageHeader
        title="Material Master"
        description="CPSE materials consolidated and mapped to National Material Codes. Search, filter and open a material to inspect or re-map it."
      />

      <Card className="mb-4 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by material name, description, CPSE code, NMC code, raw source code or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Select value={recordType} onChange={(e) => setRecordType(e.target.value)}>
            <option value="ALL">All record types</option>
            <option value="MATERIAL">Material</option>
            <option value="SERVICE">Service</option>
            <option value="WORK">Work</option>
            <option value="CONSULTANCY">Consultancy</option>
          </Select>
          <Select value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="ALL">All provenance</option>
            <option value="LIVE">Live (fetched from portal)</option>
            <option value="REFERENCE">Reference (captured record)</option>
            <option value="DEMO">Demo (synthetic)</option>
          </Select>
          <Select value={dq} onChange={(e) => setDq(e.target.value)}>
            <option value="ALL">All extraction quality</option>
            <option value="COMPLETE">Complete</option>
            <option value="INCOMPLETE">Incomplete</option>
          </Select>
          <Button variant="outline" onClick={resetFilters} className={hasFilters ? "" : "opacity-50"}>
            <FilterX className="h-4 w-4" /> Reset filters
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Select value={cpse} onChange={(e) => setCpse(e.target.value)}>
            <option value="ALL">All source organisations</option>
            {cpseOptions.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="ALL">All categories</option>
            {catOptions.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={mapping} onChange={(e) => setMapping(e.target.value)}>
            <option value="ALL">All mapping status</option>
            <option value="MAPPED">Mapped</option>
            <option value="UNMAPPED">Unmapped</option>
          </Select>
          <Select value={nmc} onChange={(e) => setNmc(e.target.value)}>
            <option value="ALL">All NMC status</option>
            <option value="MAPPED">With NMC</option>
            <option value="UNMAPPED">No NMC</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-10 w-10 text-muted-foreground" />}
          title="No materials match your filters"
          description="Try adjusting the search text or clearing the filters."
          action={hasFilters ? <Button variant="outline" onClick={resetFilters}>Clear filters</Button> : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Material ID</TH>
                  <TH>Name / Description</TH>
                  <TH>Record type</TH>
                  <TH>CPSE</TH>
                  <TH>Source code</TH>
                  <TH>Category</TH>
                  <TH>Provenance</TH>
                  <TH>NMC / National Code</TH>
                  <TH>Mapping status</TH>
                  <TH>DQ</TH>
                </TR>
              </THead>
              <TBody>
                {pageItems.map((m) => (
                  <TR key={m.id} className="cursor-pointer" onClick={() => setDetail(m)}>
                    <TD className="font-mono text-xs text-muted-foreground">#{m.id}</TD>
                    <TD className="max-w-sm">
                      <div className="flex items-center gap-1">
                        <p className="font-medium">{m.originalDescription}</p>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">{m.normalizedDescription}</p>
                      {m.stewardDescription && m.stewardDescription !== m.originalDescription && (
                        <Badge tone="info" className="mt-1">steward-corrected</Badge>
                      )}
                    </TD>
                    <TD>
                      <Tooltip
                        content={
                          isMatchable(m.recordType)
                            ? "Classified as a material — eligible for matching"
                            : "Classified as a non-material record — excluded from material matching"
                        }
                      >
                        <Badge tone={isMatchable(m.recordType) ? "success" : "neutral"}>{m.recordType}</Badge>
                      </Tooltip>
                    </TD>
                    <TD><Badge>{m.sourceOrganization}</Badge></TD>
                    <TD className="font-mono text-sm">{m.originalMaterialCode}</TD>
                    <TD><Badge tone="info">{m.category}</Badge></TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={m.origin === "LIVE" ? "success" : m.origin === "DEMO" ? "warning" : "info"}>
                          {m.origin}
                        </Badge>
                        <Badge tone={m.itemLevel ? "neutral" : "warning"}>
                          {m.itemLevel ? "item" : "notice"}
                        </Badge>
                      </div>
                    </TD>
                    <TD>
                      {m.nmcCode ? (
                        <Tooltip content="National Code. Click the map button to change or remove mapping.">
                          <span className="font-mono text-sm font-medium text-primary">{m.nmcCode}</span>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD><Badge tone={statusTone(m.mappingStatus)}>{m.mappingStatus}</Badge></TD>
                    <TD>
                      <Tooltip
                        content={
                          m.dataQuality === "COMPLETE"
                            ? "All key attributes were extracted"
                            : "One or more key attributes could not be extracted"
                        }
                      >
                        <Badge tone={m.dataQuality === "COMPLETE" ? "success" : "warning"}>
                          {m.dataQuality === "COMPLETE" ? "COMPLETE" : "INCOMPLETE"}
                        </Badge>
                      </Tooltip>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} />
          </CardContent>
        </Card>
      )}

      <MaterialDetail material={detail} onClose={() => setDetail(null)} onMap={(m) => { setDetail(null); setMapFor(m); }} />
      {mapFor && <NmcMapDialog material={mapFor} onClose={() => setMapFor(null)} />}
    </div>
  );
}
