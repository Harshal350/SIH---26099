import { useState } from "react";
import {
  Building2, RefreshCw, Link2, Unplug, Eye, ExternalLink, Plus, HardDrive, CheckCircle2, AlertTriangle, Sparkles
} from "lucide-react";
import { useProto, Repo } from "@/context/prototype-data";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";

function statusTone(s: string) {
  if (s === "CONNECTED") return "success" as const;
  if (s === "SYNCING") return "info" as const;
  if (s === "ERROR") return "danger" as const;
  return "neutral" as const;
}

export default function CpseRepositories() {
  const { repos, materials, syncRepository, syncAllRepositories, disconnectRepository, connectRepository } = useProto();
  const { toast } = useToast();
  const [inspecting, setInspecting] = useState<Repo | null>(null);
  const [disconnecting, setDisconnecting] = useState<Repo | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState<number | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", type: "e-Procurement/CPPP", category: "GENERAL" });

  async function doSync(id: number) {
    const repo = repos.find((r) => r.id === id);
    setSyncInProgress(id);
    try {
      await syncRepository(id);
      toast("success", "Live Repository Synced", `Successfully pulled genuine records from ${repo?.name || "portal"}.`);
    } catch (err: any) {
      toast("danger", "Live Sync Error", err.message || "Failed to pull live records from portal.");
    } finally {
      setSyncInProgress(null);
    }
  }

  async function doSyncAll() {
    setSyncingAll(true);
    try {
      if (syncAllRepositories) {
        await syncAllRepositories();
        toast("success", "All Live Portals Synced", "Live records updated across all connected government and CPSE sources.");
      }
    } catch (err: any) {
      toast("danger", "Sync Incomplete", err.message || "One or more portals had a sync error.");
    } finally {
      setSyncingAll(false);
    }
  }

  const inspectedMaterials = inspecting
    ? materials.filter((m) => {
        const org = m.sourceOrganization.toLowerCase();
        const rName = inspecting.name.toLowerCase();
        const rKey = inspecting.sourceKey?.toLowerCase() || "";
        const rUrl = inspecting.url.toLowerCase();

        return (
          org.includes(rName.split(" ")[0]) ||
          (rKey && (org.includes(rKey) || m.sourceType.toLowerCase().includes(rKey))) ||
          (m.sourceUrl && rUrl && (m.sourceUrl.includes("gem.gov.in") && rUrl.includes("gem.gov.in") || m.sourceUrl.includes("coalindia.in") && rUrl.includes("coalindia.in") || m.sourceUrl.includes("bhel.com") && rUrl.includes("bhel.com")))
        );
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Official CPSE & Government Repositories"
        description="Live data ingestion from approved Government e-Marketplace (GeM), Coal India, BHEL, and CPPP portals compliant with project data policy."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={doSyncAll} disabled={syncingAll || syncInProgress !== null}>
              <RefreshCw className={`h-4 w-4 ${syncingAll ? "animate-spin" : ""}`} />
              {syncingAll ? "Fetching Live Data..." : "Fetch Live from All Portals"}
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Connect Repository
            </Button>
          </div>
        }
      />

      {repos.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10 text-muted-foreground" />}
          title="No repositories connected"
          description="Connect an official CPSE repository to begin ingesting real material records."
          action={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Connect Repository</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Repository</TH>
                  <TH>Source Portal</TH>
                  <TH>Live Records</TH>
                  <TH>Last Fetched</TH>
                  <TH>Fetch Status</TH>
                  <TH>DNA Engine</TH>
                  <TH>Health</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {repos.map((r) => {
                  const isSyncing = syncInProgress === r.id;
                  return (
                    <TR key={r.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{r.name}</p>
                          {r.sourceKey && (
                            <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                              LIVE
                            </Badge>
                          )}
                        </div>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                        >
                          {r.url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TD>
                      <TD><Badge tone="neutral">{r.type}</Badge></TD>
                      <TD className="font-mono font-medium">
                        {r.records > 0 ? (
                          <span className="text-foreground">{r.records.toLocaleString()} items</span>
                        ) : (
                          <span className="text-muted-foreground italic">Pending live sync</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-muted-foreground">
                        {r.records > 0 ? new Date(r.lastSync).toLocaleString() : "Never"}
                      </TD>
                      <TD>
                        <Badge tone={statusTone(r.status)}>
                          {isSyncing ? "FETCHING LIVE..." : r.syncStatus}
                        </Badge>
                      </TD>
                      <TD className="text-xs">
                        {r.records > 0 ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <Sparkles className="h-3 w-3" /> DNA Extracted
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Standby</span>
                        )}
                      </TD>
                      <TD>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${r.health === "Healthy" ? "text-success" : "text-warning"}`}>
                          <span className={`h-2 w-2 rounded-full ${r.health === "Healthy" ? "bg-success" : "bg-warning"}`} />
                          {r.health}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-1">
                          <Tooltip content="Inspect live records and source details">
                            <Button variant="ghost" className="p-2" onClick={() => setInspecting(r)} disabled={r.status === "DISCONNECTED"}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip content="Fetch live material records directly from portal">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={() => doSync(r.id)}
                              disabled={r.status === "DISCONNECTED" || isSyncing}
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`} />
                              {isSyncing ? "Fetching..." : "Fetch Live"}
                            </Button>
                          </Tooltip>
                          <Tooltip content="Disconnect repository">
                            <Button variant="ghost" className="p-2 text-destructive" onClick={() => setDisconnecting(r)} disabled={r.status === "DISCONNECTED"}>
                              <Unplug className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><HardDrive className="h-4 w-4 text-primary" /> Live Material Items</div>
          <p className="mt-1 text-2xl font-semibold">{repos.filter((r) => r.status !== "DISCONNECTED").reduce((s, r) => s + r.records, 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Fetched directly from official tender notices</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Active Portals</div>
          <p className="mt-1 text-2xl font-semibold">{repos.filter((r) => r.health === "Healthy").length} of {repos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">GeM, CIL, BHEL, CPPP, IOCL</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertTriangle className="h-4 w-4" /> Requires Attention</div>
          <p className="mt-1 text-2xl font-semibold">{repos.filter((r) => r.health !== "Healthy" && r.status !== "DISCONNECTED").length}</p>
          <p className="text-xs text-muted-foreground mt-1">Portal rate limits or captcha verification</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Link2 className="h-4 w-4" /> Provenance Preserved</div>
          <p className="mt-1 text-2xl font-semibold">100%</p>
          <p className="text-xs text-muted-foreground mt-1">Source URL, Doc & Ref Number saved</p>
        </Card>
      </div>

      {/* Inspect Repository Modal with Live Records Table */}
      <Modal open={!!inspecting} onClose={() => setInspecting(null)} title={`${inspecting?.name} — Repository Details & Live Records`} size="lg">
        {inspecting && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Row k="Repository Name" v={inspecting.name} />
              <Row
                k="Official Live Portal"
                v={
                  <a
                    href={inspecting.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                  >
                    {inspecting.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                }
              />
              <Row k="Source Architecture" v={<Badge tone="neutral">{inspecting.type}</Badge>} />
              <Row k="Connection Status" v={<Badge tone={statusTone(inspecting.status)}>{inspecting.status}</Badge>} />
              <Row k="Live Records Ingested" v={<span className="font-mono font-bold">{inspecting.records} items</span>} />
              <Row k="Last Live Sync" v={new Date(inspecting.lastSync).toLocaleString()} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Live Fetched Materials & DNA ({inspectedMaterials.length})
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => doSync(inspecting.id)}
                  disabled={syncInProgress === inspecting.id}
                >
                  <RefreshCw className={`h-3 w-3 ${syncInProgress === inspecting.id ? "animate-spin" : ""}`} />
                  {syncInProgress === inspecting.id ? "Fetching..." : "Fetch New Items"}
                </Button>
              </div>

              {inspectedMaterials.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground bg-muted/20">
                  <p className="font-medium text-foreground">No records fetched from this portal yet</p>
                  <p className="text-xs mt-1">Click "Fetch New Items" to pull live procurement tenders and extract Material DNA directly from {inspecting.name}.</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => doSync(inspecting.id)}
                    disabled={syncInProgress === inspecting.id}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncInProgress === inspecting.id ? "animate-spin" : ""}`} />
                    Fetch Live Records Now
                  </Button>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Ref / Code</TH>
                        <TH>Original Description</TH>
                        <TH>Category</TH>
                        <TH>Qty</TH>
                        <TH>Live Link</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {inspectedMaterials.map((m) => (
                        <TR key={m.id}>
                          <TD className="font-mono text-xs font-medium">{m.originalMaterialCode}</TD>
                          <TD className="text-xs max-w-xs truncate" title={m.originalDescription}>
                            {m.originalDescription}
                          </TD>
                          <TD><Badge variant="outline" className="text-[10px]">{m.category}</Badge></TD>
                          <TD className="text-xs font-mono">{m.originalQuantity} {m.originalUom}</TD>
                          <TD>
                            {m.sourceUrl ? (
                              <a
                                href={m.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                View Notice <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!disconnecting}
        onClose={() => setDisconnecting(null)}
        onConfirm={() => {
          if (disconnecting) disconnectRepository(disconnecting.id);
          toast("info", "Repository disconnected", "This repository is now offline and will stop receiving syncs.");
        }}
        title="Disconnect repository"
        message={`Disconnect "${disconnecting?.name}"? Existing imported records remain, but it will stop synchronizing.`}
        confirmLabel="Disconnect"
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Connect CPSE Repository" size="md">
        <div className="space-y-4">
          <Field label="Repository name">
            <input className="input-field" placeholder="e.g. NTPC e-Tendering" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Source URL">
            <input className="input-field" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>
          <Field label="Repository type">
            <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {["e-Procurement/CPPP", "GeM", "CPSE_PORTAL", "DATAGOV", "MANUAL"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["GENERAL", "REFINING", "E&P", "GAS", "POWER", "STEEL", "EQUIPMENT", "MINING"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                connectRepository(form);
                setAddOpen(false);
                setForm({ name: "", url: "", type: "e-Procurement/CPPP", category: "GENERAL" });
                toast("success", "Repository connected", "A new repository has been configured and is ready for live sync.");
              }}
            >
              <Link2 className="h-4 w-4" /> Connect
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
