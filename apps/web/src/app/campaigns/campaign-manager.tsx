"use client";

import { FormEvent, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Campaign = {
  id: string;
  name: string;
  mode: string;
  channel: string;
  objective: string;
  status: string;
  budgetTotal: number;
  dailyBudget: number | null;
  plannedReels: number;
  plannedPosts: number;
  plannedStories: number;
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
  CONTENT: "Produção de conteúdo",
  COMMUNITY: "Crescer comunidade",
  WHATSAPP: "Conversas no WhatsApp",
};

const channelLabel: Record<string, string> = {
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  TELEGRAM: "Telegram",
  MULTICHANNEL: "Multicanal",
};

const modeLabel: Record<string, string> = {
  ORGANIC: "Orgânica · R$ 0",
  PAID: "Tráfego pago",
  HYBRID: "Híbrida",
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
    organic: campaigns.filter((campaign) => campaign.mode === "ORGANIC").length,
    content: campaigns.reduce((sum, campaign) => sum + (campaign.plannedReels || 0) + (campaign.plannedPosts || 0) + (campaign.plannedStories || 0), 0),
  }), [campaigns]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const mode = String(form.get("mode") || "ORGANIC");
    const payload = {
      name: String(form.get("name") || ""),
      mode,
      channel: String(form.get("channel") || "INSTAGRAM"),
      objective: String(form.get("objective") || "WHATSAPP"),
      budgetTotal: mode === "ORGANIC" ? 0 : Number(form.get("budgetTotal") || 0),
      dailyBudget: mode === "ORGANIC" || !form.get("dailyBudget") ? undefined : Number(form.get("dailyBudget")),
      plannedReels: Number(form.get("plannedReels") || 0),
      plannedPosts: Number(form.get("plannedPosts") || 0),
      plannedStories: Number(form.get("plannedStories") || 0),
      startDate: form.get("startDate") ? new Date(String(form.get("startDate"))).toISOString() : undefined,
      endDate: form.get("endDate") ? new Date(String(form.get("endDate"))).toISOString() : undefined,
      notes: String(form.get("notes") || "") || undefined,
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
        <div><span>Orgânicas · R$ 0</span><strong>{totals.organic}</strong></div>
        <div><span>Conteúdos planejados</span><strong>{totals.content}</strong></div>
      </section>

      <section className="organic-banner">
        <div><span className="eyebrow">MODO PRINCIPAL</span><h3>Crescimento orgânico primeiro</h3><p>Você pode operar com orçamento R$ 0. O GerenteMarketing organiza conteúdo, metas e rotina. Tráfego pago continua opcional e nunca é disparado nesta fase.</p></div>
        <strong>R$ 0 obrigatório? Não.</strong>
      </section>

      <section className="workspace-grid">
        <article className="panel form-panel">
          <div className="panel-title"><div><span className="eyebrow">NOVA CAMPANHA</span><h3>Plano de crescimento</h3></div></div>
          <form className="entity-form" onSubmit={createCampaign}>
            <label>Nome<input name="name" minLength={3} required placeholder="Ex.: Tem Na Loja · Outubro orgânico" /></label>
            <div className="form-row">
              <label>Modo<select name="mode" defaultValue="ORGANIC"><option value="ORGANIC">Orgânica · R$ 0</option><option value="HYBRID">Híbrida · opcional</option><option value="PAID">Tráfego pago · opcional</option></select></label>
              <label>Canal principal<select name="channel" defaultValue="INSTAGRAM"><option value="INSTAGRAM">Instagram</option><option value="WHATSAPP">WhatsApp</option><option value="FACEBOOK">Facebook</option><option value="TIKTOK">TikTok</option><option value="TELEGRAM">Telegram</option><option value="MULTICHANNEL">Multicanal</option></select></label>
            </div>
            <label>Objetivo<select name="objective" defaultValue="WHATSAPP"><option value="WHATSAPP">Gerar conversas no WhatsApp</option><option value="CONTENT">Produzir conteúdo</option><option value="COMMUNITY">Crescer comunidade</option><option value="AWARENESS">Reconhecimento</option><option value="ENGAGEMENT">Engajamento</option><option value="TRAFFIC">Tráfego</option><option value="LEADS">Leads</option><option value="SALES">Vendas</option></select></label>
            <div className="form-row three">
              <label>Reels planejados<input name="plannedReels" type="number" min="0" step="1" defaultValue="12" /></label>
              <label>Posts planejados<input name="plannedPosts" type="number" min="0" step="1" defaultValue="8" /></label>
              <label>Stories planejados<input name="plannedStories" type="number" min="0" step="1" defaultValue="20" /></label>
            </div>
            <div className="form-row">
              <label>Orçamento total opcional<input name="budgetTotal" type="number" min="0" step="0.01" defaultValue="0" placeholder="0" /><small>No modo orgânico será salvo como R$ 0.</small></label>
              <label>Orçamento/dia opcional<input name="dailyBudget" type="number" min="0" step="0.01" placeholder="0" /><small>Só será usado futuramente em modo pago/híbrido.</small></label>
            </div>
            <div className="form-row">
              <label>Início<input name="startDate" type="date" /></label>
              <label>Fim<input name="endDate" type="date" /></label>
            </div>
            <label>Estratégia / observações<textarea name="notes" rows={4} placeholder="Ex.: 3 Reels por semana, CTA para WhatsApp, conteúdo sobre códigos de peças e diferenças H4/H7." /></label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="primary-button" disabled={busy}>{busy ? "Criando..." : "Criar plano orgânico"}</button>
          </form>
        </article>

        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">CAMPANHAS</span><h3>Rotina de crescimento</h3></div><span className="status-muted">Nenhum anúncio é disparado</span></div>
          {campaigns.length ? (
            <div className="entity-list">
              {campaigns.map((campaign) => {
                const contentTotal = (campaign.plannedReels || 0) + (campaign.plannedPosts || 0) + (campaign.plannedStories || 0);
                return (
                  <div className="entity-row" key={campaign.id}>
                    <div className="entity-main">
                      <div className="entity-title"><strong>{campaign.name}</strong><span className={`status-badge ${campaign.status.toLowerCase()}`}>{statusLabel[campaign.status] || campaign.status}</span></div>
                      <small>{modeLabel[campaign.mode] || campaign.mode} · {channelLabel[campaign.channel] || campaign.channel} · {objectiveLabel[campaign.objective] || campaign.objective}</small>
                      <small>{contentTotal} conteúdos planejados ({campaign.plannedReels || 0} Reels, {campaign.plannedPosts || 0} posts, {campaign.plannedStories || 0} stories) · {campaign._count?.goals || 0} meta(s)</small>
                    </div>
                    <div className="row-actions">
                      <button className="ghost-button" onClick={() => toggleStatus(campaign)}>{campaign.status === "ACTIVE" ? "Pausar" : "Ativar"}</button>
                      <button className="danger-button" onClick={() => removeCampaign(campaign.id)}>Excluir</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div className="empty-state"><strong>Nenhuma campanha orgânica</strong><p>Crie um plano com R$ 0 e defina quantos Reels, posts e stories quer produzir no período.</p></div>}
        </article>
      </section>
    </>
  );
}
