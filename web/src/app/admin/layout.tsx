import { requireAdmin } from "@/lib/auth";
import AppShell from "../app/_components/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireAdmin();
  return <AppShell user={user} tenant={tenant}>{children}</AppShell>;
}
