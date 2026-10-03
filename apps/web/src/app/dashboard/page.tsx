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
          <span className="eyebrow">PRIMEIRO WORKSPACE</span>
          <h2>{company?.name || "Configure sua empresa"}</h2>
          <p>A fundação está ativa. Campanhas e metas internas já podem ser estruturadas antes da conexão com dados reais da Meta.</p>
        </div>
        <div className="growth-score empty-score"><strong>—</strong><span>Growth Score</span><small>Aguardando dados da Meta</small></div>
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
            <span>{label}</span><strong>{value}</strong><small>Sem fonte Meta conectada</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel large-panel">
          <div className="panel-title">
            <div><span className="eyebrow">METAS</span><h3>Progresso</h3></div>
            <span className="status-muted">{activeGoals.length ? `${activeGoals.length} ativa(s)` : "Nenhuma meta"}</span>
          </div>
          {activeGoals.length ? (
            <div className="goal-preview-list">
              {activeGoals.map((goal) => (
                <div className="goal-preview" key={goal.id}>
                  <div className="goal-preview-head"><strong>{goal.name}</strong><span>{goal.projection.progressPercent}%</span></div>
                  <div className="progress-track"><i style={{ width: `${Math.min(100, goal.projection.progressPercent)}%` }} /></div>
                  <small>{goal.currentValue} de {goal.targetValue} · {goal.metric}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-orbit" /><strong>Pronto para sua primeira meta</strong><p>Crie uma campanha e uma meta para acompanhar progresso e projeção inicial.</p></div>
          )}
        </article>
        <article className="panel">
          <div className="panel-title"><div><span className="eyebrow">RADAR IA</span><h3>Oportunidades</h3></div></div>
          <div className="empty-state compact"><strong>Aguardando sinais</strong><p>Nenhum score é inventado. O Radar IA só será ativado quando houver dados suficientes.</p></div>
        </article>
      </section>
    </AppFrame>
  );
}
