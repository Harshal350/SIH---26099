import { History } from "lucide-react";
import { useProto } from "@/context/prototype-data";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export default function Audit() {
  const { auditEvents } = useProto();
  const items = auditEvents.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const toneFor = (action: string) => {
    if (/APPROVED|CREATED|IMPORTED/.test(action)) return "success" as const;
    if (/REJECT|ERROR/.test(action)) return "danger" as const;
    if (/ESCAL/.test(action)) return "warning" as const;
    return "info" as const;
  };

  return (
    <div>
      <PageHeader title="Audit & Governance" description="A complete, immutable trail of decisions made in the platform." />
      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <History className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No audit events yet.</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Importing data, approving matches, and creating national codes all record an audit event.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Entity</TH>
                  <TH>Detail</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((e) => (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </TD>
                    <TD className="font-medium">{e.actor}</TD>
                    <TD><Badge tone={toneFor(e.action)}>{e.action.replace(/_/g, " ").toLowerCase()}</Badge></TD>
                    <TD className="text-sm text-muted-foreground">{e.entityType} #{e.entityId}</TD>
                    <TD className="max-w-xs text-sm">{e.detail || "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
