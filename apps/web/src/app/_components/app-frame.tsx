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
  { label: "Metas", href: "/goals" },
  { label: "Criativos", href: "#" },
  { label: "Conteúdo", href: "#" },
  { label: "Leads", href: "#" },
  { label: "Radar IA", href: "#" },
  { label: "Autopilot", href: "#" },
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
            const enabled = item.href !== "#";
            const className = item.label === active ? "nav-item active" : enabled ? "nav-item" : "nav-item disabled";
            return enabled ? (
              <Link className={className} href={item.href} key={item.label}>
                <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>{item.label}
              </Link>
            ) : (
              <div className={className} key={item.label}>
                <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>{item.label}
              </div>
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
