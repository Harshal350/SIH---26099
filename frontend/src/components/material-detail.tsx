import { useProto, SourceMaterial } from "@/context/prototype-data";
import { isMatchable, ATTRIBUTE_LABEL, RECOMMENDATION_LABEL } from "@/lib/matching";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink, ShieldAlert, Dna } from "lucide-react";

export default function MaterialDetail({
  material,
  onClose,
  onMap,
}: {
  material: SourceMaterial | null;
  onClose: () => void;
  onMap: (m: SourceMaterial) => void;
}) {
  const { mappings, reviewItems } = useProto();
  if (!material) return null;

  const linkedMapping = mappings.find(
    (m) => m.sourceCode === material.originalMaterialCode && m.cpse === material.sourceOrganization,
  );

  // Real candidates: the actual review items this record participates in.
  const candidates = reviewItems
    .filter((r) => r.materialIdA === material.id || r.materialIdB === material.id)
    .sort((a, b) => b.confidence - a.confidence);

  const matchable = isMatchable(material.recordType);
  const dnaEntries = Object.entries(material.dna ?? {}).filter(([, v]) => v);

  return (
    <Modal open onClose={onClose} title="Source record" size="lg">
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Description exactly as published</p>
          <p className="text-base font-semibold">{material.originalDescription}</p>
          {material.stewardDescription && material.stewardDescription !== material.originalDescription && (
            <div className="mt-1.5 rounded-md border border-info/40 bg-info/5 p-2">
              <p className="text-xs font-medium text-info">Corrected by a data-quality steward</p>
              <p className="text-sm">{material.stewardDescription}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Extraction and matching use this wording. The published text above is retained unchanged.
              </p>
            </div>
          )}
          {material.normalizedDescription && material.normalizedDescription !== material.originalDescription && (
            <p className="mt-0.5 text-sm text-muted-foreground">Normalised: {material.normalizedDescription}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone={matchable ? "success" : "neutral"}>
            {material.recordType}{matchable ? "" : " — excluded from matching"}
          </Badge>
          <Badge tone={material.origin === "LIVE" ? "success" : material.origin === "DEMO" ? "warning" : "info"}>
            {material.origin}
          </Badge>
          <Badge tone={material.itemLevel ? "neutral" : "warning"}>
            {material.itemLevel ? "item level (BOQ line)" : "notice level — not an item line"}
          </Badge>
          <Badge tone={material.dataQuality === "COMPLETE" ? "success" : "warning"}>
            extraction {material.dataQuality === "COMPLETE" ? "complete" : "incomplete"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 rounded-md border p-3">
            <p className="font-semibold uppercase text-xs tracking-wide text-muted-foreground">Source record</p>
            <Row k="Organisation" v={<Badge>{material.sourceOrganization}</Badge>} />
            <Row k="Source id" v={<span className="font-mono">{material.originalMaterialCode}</span>} />
            <Row k="Tender / notice" v={material.sourceTenderTitle || "—"} />
            <Row k="Unit" v={material.originalUom || "—"} />
            <Row k="Quantity" v={material.originalQuantity || "—"} />
            <Row k="Retrieved" v={material.retrievedAt ? new Date(material.retrievedAt).toLocaleDateString() : "—"} />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <p className="font-semibold uppercase text-xs tracking-wide text-muted-foreground">Standardised identity</p>
            <Row k="Category" v={<Badge tone="info">{material.category}</Badge>} />
            <Row
              k="NMC"
              v={material.nmcCode ? <span className="font-mono text-success">{material.nmcCode}</span> : <span className="text-muted-foreground">not assigned</span>}
            />
            <Row k="Mapping status" v={<Badge tone={material.mappingStatus === "MAPPED" ? "success" : "warning"}>{material.mappingStatus}</Badge>} />
            <Row k="Assigned by" v={linkedMapping ? `${linkedMapping.approvedBy ?? linkedMapping.createdBy}` : "—"} />
            <Row k="Assigned at" v={linkedMapping ? new Date(linkedMapping.approvedAt ?? linkedMapping.lastUpdated).toLocaleString() : "—"} />
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Dna className="h-4 w-4 text-primary" />
            <p className="font-semibold">Material DNA</p>
          </div>
          {dnaEntries.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dnaEntries.map(([k, v]) => (
                <Badge key={k} tone="neutral">{String(k)}: {String(v)}</Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No attributes could be extracted from this description.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Only attributes actually present in the source text are listed. Missing attributes are never inferred, and a
            missing attribute is what lowers the match confidence.
          </p>
        </div>

        <div className="rounded-md border p-3">
          <p className="font-semibold">End-to-end journey</p>
          <ol className="mt-2 space-y-1.5 text-xs">
            <li className="flex gap-2">
              <span className="font-mono text-muted-foreground">1</span>
              <span>
                Ingested from <span className="font-medium">{material.sourceOrganization}</span> as{" "}
                <span className="font-mono">{material.sourceRecordId}</span> ({material.origin}).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-muted-foreground">2</span>
              <span>
                Classified as <span className="font-medium">{material.recordType}</span>
                {matchable ? " and became eligible for matching." : ", so it was excluded from material matching."}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-muted-foreground">3</span>
              <span>
                {candidates.length > 0
                  ? `Scored in ${candidates.length} candidate pair(s).`
                  : matchable
                    ? "No other record scored above the candidate floor, so no pair was created."
                    : "Not scored, because non-material records are not matched."}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-muted-foreground">4</span>
              <span>
                {material.nmcCode
                  ? `A human reviewer assigned ${material.nmcCode}.`
                  : matchable
                    ? "Still waiting for a reviewer to approve an assignment."
                    : "No national code applies to this record type."}
              </span>
            </li>
          </ol>
        </div>

        {candidates.length > 0 && (
          <div className="rounded-md border p-3">
            <p className="font-semibold">Match candidates involving this record</p>
            <div className="mt-2 space-y-2">
              {candidates.map((c) => {
                const otherId = c.materialIdA === material.id ? c.materialIdB : c.materialIdA;
                const otherDesc = c.materialIdA === material.id ? c.descB : c.descA;
                const otherCpse = c.materialIdA === material.id ? c.cpseB : c.cpseA;
                return (
                  <div key={c.id} className="rounded-md border bg-muted/20 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="truncate text-xs">
                        vs <span className="font-medium">{otherDesc}</span>{" "}
                        <span className="text-muted-foreground">({otherCpse})</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        {c.autoMergeBlocked && (
                          <Badge tone="danger"><ShieldAlert className="h-3 w-3" /> blocked</Badge>
                        )}
                        <span className="font-medium">{(c.confidence * 100).toFixed(1)}%</span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.classification} · {c.recommendation ? RECOMMENDATION_LABEL[c.recommendation] : ""} · {c.status.toLowerCase()}
                    </p>
                    {c.evidence && c.evidence.attributes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.evidence.attributes.map((a) => (
                          <Badge
                            key={a.attribute}
                            tone={a.status === "SAME" ? "success" : a.status === "DIFF" ? "danger" : "neutral"}
                          >
                            {ATTRIBUTE_LABEL[a.attribute]}: {a.status === "DIFF" ? `${a.sourceA} vs ${a.sourceB}` : a.status === "MISSING" ? "missing" : "same"}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {c.evidence && c.evidence.blockers.length > 0 && (
                      <p className="mt-1 text-xs text-destructive">Blocked by: {c.evidence.blockers.join("; ")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {material.sourceUrl && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
            <span className="text-xs text-muted-foreground">Source document: {material.sourceDocument || "—"}</span>
            <a href={material.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Open the real source page
            </a>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {matchable && (
            <Button onClick={() => onMap(material)}>
              <MapPin className="h-4 w-4" />
              {material.nmcCode ? "Change assignment" : "Assign national code"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
