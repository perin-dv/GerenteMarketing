import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "../dashboard/logout-button";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  companies: Array<{ id: string; name: string; slug: string; role: string }>;
};

const navigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Campanhas", href: "/campaigns" },
  { label: "WhatsApp Mkt", href: "/whatsapp-campaigns" },
  { label: "Metas", href: "/goals" },
  { label: "Conteúdo", href: "/content" },
  { label: "Performance", href: "/performance" },
  { label: "Leads", href: "/leads" },
  { label: "Radar IA", href: "/radar" },
  { label: "Experimentos", href: "/experiments" },
  { label: "Autopilot", href: "/autopilot" },
  { label: "Integrações", href: "/integrations" },
  { label: "Canais", href: "/channels" },
  { label: "Workspaces", href: "/workspaces" },
  { label: "Growth OS", href: "/growth" },
];

export function AppFrame({
  me,
  active,
  eyebrow,
  title,
  children,
}: {
  me: AppUser;
  active: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const company = me.companies[0];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span>GM</span><strong>GerenteMarketing</strong></div>
        <nav>
          {navigation.map((item, index) => {
            const className = item.label === active ? "nav-item active" : "nav-item";
            return (
              <Link className={className} href={item.href} key={item.label}>
                <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="tiny-label">WORKSPACE</span>
          <strong>{company?.name || "Sem empresa"}</strong>
          <span>{company?.role || "—"}</span>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <span className="live-pill"><i className="signal-dot" /> BASE ONLINE</span>
            <div className="user-chip"><strong>{me.name}</strong><span>{me.email}</span></div>
            <LogoutButton />
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
