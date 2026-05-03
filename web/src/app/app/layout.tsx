import { requireUser } from "@/lib/auth";
import AppShell from "./_components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireUser();
  return <AppShell user={user} tenant={tenant}>{children}</AppShell>;
}
