import { useEffect, useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

const roleTone: Record<string, "info" | "warning" | "success" | "neutral" | "danger"> = {
  ADMIN: "danger",
  DATA_STEWARD: "info",
  REVIEWER: "warning",
  PROCUREMENT_USER: "success",
  VIEWER: "neutral",
};

const roleDesc: Record<string, string> = {
  ADMIN: "Full access to users, configuration, audit and settings.",
  DATA_STEWARD: "Material DNA, data quality, matching and review.",
  REVIEWER: "Review and approve/reject AI match recommendations.",
  PROCUREMENT_USER: "Materials, demand and procurement insights.",
  VIEWER: "Read-only dashboards and material records.",
};

export default function Users() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    api.users().then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div>
      <PageHeader title="Users & Roles" description="Manage access to the National Material Identity Platform." />
      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <UsersIcon className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No users found.</h2>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Access</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((u) => (
                  <TR key={u.id}>
                    <TD>
                      <p className="font-medium">{u.displayName || u.username}</p>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </TD>
                    <TD className="text-sm">{u.email || "—"}</TD>
                    <TD><Badge tone={roleTone[u.role] || "neutral"}>{u.role.replace(/_/g, " ")}</Badge></TD>
                    <TD className="max-w-xs text-sm text-muted-foreground">{roleDesc[u.role] || "—"}</TD>
                    <TD><Badge tone={u.enabled ? "success" : "danger"}>{u.enabled ? "Active" : "Disabled"}</Badge></TD>
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
