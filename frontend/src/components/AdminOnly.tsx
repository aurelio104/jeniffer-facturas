import { isAdmin } from '../lib/auth';

export function AdminOnly({ children }: { children: React.ReactNode }) {
  if (!isAdmin()) return null;
  return <>{children}</>;
}
