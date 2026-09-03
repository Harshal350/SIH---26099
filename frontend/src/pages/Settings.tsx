import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Info, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Settings() {
  const [health, setHealth] = useState<string>("checking...");

  useEffect(() => {
    api.health().then((h) => setHealth(h.status)).catch(() => setHealth("unreachable"));
  }, []);

  return (
    <div>
      <PageHeader title="Settings" description="Platform configuration and data policies." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-4 w-4" /> Service status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="font-medium">Backend API</span>
              <span className={`font-medium ${health === "UP" ? "text-success" : "text-destructive"}`}>{health}</span>
            </div>
            <p className="text-muted-foreground">
              This prototype runs a Spring Boot backend, a Python AI service, and a PostgreSQL database.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Data provenance policy</CardTitle>
            <CardDescription>Every record keeps its original source identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              This platform is designed to consume the official CPSE Material Master Dataset that the problem statement
              specifies will be provided by participating CPSEs.
            </p>
            <p>
              The prototype is populated with real, publicly available Indian government procurement and technical
              specification data only. Fabricated source records are not used.
            </p>
            <p className="text-muted-foreground">
              Original material codes and descriptions are never overwritten — normalized values and AI assessments are
              stored as derived data alongside them.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
