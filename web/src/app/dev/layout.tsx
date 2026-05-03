import { requireUser } from "@/lib/auth";

export default async function DevLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
