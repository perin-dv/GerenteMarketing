"use client";

import { FormEvent, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Operação não concluída.");
  return data;
}

type Template = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  headerFormat: string | null;
  bodyText: string;
  bodyParameterCount: number;
};

type Audience = {
  id: string;
  name: string | null;
  phone: string | null;
  source: string;
  stage: string;
  campaignTag: string | null;
  consent: { optIn: boolean; updatedAt: string | null; source: string | null };
};

type Campaign = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  templateName: string | null;
  recipients: number;
};

export function WhatsappCampaignManager({
  initialTemplates,
  integration,
  initialAudience,
  initialCampaigns,
}: {
  initialTemplates: Template[];
  integration: { id: string; displayName?: string } | null;
  initialAudience: Audience[];
  initialCampaigns: Campaign[];
}) {
  const [audience, setAudience] = useState(initialAudience);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(initialTemplates[0] ? `${initialTemplates[0].name}::${initialTemplates[0].language}` : "");
  const [stage, setStage] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedTemplate = initialTemplates.find((item) => `${item.name}::${item.language}` === selectedTemplateKey) || null;
  const authorized = audience.filter((lead) => lead.consent?.optIn);
  const visibleAudience = useMemo(
    () => authorized.filter((lead) => stage === "ALL" || lead.stage === stage),
    [authorized, stage],
  );

  async function setConsent(lead: Audience, optIn: boolean) {
    if (optIn && !window.confirm("Registrar que este contato autorizou receber comunicações de marketing no WhatsApp?")) return;
    setBusy(true); setMessage("");
    try {
      const result = await api(`/whatsapp-campaigns/audience/${lead.id}/consent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn }),
      });
      setAudience((current) => current.map((item) => item.id === lead.id
        ? { ...item, consent: { optIn, updatedAt: result.updatedAt || new Date().toISOString(), source: "manual" } }
        : item));
      if (!optIn) setSelectedLeadIds((current) => current.filter((id) => id !== lead.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o consentimento.");
    } finally { setBusy(false); }
  }

  function toggleLead(id: string) {
    setSelectedLeadIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectVisible() {
    const ids = visibleAudience.map((lead) => lead.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedLeadIds.includes(id));
    setSelectedLeadIds((current) => allSelected
      ? current.filter((id) => !ids.includes(id))
      : Array.from(new Set([...current, ...ids])));
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate) return setMessage("Selecione um template aprovado.");
    if (!selectedLeadIds.length) return setMessage("Selecione pelo menos um contato autorizado.");

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const mediaValue = form.get("mediaFile");
    const mediaFile = mediaValue instanceof File && mediaValue.size > 0 ? mediaValue : null;
    setBusy(true); setMessage("");

    try {
      let media: any = null;
      if (mediaFile) {
        const uploadBody = new FormData();
        uploadBody.append("file", mediaFile);
        media = await api("/media/upload", { method: "POST", body: uploadBody });
      }

      const parameters = Array.from({ length: selectedTemplate.bodyParameterCount }, (_, index) =>
        String(form.get(`parameter_${index + 1}`) || "").trim(),
      );
      const scheduledRaw = String(form.get("scheduledAt") || "");
      const scheduledAt = scheduledRaw ? new Date(scheduledRaw).toISOString() : new Date(Date.now() + 5 * 60_000).toISOString();

      const created = await api("/whatsapp-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          topic: String(form.get("topic") || "").trim(),
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.language,
          scheduledAt,
          integrationId: integration?.id,
          leadIds: selectedLeadIds,
          bodyParameters: parameters,
          mediaUrl: media?.publicUrl,
          mediaKind: media?.mediaKind,
          confirmOptIn: form.get("confirmOptIn") === "on",
        }),
      });

      setCampaigns((current) => [{
        id: created.contentId,
        title: String(form.get("name") || "Campanha WhatsApp"),
        status: created.status,
        scheduledAt: created.scheduledAt,
        templateName: created.template,
        recipients: created.recipients,
      }, ...current]);
      setSelectedLeadIds([]);
      formElement.reset();
      setMessage(`Campanha preparada com ${created.recipients} contato(s) autorizado(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao preparar campanha.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <section className="summary-strip">
        <div><span>Templates aprovados</span><strong>{initialTemplates.length}</strong></div>
        <div><span>Contatos autorizados</span><strong>{authorized.length}</strong></div>
        <div><span>Campanhas WhatsApp</span><strong>{campaigns.length}</strong></div>
      </section>

      {!integration ? <div className="form-error">Conecte o WhatsApp Cloud API em Integrações para liberar campanhas.</div> : null}

      <section className="workspace-grid">
        <article className="panel form-panel">
          <div className="panel-title"><div><span className="eyebrow">CAMPANHA WHATSAPP</span><h3>Oferta, conteúdo ou recuperação</h3></div></div>
          <p className="feature-copy">Use um template aprovado pela Meta. Se o template tiver cabeçalho de imagem/vídeo, envie a mídia aqui.</p>
          <form className="entity-form" onSubmit={createCampaign}>
            <label>Nome da campanha<input name="name" required minLength={3} placeholder="Ex.: H4 e H7 · Outubro" /></label>
            <label>Tema / produto<input name="topic" required minLength={3} placeholder="Ex.: Lâmpadas H4 e H7" /></label>
            <label>Template aprovado
              <select value={selectedTemplateKey} onChange={(event) => setSelectedTemplateKey(event.target.value)} required>
                <option value="" disabled>Selecione</option>
                {initialTemplates.map((template) => (
                  <option key={`${template.name}-${template.language}`} value={`${template.name}::${template.language}`}>
                    {template.name} · {template.language} · {template.category}
                  </option>
                ))}
              </select>
            </label>
            {selectedTemplate ? <div className="status-message"><strong>Prévia:</strong> {selectedTemplate.bodyText || selectedTemplate.name}</div> : null}

            {selectedTemplate && Array.from({ length: selectedTemplate.bodyParameterCount }, (_, index) => (
              <label key={index}>Parâmetro {index + 1}
                <input name={`parameter_${index + 1}`} required placeholder="Use texto, {nome} ou {produto}" />
              </label>
            ))}

            {selectedTemplate && ["IMAGE", "VIDEO"].includes(String(selectedTemplate.headerFormat || "")) ? (
              <label>Mídia do cabeçalho ({selectedTemplate.headerFormat})
                <input name="mediaFile" type="file" required accept={selectedTemplate.headerFormat === "VIDEO" ? "video/mp4,.mp4" : "image/jpeg,.jpg,.jpeg"} />
              </label>
            ) : null}

            <label>Agendar para<input name="scheduledAt" type="datetime-local" required /></label>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input name="confirmOptIn" type="checkbox" required style={{ width: "auto" }} />
              Confirmo que os contatos selecionados autorizaram comunicações de marketing.
            </label>
            <button className="primary-button" disabled={busy || !integration}>{busy ? "Preparando..." : "Preparar campanha WhatsApp"}</button>
          </form>
          {message ? <div className="status-message">{message}</div> : null}
        </article>

        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">PÚBLICO</span><h3>Contatos com consentimento</h3></div><span className="status-muted">{selectedLeadIds.length} selecionado(s)</span></div>
          <label>Filtrar por estágio
            <select value={stage} onChange={(event) => setStage(event.target.value)}>
              <option value="ALL">Todos</option><option value="NEW">Novos</option><option value="CONTACTED">Contatados</option><option value="QUALIFIED">Qualificados</option><option value="WON">Clientes</option><option value="LOST">Perdidos</option>
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={selectVisible} disabled={!visibleAudience.length}>Selecionar/desmarcar autorizados visíveis</button>
          <div className="entity-list" style={{ maxHeight: 420, overflowY: "auto" }}>
            {audience.map((lead) => (
              <div className="entity-row" key={lead.id}>
                <div className="entity-main">
                  <div className="entity-title"><strong>{lead.name || lead.phone}</strong><span className={`status-badge ${lead.consent?.optIn ? "connected" : "pending"}`}>{lead.consent?.optIn ? "OPT-IN" : "SEM OPT-IN"}</span></div>
                  <small>{lead.stage} · {lead.source}{lead.campaignTag ? ` · ${lead.campaignTag}` : ""}</small>
                </div>
                <div className="row-actions">
                  {lead.consent?.optIn ? <>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" style={{ width: "auto" }} checked={selectedLeadIds.includes(lead.id)} onChange={() => toggleLead(lead.id)} /> usar</label>
                    <button type="button" className="danger-button" onClick={() => setConsent(lead, false)} disabled={busy}>Revogar</button>
                  </> : <button type="button" className="ghost-button" onClick={() => setConsent(lead, true)} disabled={busy}>Registrar opt-in</button>}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-title"><div><span className="eyebrow">HISTÓRICO</span><h3>Campanhas preparadas</h3></div></div>
        <div className="entity-list">
          {campaigns.length ? campaigns.map((campaign) => (
            <div className="entity-row" key={campaign.id}>
              <div className="entity-main"><div className="entity-title"><strong>{campaign.title}</strong><span className={`status-badge ${String(campaign.status || "").toLowerCase()}`}>{campaign.status}</span></div><small>{campaign.templateName || "Template"} · {campaign.recipients} contato(s)</small><small>{campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString("pt-BR") : "Sem horário"}</small></div>
            </div>
          )) : <div className="empty-state"><strong>Nenhuma campanha WhatsApp</strong><p>Registre consentimentos e prepare a primeira campanha.</p></div>}
        </div>
      </section>
    </>
  );
}
