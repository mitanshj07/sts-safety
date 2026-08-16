// apps/web/src/app/(command)/layout.tsx
import { CommandShell } from "@/components/command/CommandShell";
import { requireRolePage } from "@/lib/auth/guards";
import { COMMAND_ROLES } from "@/lib/auth/roles";
import { fetchCommandSnapshot } from "@/lib/command/queries";

export default async function CommandLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRolePage(COMMAND_ROLES);
  let initial;
  try {
    initial = await fetchCommandSnapshot();
  } catch {
    initial = undefined;
  }
  return <CommandShell initial={initial}>{children}</CommandShell>;
}
