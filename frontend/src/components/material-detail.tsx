import { useProto, SourceMaterial } from "@/context/prototype-data";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Link2, ExternalLink } from "lucide-react";

export default function MaterialDetail({
  material,
  onClose,
  onMap,
}: {
  material: SourceMaterial | null;
  onClose: () => void;
  onMap: (m: SourceMaterial) => void;
}) {
  const { mappings, materials } = useProto();
  if (!material) return null;

  const linkedMapping = mappings.find((m) => m.sourceCode === material.originalMaterialCode && m.cpse === material.sourceOrganization);
  const aiMatches = materials
    .filter((m) => m.id !== material.id && m.category === material.category)
    .slice(0, 2);

  return (
    <Modal open onClose={onClose} title={`Material detail`} size="lg">
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Material description</p>
          <p className="text-base font-semibold">{material.originalDescription}</p>
          <p className="text-sm text-muted-foreground">{material.normalizedDescription}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3 rounded-md border p-3">
            <p className="font-semibold uppercase text-xs tracking-wide text-muted-foreground">Raw CPSE data</p>
            <Row k="CPSE" v={<Badge>{material.sourceOrganization}</Badge>} />
            <Row k="Source code" v={<span className="font-mono">{material.originalMaterialCode}</span>} />
            <Row k="Unit" v={material.originalUom || "—"} />
            <Row k="Quantity" v={material.originalQuantity || "—"} />
            <Row k="Source doc" v={material.sourceDocument || "—"} />
            <Row k="Review status" v={<Badge tone={material.dataQuality === "CLEAN" ? "success" : "warning"}>{material.dataQuality}</Badge>} />
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <p className="font-semibold uppercase text-xs tracking-wide text-muted-foreground">Normalized & NMC</p>
            <Row k="Category" v={<Badge tone="info">{material.category}</Badge>} />
            <Row k="NMC / National code" v={material.nmcCode ? <span className="font-mono text-success">{material.nmcCode}</span> : <span className="text-muted-foreground">Not mapped</span>} />
            <Row k="Mapping status" v={<Badge tone={material.mappingStatus === "MAPPED" ? "success" : "warning"}>{material.mappingStatus}</Badge>} />
            <Row k="AI confidence" v={material.aiConfidence != null ? `${Math.round(material.aiConfidence > 1 ? material.aiConfidence : material.aiConfidence * 100)}%` : "—"} />

            <Row k="Mapped by" v={linkedMapping?.createdBy || "—"} />
            <Row k="Mapped at" v={linkedMapping ? new Date(linkedMapping.lastUpdated).toLocaleString() : "—"} />
          </div>
        </div>

        {aiMatches.length > 0 && (
          <div className="rounded-md border p-3">
            <p className="font-semibold">AI matching result</p>
            <p className="text-xs text-muted-foreground">Similar records in the same category detected by the matcher.</p>
            <div className="mt-2 space-y-1.5">
              {aiMatches.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{m.originalDescription} <span className="text-muted-foreground">({m.sourceOrganization})</span></span>
                  <Badge tone={m.mappingStatus === "MAPPED" ? "success" : "neutral"}>{m.mappingStatus}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border p-3">
          <p className="font-semibold">Mapping history</p>
          <div className="mt-2 space-y-1">
            <Row k="Created" v={linkedMapping?.createdBy ? `${linkedMapping.createdBy} · ${new Date(linkedMapping.lastUpdated).toLocaleString()}` : "Not mapped yet"} />
            {linkedMapping && <Row k="Mapping source" v={linkedMapping.mappingSource} />}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link2 className="h-4 w-4" />
            <span className="text-xs">Source: {material.sourceDocument || "—"}</span>
          </div>
          {material.sourceUrl && (
            <a href={material.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> View source
            </a>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => onMap(material)}>
            <MapPin className="h-4 w-4" />
            {material.nmcCode ? "Change / remove mapping" : "Map national code"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
