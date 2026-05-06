import { ChevronRight } from 'lucide-react';
import { ADMIN_NAV, type AdminSection } from './AdminSidebar';

export function AdminBreadcrumb({ section }: { section: AdminSection }) {
  const current = ADMIN_NAV.find(n => n.id === section);
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex items-center"
      style={{
        fontSize: 12,
        color: 'hsl(var(--text-tertiary))',
        paddingBottom: 16,
        marginBottom: 16,
        borderBottom: '0.5px solid hsl(var(--color-border-tertiary))',
      }}
    >
      <span>Admin</span>
      <ChevronRight className="mx-1.5 w-3 h-3" />
      <span style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>
        {current?.label ?? 'Console'}
      </span>
    </nav>
  );
}
