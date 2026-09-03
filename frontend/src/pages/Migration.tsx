import { useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Loader2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const steps = ["Select source", "Upload & validate", "Complete"];

const cpseOptions = [
  "IOCL", "BPCL", "HPCL", "CPCL", "ONGC", "GAIL", "NTPC", "BHEL", "SAIL", "Coal India", "NMDC", "Other CPSE",
];
const sourceTypes = ["TENDER", "BOQ", "GEM", "DATAGOV", "CPSE_PORTAL", "MANUAL"];

type ImportResult = {
  id: number;
  fileName: string;
  sourceOrganization: string;
  sourceType: string;
  status: string;
  totalRecords: number | null;
  validRecords: number | null;
  invalidRecords: number | null;
  importedRecords: number | null;
  errorMessage: string | null;
};

export default function Migration() {
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [cpse, setCpse] = useState("");
  const [sourceType, setSourceType] = useState("TENDER");
  const [document, setDocument] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function uploadAndValidate() {
    if (!file) {
      toast("warning", "No file selected", "Please choose a CSV or Excel file to import.");
      return;
    }
    setError("");
    setUploading(true);
    setPhase("Creating import job");
    setStep(1);
    try {
      const job = await api.createImportJob({
        sourceOrganization: cpse || "UNKNOWN_CPSE",
        sourceType,
        sourceDocument: document,
        sourceUrl: url,
        fileName: file.name,
        uploadedBy: "admin",
      });
      setPhase("Uploading and validating records");
      const res = await api.uploadFile(job.id, file);
      setResult(res as ImportResult);
      setUploading(false);
      setPhase(null);
      if (res.status === "FAILED") {
        toast("error", "Import failed", (res as ImportResult).errorMessage || "The file could not be imported.");
      } else {
        toast("success", "Import complete", `${res.importedRecords} records ingested, ${res.invalidRecords} flagged.`);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Import failed");
      setUploading(false);
      setPhase(null);
      setStep(2);
    }
  }

  function reset() {
    setStep(0);
    setCpse("");
    setSourceType("TENDER");
    setDocument("");
    setUrl("");
    setFile(null);
    setResult(null);
    setError("");
    setPhase(null);
    setUploading(false);
  }

  const failed = result?.status === "FAILED";
  const partial = result?.status === "PARTIAL";

  return (
    <div>
      <PageHeader
        title="Migration · Import Material Data"
        description="Upload your own CPSE material extract (CSV or Excel). Records are parsed, validated and analyzed by the AI service — no data is generated."
      />

      <Card className="mb-5 p-4">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {steps.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? "bg-success text-white" : active ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <span className={active || done ? "font-medium" : "text-muted-foreground"}>{label}</span>
                {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
              </li>
            );
          })}
        </ol>
      </Card>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5" /> Select import source</CardTitle>
            <CardDescription>Choose the CPSE, source type and document, then select your own material extract file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Source CPSE / Organization *</label>
                <Select value={cpse} onChange={(e) => setCpse(e.target.value)} required>
                  <option value="" disabled>Select a CPSE</option>
                  {cpseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Source type</label>
                <Select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                  {sourceTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Source document (reference)</label>
              <Input placeholder="e.g. Tender BOQ reference" value={document} onChange={(e) => setDocument(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Source URL (optional)</label>
              <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Material extract file (CSV / XLS / XLSX) *</label>
              <Input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Expected columns: material_code, description, uom, quantity (flexible headers supported). Original codes and descriptions are never overwritten.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={uploadAndValidate} disabled={!file || !cpse || uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Upload & validate"} {!uploading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Uploading & validating</CardTitle>
            <CardDescription>Your file is being parsed and each record analyzed by the AI service for normalization and Material DNA extraction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">{phase || "Processing..."}</span>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{file?.name || "…"}</p>
              <p className="text-xs">{cpse} · {sourceType}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {failed ? <XCircle className="h-5 w-5 text-destructive" /> : partial ? <AlertTriangle className="h-5 w-5 text-warning" /> : <CheckCircle2 className="h-5 w-5 text-success" />}
                {failed ? "Import failed" : partial ? "Import completed with flags" : "Import complete"}
              </CardTitle>
              <CardDescription>
                {result?.fileName} · {result?.sourceOrganization}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
              ) : failed ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {result?.errorMessage || "The import could not be completed. Check that your file headers match the expected columns."}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Records parsed</p>
                      <p className="text-xl font-semibold">{result?.totalRecords?.toLocaleString() ?? "—"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Valid / imported</p>
                      <p className="text-xl font-semibold text-success">{result?.importedRecords?.toLocaleString() ?? "—"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">Flagged for review</p>
                      <p className="text-xl font-semibold text-warning">{result?.invalidRecords?.toLocaleString() ?? "—"}</p>
                    </div>
                  </div>

                  {partial && (
                    <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                      <AlertTriangle className="h-4 w-4" /> Some rows were skipped (empty or malformed). {result?.validRecords} valid rows were ingested.
                    </div>
                  )}

                  <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      Your records were imported and analyzed. Original codes and descriptions are preserved. Run the AI matcher to find cross-CPSE matches against the records already in the platform.
                    </span>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" /> Import another file</Button>
                {!failed && !error && (
                  <>
                    <Button onClick={() => (window.location.href = "/ai-matching")}><Sparkles className="mr-2 h-4 w-4" /> Run AI Matching</Button>
                    {partial && (
                      <Button variant="outline" onClick={() => (window.location.href = "/data-quality")}>Review flagged issues</Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {!failed && !error && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> What happens next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3"><Badge>1</Badge><p>Your records are stored with their original codes and descriptions preserved.</p></div>
                <div className="flex gap-3"><Badge>2</Badge><p>Each description is normalized and Material DNA extracted by the AI service.</p></div>
                <div className="flex gap-3"><Badge>3</Badge><p>Run AI Matching to compare your records with other CPSEs already loaded.</p></div>
                <div className="flex gap-3"><Badge>4</Badge><p>Review recommended matches in the Review Queue and approve to create national-code mappings.</p></div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
