import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useProto, SourceMaterial } from "@/context/prototype-data";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Search } from "lucide-react";

export function NmcMapDialog({ material, onClose }: { material: SourceMaterial; onClose: () => void }) {
  const { nmcCodes, mappings, mapMaterialToNmc, changeMapping, removeMapping } = useProto();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(material.nmcCode || "");

  const hasCurrentMapping =
    mappings.find((m) => m.sourceCode === material.originalMaterialCode && m.cpse === material.sourceOrganization) ||
    material.nmcCode;

  const q = search.toLowerCase();
  const options = nmcCodes.filter((n) => !q || `${n.nationalCode} ${n.description}`.toLowerCase().includes(q));

  return (
    <Modal open onClose={onClose} title={`Map / Change National Code`} size="lg">
      <div className="space-y-4">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">CPSE material</p>
          <p className="font-medium">{material.originalDescription}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {material.sourceOrganization} · {material.originalMaterialCode}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search national / NMC codes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border p-2">
          {options.length === 0 && <p className="p-3 text-sm text-muted-foreground">No national codes match.</p>}
          {options.map((n) => (
            <button
              key={n.nationalCode}
              onClick={() => setSelected(n.nationalCode)}
              className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted ${selected === n.nationalCode ? "border-primary bg-primary/10" : ""}`}
            >
              <div>
                <p className="font-mono font-medium">{n.nationalCode}</p>
                <p className="text-xs text-muted-foreground">{n.description}</p>
              </div>
              <Badge tone="info">{n.category}</Badge>
            </button>
          ))}
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Selected code</p>
          {selected ? (
            <>
              <p className="mt-1 font-mono">{selected}</p>
              <p className="text-muted-foreground">{nmcCodes.find((n) => n.nationalCode === selected)?.description || "—"}</p>
            </>
          ) : (
            <p className="text-muted-foreground">No national code selected.</p>
          )}
        </div>

        {hasCurrentMapping && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
            <Badge tone="warning">Existing mapping</Badge>
            <span className="text-muted-foreground">
              This source material is currently mapped to{` `}
              <span className="font-mono font-medium">{material.nmcCode || "a mapping"}</span>. Changing will update it.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {hasCurrentMapping && (
              <Button
                variant="danger"
                onClick={() => {
                  removeMapping(mappings.find((m) => m.sourceCode === material.originalMaterialCode)?.id ?? -1);
                  toast("info", "Mapping removed", "The national-code mapping for this material was removed.");
                  onClose();
                }}
              >
                Remove mapping
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!selected}
              onClick={() => {
                if (material.nmcCode) {
                  const existing = mappings.find((m) => m.sourceCode === material.originalMaterialCode);
                  if (existing) changeMapping(existing.id, selected, "steward");
                  else mapMaterialToNmc(material.id, selected);
                  toast("success", "Mapping updated", `${material.originalMaterialCode} is now mapped to ${selected}.`);
                } else {
                  mapMaterialToNmc(material.id, selected);
                  toast("success", "Material mapped", `${material.originalMaterialCode} mapped to ${selected}.`);
                }
                onClose();
              }}
            >
              Save mapping
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
