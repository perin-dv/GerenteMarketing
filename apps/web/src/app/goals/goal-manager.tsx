"use client";

import { FormEvent, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Campaign = { id: string; name: string; status: string };
type Goal = {
  id: string;
  name: string;
  metric: string;
  status: string;
  targetValue: number;
  currentValue: number;
  targetDate: string;
  campaign: Campaign | null;
  projection: { projectedValue: number; progressPercent: number; projectedPercent: number; paceStatus: string };
};

const metricLabel: Record<string, string> = {
  LEADS: "Leads",
  SALES: "Vendas",
  REVENUE: "Receita",
  ROAS: "ROAS",
  CPA: "CPA",
};

const paceLabel: Record<string, string> = {
  NO_DATA: "Sem ritmo",
  AHEAD: "Acima do ritmo",
  ON_TRACK: "No ritmo",
  AT_RISK: "Em risco",
};

export function GoalManager({ initialGoals, campaigns }: { initialGoals: Goal[]; campaigns: Campaign[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(() => ({
    active: goals.filter((goal) => goal.status === "ACTIVE").length,
    onTrack: goals.filter((goal) => ["ON_TRACK", "AHEAD"].includes(goal.projection.paceStatus)).length,
    atRisk: goals.filter((goal) => goal.projection.paceStatus === "AT_RISK").length,
  }), [goals]);

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const campaignId = String(form.get("campaignId") || "");
    const payload = {
      name: String(form.get("name") || ""),
      metric: String(form.get("metric") || "LEADS"),
      targetValue: Number(form.get("targetValue") || 0),
      currentValue: Number(form.get("currentValue") || 0),
      targetDate: new Date(String(form.get("targetDate"))).toISOString(),
      campaignId: campaignId || undefined,
    };

    try {
      const response = await fetch(`${apiUrl}/goals`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Não foi possível criar a meta.");
      const created = await response.json();
      setGoals((current) => [created, ...current]);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar meta.");
    } finally {
      setBusy(false);
    }
  }

  async function patchGoal(id: string, payload: Record<string, unknown>) {
    const response = await fetch(`${apiUrl}/goals/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setError("Não foi possível atualizar a meta.");
      return;
    }
    const updated = await response.json();
    setGoals((current) => current.map((goal) => goal.id === id ? updated : goal));
  }

  function updateCurrent(goal: Goal) {
    const value = window.prompt(`Valor atual para ${goal.name}:`, String(goal.currentValue));
    if (value === null) return;
    const number = Number(value.replace(",", "."));
    if (!Number.isFinite(number) || number < 0) return setError("Informe um valor válido.");
    void patchGoal(goal.id, { currentValue: number });
  }

  async function removeGoal(id: string) {
    if (!window.confirm("Excluir esta meta?")) return;
    const response = await fetch(`${apiUrl}/goals/${id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) return setError("Não foi possível excluir a meta.");
    setGoals((current) => current.filter((goal) => goal.id !== id));
  }

  return (
    <>
      <section className="summary-strip">
        <div><span>Metas ativas</span><strong>{summary.active}</strong></div>
        <div><span>No ritmo</span><strong>{summary.onTrack}</strong></div>
        <div><span>Em risco</span><strong>{summary.atRisk}</strong></div>
      </section>

      <section className="workspace-grid">
        <article className="panel form-panel">
          <div className="panel-title"><div><span className="eyebrow">NOVA META</span><h3>Objetivo mensurável</h3></div></div>
          <form className="entity-form" onSubmit={createGoal}>
            <label>Nome<input name="name" minLength={3} required placeholder="Ex.: 40 leads em outubro" /></label>
            <label>Métrica<select name="metric" defaultValue="LEADS"><option value="LEADS">Leads</option><option value="SALES">Vendas</option><option value="REVENUE">Receita</option><option value="ROAS">ROAS</option><option value="CPA">CPA</option></select></label>
            <div className="form-row">
              <label>Alvo<input name="targetValue" type="number" min="0.01" step="0.01" required placeholder="40" /></label>
              <label>Atual<input name="currentValue" type="number" min="0" step="0.01" defaultValue="0" /></label>
            </div>
            <label>Prazo<input name="targetDate" type="date" required /></label>
            <label>Campanha<select name="campaignId" defaultValue=""><option value="">Sem campanha vinculada</option>{campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}</select></label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="primary-button" disabled={busy}>{busy ? "Criando..." : "Criar meta"}</button>
          </form>
        </article>

        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">METAS</span><h3>Progresso e projeção</h3></div><span className="status-muted">Projeção interna inicial</span></div>
          {goals.length ? (
            <div className="entity-list">
              {goals.map((goal) => (
                <div className="goal-row" key={goal.id}>
                  <div className="goal-row-head">
                    <div><strong>{goal.name}</strong><small>{metricLabel[goal.metric] || goal.metric}{goal.campaign ? ` · ${goal.campaign.name}` : ""}</small></div>
                    <span className={`pace-badge ${goal.projection.paceStatus.toLowerCase()}`}>{paceLabel[goal.projection.paceStatus] || goal.projection.paceStatus}</span>
                  </div>
                  <div className="progress-track"><i style={{ width: `${Math.min(100, goal.projection.progressPercent)}%` }} /></div>
                  <div className="goal-numbers">
                    <span><b>{goal.currentValue}</b> atual</span>
                    <span><b>{goal.targetValue}</b> alvo</span>
                    <span><b>{goal.projection.projectedValue}</b> projetado</span>
                    <span><b>{goal.projection.progressPercent}%</b> concluído</span>
                  </div>
                  <div className="row-actions">
                    <button className="ghost-button" onClick={() => updateCurrent(goal)}>Atualizar valor</button>
                    <button className="ghost-button" onClick={() => patchGoal(goal.id, { status: goal.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}>{goal.status === "ACTIVE" ? "Pausar" : "Ativar"}</button>
                    <button className="danger-button" onClick={() => removeGoal(goal.id)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><strong>Nenhuma meta</strong><p>Crie uma meta para começar a medir progresso e ritmo interno.</p></div>}
        </article>
      </section>
    </>
  );
}
