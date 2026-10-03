"use client";

import { FormEvent, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  budgetTotal: number;
  dailyBudget: number | null;
  startDate: string | null;
  endDate: string | null;
  _count?: { goals: number };
};

const objectiveLabel: Record<string, string> = {
  AWARENESS: "Reconhecimento",
  TRAFFIC: "Tráfego",
  ENGAGEMENT: "Engajamento",
  LEADS: "Leads",
  SALES: "Vendas",
};

const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  ARCHIVED: "Arquivada",
};

export function CampaignManager({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => ({
    count: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === "ACTIVE").length,
    budget: campaigns.reduce((sum, campaign) => sum + Number(campaign.budgetTotal || 0), 0),
  }), [campaigns]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      objective: String(form.get("objective") || "LEADS"),
      budgetTotal: Number(form.get("budgetTotal") || 0),
      dailyBudget: form.get("dailyBudget") ? Number(form.get("dailyBudget")) : undefined,
      startDate: form.get("startDate") ? new Date(String(form.get("startDate"))).toISOString() : undefined,
      endDate: form.get("endDate") ? new Date(String(form.get("endDate"))).toISOString() : undefined,
    };

    try {
      const response = await fetch(`${apiUrl}/campaigns`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Não foi possível criar a campanha.");
      const created = await response.json();
      setCampaigns((current) => [{ ...created, _count: { goals: 0 } }, ...current]);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(campaign: Campaign) {
    const nextStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const response = await fetch(`${apiUrl}/campaigns/${campaign.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) return setError("Não foi possível alterar o status.");
    const updated = await response.json();
    setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, ...updated } : item));
  }

  async function removeCampaign(id: string) {
    if (!window.confirm("Excluir esta campanha interna?")) return;
    const response = await fetch(`${apiUrl}/campaigns/${id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) return setError("Não foi possível excluir a campanha.");
    setCampaigns((current) => current.filter((campaign) => campaign.id !== id));
  }

  return (
    <>
      <section className="summary-strip">
        <div><span>Campanhas</span><strong>{totals.count}</strong></div>
        <div><span>Ativas</span><strong>{totals.active}</strong></div>
        <div><span>Orçamento planejado</span><strong>{totals.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
      </section>

      <section className="workspace-grid">
        <article className="panel form-panel">
          <div className="panel-title"><div><span className="eyebrow">NOVA CAMPANHA</span><h3>Planejamento interno</h3></div></div>
          <form className="entity-form" onSubmit={createCampaign}>
            <label>Nome<input name="name" minLength={3} required placeholder="Ex.: Lâmpadas H7 Maringá" /></label>
            <label>Objetivo<select name="objective" defaultValue="LEADS"><option value="AWARENESS">Reconhecimento</option><option value="TRAFFIC">Tráfego</option><option value="ENGAGEMENT">Engajamento</option><option value="LEADS">Leads</option><option value="SALES">Vendas</option></select></label>
            <div className="form-row">
              <label>Orçamento total<input name="budgetTotal" type="number" min="0" step="0.01" required placeholder="500" /></label>
              <label>Orçamento/dia<input name="dailyBudget" type="number" min="0" step="0.01" placeholder="30" /></label>
            </div>
            <div className="form-row">
              <label>Início<input name="startDate" type="date" /></label>
              <label>Fim<input name="endDate" type="date" /></label>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="primary-button" disabled={busy}>{busy ? "Criando..." : "Criar campanha"}</button>
          </form>
        </article>

        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">CAMPANHAS</span><h3>Controle interno</h3></div><span className="status-muted">Meta API ainda não conectada</span></div>
          {campaigns.length ? (
            <div className="entity-list">
              {campaigns.map((campaign) => (
                <div className="entity-row" key={campaign.id}>
                  <div className="entity-main">
                    <div className="entity-title"><strong>{campaign.name}</strong><span className={`status-badge ${campaign.status.toLowerCase()}`}>{statusLabel[campaign.status] || campaign.status}</span></div>
                    <small>{objectiveLabel[campaign.objective] || campaign.objective} · {Number(campaign.budgetTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {campaign._count?.goals || 0} meta(s)</small>
                  </div>
                  <div className="row-actions">
                    <button className="ghost-button" onClick={() => toggleStatus(campaign)}>{campaign.status === "ACTIVE" ? "Pausar" : "Ativar"}</button>
                    <button className="danger-button" onClick={() => removeCampaign(campaign.id)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><strong>Nenhuma campanha</strong><p>Crie o primeiro planejamento interno. Na Fase 5 ele poderá ser ligado à Meta.</p></div>}
        </article>
      </section>
    </>
  );
}
