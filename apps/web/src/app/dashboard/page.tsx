import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppFrame, type AppUser } from "../_components/app-frame";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Goal = {
  id: string;
  name: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  status: string;
  projection: { progressPercent: number; paceStatus: string };
};

const metricLabel: Record<string, string> = {
  FOLLOWERS: "Seguidores",
  REACH: "Alcance",
  VIEWS: "Visualizações",
  ENGAGEMENTS: "Interações",
  CONTENT_PUBLISHED: "Conteúdos publicados",
  REELS_PUBLISHED: "Reels publicados",
  POSTS_PUBLISHED: "Posts publicados",
  STORIES_PUBLISHED: "Stories publicados",
  WHATSAPP_CONVERSATIONS: "Conversas no WhatsApp",
  LEADS: "Leads",
  SALES: "Vendas",
  REVENUE: "Receita",
  ROAS: "ROAS",
  CPA: "CPA",
};

async function getData(): Promise<{ me: AppUser | null; goals: Goal[] }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const [meResponse, goalsResponse] = await Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
      fetch(`${apiUrl}/goals`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    ]);
    if (!meResponse.ok) return { me: null, goals: [] };
    return {
      me: await meResponse.json(),
      goals: goalsResponse.ok ? await goalsResponse.json() : [],
    };
  } catch {
    return { me: null, goals: [] };
  }
}

export default async function DashboardPage() {
  const { me, goals } = await getData();
  if (!me) redirect("/login");
  const company = me.companies[0];
  const activeGoals = goals.filter((goal) => goal.status === "ACTIVE").slice(0, 3);

  return (
    <AppFrame me={me} active="Dashboard" eyebrow="CENTRO DE COMANDO" title="Dashboard">
      <section className="welcome-card">
        <div>
          <span className="eyebrow">MODO ORGÂNICO</span>
          <h2>{company?.name || "Configure sua empresa"}</h2>
          <p>O GerenteMarketing está preparado para começar com R$ 0: planeje conteúdo, acompanhe metas e transforme alcance em conversas no WhatsApp. Tráfego pago é opcional.</p>
        </div>
        <div className="growth-score empty-score"><strong>R$0</strong><span>Modo inicial</span><small>Orgânico primeiro</small></div>
      </section>

      <section className="metric-grid">
        {[
          ["Seguidores", "—"],
          ["Alcance", "—"],
          ["Visualizações", "—"],
          ["Conversas WhatsApp", "—"],
          ["Leads", "—"],
          ["Vendas", "—"],
        ].map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span><strong>{value}</strong><small>Aguardando integração ou atualização real</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel large-panel">
          <div className="panel-title">
            <div><span className="eyebrow">METAS ORGÂNICAS</span><h3>Progresso</h3></div>
            <span className="status-muted">{activeGoals.length ? `${activeGoals.length} ativa(s)` : "Nenhuma meta"}</span>
          </div>
          {activeGoals.length ? (
            <div className="goal-preview-list">
              {activeGoals.map((goal) => (
                <div className="goal-preview" key={goal.id}>
                  <div className="goal-preview-head"><strong>{goal.name}</strong><span>{goal.projection.progressPercent}%</span></div>
                  <div className="progress-track"><i style={{ width: `${Math.min(100, goal.projection.progressPercent)}%` }} /></div>
                  <small>{goal.currentValue} de {goal.targetValue} · {metricLabel[goal.metric] || goal.metric}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-orbit" /><strong>Pronto para crescer sem anúncio</strong><p>Crie uma campanha orgânica e metas de conteúdo, alcance, seguidores ou conversas no WhatsApp.</p></div>
          )}
        </article>
        <article className="panel">
          <div className="panel-title"><div><span className="eyebrow">RADAR IA</span><h3>Oportunidades</h3></div></div>
          <div className="empty-state compact"><strong>Próxima etapa</strong><p>O Radar IA vai analisar resultados reais para sugerir temas, formatos e próximos conteúdos — sem fabricar likes, views ou seguidores.</p></div>
        </article>
      </section>
    </AppFrame>
  );
}
