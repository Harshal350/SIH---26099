import { useMemo, useState } from "react";
import { BadgeCheck, TrendingUp, AlertTriangle, Target, Layers, GitMerge } from "lucide-react";
import { useProto } from "@/context/prototype-data";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { HBarChart, DonutChart } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";

export default function Procurement() {
  const { materials, mappings, procurement } = useProto();
  const [cpse, setCpse] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [mapStatus, setMapStatus] = useState("ALL");

  const cpseOptions = useMemo(() => Array.from(new Set(materials.map((m) => m.sourceOrganization))).sort(), [materials]);
  const catOptions = useMemo(() => Array.from(new Set(materials.map((m) => m.category))).sort(), [materials]);

  const base = useMemo(() => {
    return materials.filter((m) => {
      if (cpse !== "ALL" && m.sourceOrganization !== cpse) return false;
      if (category !== "ALL" && m.category !== category) return false;
      if (mapStatus === "MAPPED" && m.mappingStatus !== "MAPPED") return false;
      if (mapStatus === "UNMAPPED" && m.mappingStatus === "MAPPED") return false;
      return true;
    });
  }, [materials, cpse, category, mapStatus]);

  const catDist = useMemo(() => {
    const m = new Map<string, number>();
    base.forEach((x) => m.set(x.category, (m.get(x.category) || 0) + 1));
    return Array.from(m.entries()).map(([category, records]) => ({ category, records })).sort((a, b) => b.records - a.records);
  }, [base]);

  const cpseVol = useMemo(() => {
    const m = new Map<string, number>();
    base.forEach((x) => m.set(x.sourceOrganization, (m.get(x.sourceOrganization) || 0) + 1));
    return Array.from(m.entries()).map(([cpse, records]) => ({ cpse, records })).sort((a, b) => b.records - a.records);
  }, [base]);

  const mapped = base.filter((m) => m.nmcCode).length;
  const mappedCount = base.filter((m) => m.mappingStatus === "MAPPED").length;
  const coverage = base.length ? Math.round((mappedCount / base.length) * 100) : 0;
  const unmapped = base.length ? Math.round(((base.length - mappedCount) / base.length) * 100) : 0;
  const mapCoverage = mappings.length ? Math.round((mappings.filter((m) => m.mappingStatus === "MAPPED").length / mappings.length) * 100) : 0;

  const highValue = useMemo(() => catDist.filter((c) => c.records >= Math.max(1, catDist[0]?.records * 0.3)).map((c) => c.category), [catDist]);
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    base.forEach((m) => {
      const key = `${m.normalizedDescription}|${m.category}`.toUpperCase();
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    return Array.from(seen.values()).reduce((s, n) => s + (n > 1 ? n - 1 : 0), 0);
  }, [base]);

  const donut = [
    { label: "Mapped", value: mappedCount, color: "hsl(var(--success))" },
    { label: "Pending", value: base.filter((m) => m.mappingStatus === "PENDING").length, color: "hsl(var(--warning))" },
    { label: "Unmapped", value: base.length - mappedCount - base.filter((m) => m.mappingStatus === "PENDING").length, color: "hsl(var(--destructive))" },
  ];

  return (
    <div>
      <PageHeader title="Procurement Intelligence" description="Aggregated demand visibility and standardization insights across CPSE materials." />

      {base.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="h-10 w-10 text-muted-foreground" />} title="No procurement data" description="Import material data to see aggregated insights here." />
      ) : (
        <>
          <Card className="mb-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select value={cpse} onChange={(e) => setCpse(e.target.value)}><option value="ALL">All CPSE</option>{cpseOptions.map((c) => <option key={c}>{c}</option>)}</Select>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="ALL">All categories</option>{catOptions.map((c) => <option key={c}>{c}</option>)}</Select>
              <Select value={mapStatus} onChange={(e) => setMapStatus(e.target.value)}><option value="ALL">All mapping status</option><option value="MAPPED">Mapped</option><option value="UNMAPPED">Unmapped</option></Select>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Charts update live as you filter, reflecting the current material base.</p>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Layers className="h-4 w-4 text-primary" /> Material base</div><p className="mt-1 text-2xl font-semibold">{base.length.toLocaleString()}</p></Card>
            <Card className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4 text-success" /> NMC coverage</div><p className="mt-1 text-2xl font-semibold text-success">{coverage}%</p></Card>
            <Card className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4 text-warning" /> Unmapped</div><p className="mt-1 text-2xl font-semibold text-warning">{unmapped}%</p></Card>
            <Card className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><GitMerge className="h-4 w-4 text-destructive" /> Near-duplicates</div><p className="mt-1 text-2xl font-semibold">{duplicates.toLocaleString()}</p></Card>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Procurement category distribution</CardTitle><CardDescription>Material volume by category in the current filter.</CardDescription></CardHeader>
              <CardContent><HBarChart data={catDist} valueKey="records" labelKey="category" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Material volume by CPSE</CardTitle><CardDescription>How much material each CPSE contributes to the base.</CardDescription></CardHeader>
              <CardContent><HBarChart data={cpseVol} valueKey="records" labelKey="cpse" /></CardContent>
            </Card>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>National-code coverage</CardTitle><CardDescription>Share of materials mapped to a National Code and mapping coverage across records.</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap items-center gap-6"><DonutChart segments={donut} /><div className="space-y-1 text-sm"><p><span className="text-muted-foreground">Mapping coverage:</span> <span className="font-medium">{mapCoverage}%</span></p><p><span className="text-muted-foreground">Total mappings:</span> <span className="font-medium">{mappings.length}</span></p></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>High-value procurement categories</CardTitle><CardDescription>Categories representing the largest share — the best standardization targets.</CardDescription></CardHeader>
              <CardContent>
                {highValue.length === 0 ? <p className="text-sm text-muted-foreground">No categories in the current filter.</p> : (
                  <div className="flex flex-wrap gap-2">{highValue.map((c) => <Badge key={c} tone="info">{c}</Badge>)}</div>
                )}
                <div className="mt-5 rounded-md border p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-success" /> Records retrieved per month</p>
                  <div className="mt-2"><HBarChart data={procurement.trend} valueKey="records" labelKey="label" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
