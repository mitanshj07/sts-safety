// apps/web/src/app/(command)/dashboard/page.tsx
import { DashboardLive } from "@/components/command/DashboardLive";
import { requireRolePage } from "@/lib/auth/guards";
import { COMMAND_ROLES } from "@/lib/auth/roles";

export default async function CommandDashboardPage() {
  await requireRolePage(COMMAND_ROLES);
  return <DashboardLive />;
}
