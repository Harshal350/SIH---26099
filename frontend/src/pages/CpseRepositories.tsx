import { useState } from "react";
import {
  Building2, RefreshCw, Link2, Unplug, Eye, ExternalLink, Plus, HardDrive, CheckCircle2, AlertTriangle,
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
  const { repos, syncRepository, disconnectRepository, connectRepository } = useProto();
  const { toast } = useToast();
  const [inspecting, setInspecting] = useState<Repo | null>(null);
  const [disconnecting, setDisconnecting] = useState<Repo | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", url: "", type: "e-Procurement/CPPP", category: "GENERAL" });

  async function doSync(id: number) {
    setSyncInProgress(id);
    await syncRepository(id);
    setSyncInProgress(null);
    toast("success", "Repository synced", "Latest material records pulled successfully.");
  }

  return (
    <div>
      <PageHeader
        title="Connected CPSE Repositories"
        description="Manage the CPSE procurement / material repositories that feed the platform."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Connect Repository
          </Button>
        }
      />

      {repos.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10 text-muted-foreground" />}
          title="No repositories connected"
          description="Connect a CPSE repository to begin ingesting material records."
          action={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Connect Repository</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Repository</TH>
                  <TH>Type</TH>
                  <TH>Records</TH>
                  <TH>Last synced</TH>
                  <TH>Sync status</TH>
                  <TH>Extraction</TH>
                  <TH>Health</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {repos.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.url}</p>
                    </TD>
                    <TD><Badge>{r.type}</Badge></TD>
                    <TD className="font-mono">{r.records.toLocaleString()}</TD>
                    <TD className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(r.lastSync).toLocaleString()}
                    </TD>
                    <TD>
                      <Badge tone={statusTone(r.status)}>{r.syncStatus}</Badge>
                    </TD>
                    <TD className="text-sm">{r.extractionStatus}</TD>
                    <TD>
                      <span className={`inline-flex items-center gap-1.5 text-sm ${r.health === "Healthy" ? "text-success" : "text-warning"}`}>
                        <span className={`h-2 w-2 rounded-full ${r.health === "Healthy" ? "bg-success" : "bg-warning"}`} />
                        {r.health}
                      </span>
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip content="Inspect repository details and extracted data">
                          <Button variant="ghost" className="p-2" onClick={() => setInspecting(r)} disabled={r.status === "DISCONNECTED"}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Sync (pull) the latest records">
                          <Button variant="ghost" className="p-2" onClick={() => doSync(r.id)} disabled={r.status === "DISCONNECTED" || syncInProgress === r.id}>
                            <RefreshCw className={`h-4 w-4 ${syncInProgress === r.id ? "animate-spin" : ""}`} />
                          </Button>
                        </Tooltip>
                        <Tooltip content="View source in new tab">
                          <a href={r.url} target="_blank" rel="noreferrer" className="rounded-md p-2 text-muted-foreground hover:bg-muted" onClick={(e) => { if (!r.url || r.url.startsWith("https://")) e.preventDefault(); }}>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Tooltip>
                        <Tooltip content="Disconnect repository">
                          <Button variant="ghost" className="p-2 text-destructive" onClick={() => setDisconnecting(r)} disabled={r.status === "DISCONNECTED"}>
                            <Unplug className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><HardDrive className="h-4 w-4 text-primary" /> Total records</div>
          <p className="mt-1 text-2xl font-semibold">{repos.filter((r) => r.status !== "DISCONNECTED").reduce((s, r) => s + r.records, 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Healthy</div>
          <p className="mt-1 text-2xl font-semibold">{repos.filter((r) => r.health === "Healthy").length} of {repos.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertTriangle className="h-4 w-4" /> Need attention</div>
          <p className="mt-1 text-2xl font-semibold">{repos.filter((r) => r.health !== "Healthy" && r.status !== "DISCONNECTED").length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Link2 className="h-4 w-4" /> Connected</div>
          <p className="mt-1 text-2xl font-semibold">{repos.filter((r) => r.status !== "DISCONNECTED").length} of {repos.length}</p>
        </Card>
      </div>

      <Modal open={!!inspecting} onClose={() => setInspecting(null)} title="Repository details" size="md">
        {inspecting && (
          <div className="space-y-3 text-sm">
            <Row k="Name" v={inspecting.name} />
            <Row k="Source URL" v={inspecting.url} />
            <Row k="Type" v={inspecting.type} />
            <Row k="Connection status" v={<Badge tone={statusTone(inspecting.status)}>{inspecting.status}</Badge>} />
            <Row k="Material records" v={inspecting.records.toLocaleString()} />
            <Row k="Last synced" v={new Date(inspecting.lastSync).toLocaleString()} />
            <Row k="Sync status" v={inspecting.syncStatus} />
            <Row k="Data extraction" v={inspecting.extractionStatus} />
            <Row k="Connection health" v={inspecting.health} />
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Connect repository" size="md">
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
              {["GENERAL", "REFINING", "E&P", "GAS", "POWER", "STEEL", "EQUIPMENT"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                connectRepository(form);
                setAddOpen(false);
                setForm({ name: "", url: "", type: "e-Procurement/CPPP", category: "GENERAL" });
                toast("success", "Repository connected", "A new repository sync has been scheduled.");
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
