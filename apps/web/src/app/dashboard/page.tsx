import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Me = {
  id: string;
  email: string;
  name: string;
  companies: Array<{ id: string; name: string; slug: string; role: string }>;
};

async function getMe(): Promise<Me | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  const company = me.companies[0];
  const navigation = ["Dashboard", "Campanhas", "Metas", "Criativos", "Conteúdo", "Leads", "Radar IA", "Autopilot"];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span>GM</span><strong>GerenteMarketing</strong></div>
        <nav>
          {navigation.map((item, index) => (
            <div className={index === 0 ? "nav-item active" : "nav-item"} key={item}>
              <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>{item}
            </div>
          ))}
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
            <span className="eyebrow">CENTRO DE COMANDO</span>
            <h1>Dashboard</h1>
          </div>
          <div className="topbar-actions">
            <span className="live-pill"><i className="signal-dot" /> BASE ONLINE</span>
            <div className="user-chip"><strong>{me.name}</strong><span>{me.email}</span></div>
            <LogoutButton />
          </div>
        </header>

        <section className="welcome-card">
          <div>
            <span className="eyebrow">PRIMEIRO WORKSPACE</span>
            <h2>{company?.name || "Configure sua empresa"}</h2>
            <p>A fundação está ativa. O próximo passo é conectar dados reais da Meta para preencher métricas e recomendações.</p>
          </div>
          <div className="growth-score empty-score"><strong>—</strong><span>Growth Score</span><small>Aguardando dados</small></div>
        </section>

        <section className="metric-grid">
          {[
            ["Gasto", "R$ 0,00"],
            ["Receita atribuída", "R$ 0,00"],
            ["Leads", "0"],
            ["Vendas", "0"],
            ["ROAS", "—"],
            ["CPA", "—"],
          ].map(([label, value]) => (
            <article className="metric-card" key={label}>
              <span>{label}</span><strong>{value}</strong><small>Sem fonte conectada</small>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <article className="panel large-panel">
            <div className="panel-title"><div><span className="eyebrow">METAS</span><h3>Progresso</h3></div><span className="status-muted">Nenhuma meta</span></div>
            <div className="empty-state"><div className="empty-orbit" /><strong>Pronto para sua primeira meta</strong><p>Quando criarmos campanhas e metas, o progresso real aparecerá aqui.</p></div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><span className="eyebrow">RADAR IA</span><h3>Oportunidades</h3></div></div>
            <div className="empty-state compact"><strong>Aguardando sinais</strong><p>Nenhum score é inventado. O Radar IA só será ativado quando houver dados suficientes.</p></div>
          </article>
        </section>
      </section>
    </main>
  );
}
