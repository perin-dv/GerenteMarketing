"use client";

import { FormEvent, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type PlanItem = {
  id: string;
  title: string;
  channel: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  scheduledAt: string | null;
  status: string;
};

type Plan = {
  id: string;
  name: string;
  objective: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  contentItems: PlanItem[];
};

type Prospect = {
  sourceRef: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  publicSource: string;
};

type CrmProspect = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  stage: string;
  website: string | null;
  category: string | null;
  address: string | null;
  publicSource: string | null;
  score: number;
  outreach: {
    status: string;
    offer: string | null;
    preparedAt: string | null;
    lastContactAt: string | null;
    nextFollowUpAt: string | null;
    due: boolean;
    drafts: {
      whatsapp?: string;
      emailSubject?: string;
      emailBody?: string;
      phoneOpening?: string;
      followUp?: string;
    };
  };
};

export function AcquisitionManager({
  initialPlans,
  initialCrmProspects,
}: {
  initialPlans: Plan[];
  initialCrmProspects: CrmProspect[];
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [prospectBusy, setProspectBusy] = useState(false);
  const [prospectMessage, setProspectMessage] = useState("");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [imported, setImported] = useState<Record<string, boolean>>({});
  const [crmProspects, setCrmProspects] = useState<CrmProspect[]>(initialCrmProspects);
  const [outreachOffer, setOutreachOffer] = useState("");
  const [outreachBusyId, setOutreachBusyId] = useState<string | null>(null);
  const [outreachMessage, setOutreachMessage] = useState("");

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`${apiUrl}/acquisition/plans`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer: String(form.get("offer") || "").trim(),
          audience: String(form.get("audience") || "").trim(),
          region: String(form.get("region") || "").trim() || undefined,
          objective: String(form.get("objective") || "LEADS"),
          days: Number(form.get("days") || 14),
          videosPerWeek: Number(form.get("videosPerWeek") || 3),
          includeInstagram: form.get("includeInstagram") === "on",
          includeTikTok: form.get("includeTikTok") === "on",
          cta: String(form.get("cta") || "").trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Não foi possível criar o plano de aquisição.");

      const refresh = await fetch(`${apiUrl}/acquisition/plans`, { credentials: "include" });
      if (refresh.ok) setPlans(await refresh.json());
      setMessage(data?.message || "Plano de aquisição criado.");
      formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar plano de aquisição.");
    } finally {
      setBusy(false);
    }
  }

  async function searchProspects(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get("prospectQuery") || "").trim();
    const region = String(form.get("prospectRegion") || "").trim();
    setProspectBusy(true);
    setProspectMessage("");
    setProspects([]);
    try {
      const params = new URLSearchParams({ query });
      if (region) params.set("region", region);
      const response = await fetch(`${apiUrl}/acquisition/prospects?${params.toString()}`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Não foi possível pesquisar prospects agora.");
      setProspects(Array.isArray(data?.results) ? data.results : []);
      setProspectMessage(data?.results?.length ? `${data.results.length} prospects públicos encontrados para revisão.` : "Nenhum prospect encontrado nessa busca.");
    } catch (error) {
      setProspectMessage(error instanceof Error ? error.message : "Falha ao pesquisar prospects.");
    } finally {
      setProspectBusy(false);
    }
  }

  async function refreshCrmProspects() {
    const response = await fetch(`${apiUrl}/acquisition/prospects/crm`, { credentials: "include" });
    if (response.ok) setCrmProspects(await response.json());
  }

  async function prepareOutreach(leadId: string) {
    const offer = outreachOffer.trim();
    if (offer.length < 3) {
      setOutreachMessage("Informe primeiro o produto ou serviço que você quer oferecer aos prospects.");
      return;
    }
    setOutreachBusyId(leadId);
    setOutreachMessage("");
    try {
      const response = await fetch(`${apiUrl}/acquisition/prospects/${leadId}/outreach/prepare`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Não foi possível preparar a abordagem.");
      await refreshCrmProspects();
      setOutreachMessage(data?.message || "Abordagem preparada para revisão.");
    } catch (error) {
      setOutreachMessage(error instanceof Error ? error.message : "Falha ao preparar abordagem.");
    } finally {
      setOutreachBusyId(null);
    }
  }

  async function updateOutreach(leadId: string, status: string) {
    setOutreachBusyId(leadId);
    setOutreachMessage("");
    try {
      const response = await fetch(`${apiUrl}/acquisition/prospects/${leadId}/outreach`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Não foi possível atualizar o follow-up.");
      await refreshCrmProspects();
      setOutreachMessage("Pipeline atualizado.");
    } catch (error) {
      setOutreachMessage(error instanceof Error ? error.message : "Falha ao atualizar prospect.");
    } finally {
      setOutreachBusyId(null);
    }
  }

  async function copyText(text: string | undefined, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setOutreachMessage(`${label} copiado. Revise antes de enviar.`);
    } catch {
      setOutreachMessage("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
    }
  }

  async function importProspect(prospect: Prospect) {
    setProspectMessage("");
    try {
      const response = await fetch(`${apiUrl}/acquisition/prospects/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prospect.name,
          phone: prospect.phone || undefined,
          email: prospect.email || undefined,
          website: prospect.website || undefined,
          address: prospect.address || undefined,
          sourceRef: prospect.sourceRef,
          category: prospect.category || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Não foi possível adicionar o prospect ao CRM.");
      setImported((current) => ({ ...current, [prospect.sourceRef]: true }));
      setProspectMessage(data?.duplicate ? "Esse prospect já estava no CRM." : `${prospect.name} foi adicionado ao CRM para revisão.`);
      await refreshCrmProspects();
    } catch (error) {
      setProspectMessage(error instanceof Error ? error.message : "Falha ao importar prospect.");
    }
  }

  return (
    <>
      <section className="organic-banner">
        <div>
          <span className="eyebrow">MOTOR DE AQUISIÇÃO</span>
          <h3>Comece mesmo com 0 seguidores e 0 leads</h3>
          <p>O sistema cria uma rotina de conteúdo para atrair pessoas novas e mede conversas, leads e vendas como objetivo principal.</p>
        </div>
        <strong>CLIENTE &gt; VAIDADE</strong>
      </section>

      <section className="workspace-grid">
        <article className="panel form-panel">
          <div className="panel-title">
            <div><span className="eyebrow">NOVA MISSÃO</span><h3>O que precisamos vender?</h3></div>
          </div>
          <form className="entity-form" onSubmit={createPlan}>
            <label>Oferta / produto / serviço<input name="offer" required minLength={3} placeholder="Ex.: Lâmpadas H4 e H7" /></label>
            <label>Público que queremos atrair<input name="audience" required minLength={3} placeholder="Ex.: motoristas que precisam trocar a lâmpada do farol" /></label>
            <label>Região opcional<input name="region" placeholder="Ex.: Maringá e região" /></label>
            <div className="form-row">
              <label>Objetivo<select name="objective" defaultValue="LEADS"><option value="LEADS">Gerar leads</option><option value="WHATSAPP">Conversas no WhatsApp</option><option value="SALES">Vendas</option><option value="AWARENESS">Alcance / marca</option></select></label>
              <label>Duração<select name="days" defaultValue="14"><option value="7">7 dias</option><option value="14">14 dias</option><option value="21">21 dias</option><option value="30">30 dias</option></select></label>
            </div>
            <label>Vídeos por semana<select name="videosPerWeek" defaultValue="3"><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="7">7</option></select></label>
            <label>CTA opcional<input name="cta" placeholder="Chame no WhatsApp para pedir orçamento." /></label>
            <div className="form-row">
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}><input name="includeInstagram" type="checkbox" defaultChecked style={{ width: "auto" }} />Instagram</label>
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}><input name="includeTikTok" type="checkbox" defaultChecked style={{ width: "auto" }} />TikTok</label>
            </div>
            <small>Instagram e TikTok entram no plano de aquisição. A publicação automática só acontece quando o canal tiver publicação oficial habilitada; no TikTok, por enquanto o GerenteMarketing conecta e lê métricas, mas ainda não faz autopost.</small>
            <button className="primary-button" disabled={busy}>{busy ? "Montando aquisição..." : "Criar plano para buscar clientes"}</button>
            {message ? <div className="status-message">{message}</div> : null}
          </form>
        </article>

        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">MISSÕES</span><h3>Planos de aquisição</h3></div><span className="status-muted">Sem histórico obrigatório</span></div>
          {plans.length ? (
            <div className="entity-list" style={{ maxHeight: 660, overflowY: "auto" }}>
              {plans.map((plan) => (
                <div className="entity-row" key={plan.id} style={{ alignItems: "flex-start" }}>
                  <div className="entity-main" style={{ width: "100%" }}>
                    <div className="entity-title"><strong>{plan.name}</strong><span className="status-badge active">{plan.status}</span></div>
                    <small>{plan.contentItems.length} ações de conteúdo · objetivo {plan.objective}</small>
                    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                      {plan.contentItems.slice(0, 8).map((item) => (
                        <div key={item.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 8 }}>
                          <strong style={{ display: "block", fontSize: 13 }}>{item.channel} · {item.title}</strong>
                          <small>{item.hook}</small>
                          {item.scheduledAt ? <small style={{ display: "block" }}>Planejado: {new Date(item.scheduledAt).toLocaleString("pt-BR")}</small> : null}
                        </div>
                      ))}
                      {plan.contentItems.length > 8 ? <small>+ {plan.contentItems.length - 8} ações na fila de Conteúdo.</small> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><strong>Nenhum plano ainda</strong><p>Informe o que quer vender e o GerenteMarketing monta o primeiro plano sem depender de números anteriores.</p></div>}
        </article>
      </section>

      <section className="workspace-grid" style={{ marginTop: 18 }}>
        <article className="panel form-panel">
          <div className="panel-title">
            <div><span className="eyebrow">RADAR DE PROSPECTS</span><h3>Encontrar empresas em fonte pública</h3></div>
          </div>
          <p className="feature-copy">Pesquise estabelecimentos públicos por tipo e região. O sistema só adiciona ao CRM depois da sua revisão; não dispara mensagem automática.</p>
          <form className="entity-form" onSubmit={searchProspects}>
            <label>Tipo de cliente<input name="prospectQuery" required minLength={3} placeholder="Ex.: oficinas mecânicas" /></label>
            <label>Cidade / região<input name="prospectRegion" placeholder="Ex.: Maringá, Paraná" /></label>
            <button className="primary-button" disabled={prospectBusy}>{prospectBusy ? "Pesquisando..." : "Encontrar prospects públicos"}</button>
          </form>
          {prospectMessage ? <div className="status-message" style={{ marginTop: 12 }}>{prospectMessage}</div> : null}
        </article>

        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">OPORTUNIDADES</span><h3>Prospects para revisar</h3></div><span className="status-muted">Fonte pública</span></div>
          {prospects.length ? (
            <div className="entity-list" style={{ maxHeight: 560, overflowY: "auto" }}>
              {prospects.map((prospect) => (
                <div className="entity-row" key={prospect.sourceRef} style={{ alignItems: "flex-start" }}>
                  <div className="entity-main">
                    <div className="entity-title"><strong>{prospect.name}</strong><span className="status-badge active">{prospect.category || "empresa"}</span></div>
                    <small>{prospect.address}</small>
                    {prospect.phone ? <small style={{ display: "block" }}>Telefone público: {prospect.phone}</small> : null}
                    {prospect.website ? <small style={{ display: "block" }}>Site público: {prospect.website}</small> : null}
                    <small style={{ display: "block" }}>Fonte: {prospect.publicSource}</small>
                  </div>
                  <div className="row-actions">
                    <button className="ghost-button" disabled={Boolean(imported[prospect.sourceRef])} onClick={() => importProspect(prospect)}>
                      {imported[prospect.sourceRef] ? "No CRM" : "Adicionar ao CRM"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><strong>Nenhuma busca feita</strong><p>Ex.: “oficinas mecânicas” + “Maringá, Paraná”. O resultado vem de dados públicos e precisa ser revisado antes de qualquer contato.</p></div>}
        </article>
      </section>

      <section className="workspace-grid" style={{ marginTop: 18 }}>
        <article className="panel form-panel">
          <div className="panel-title">
            <div><span className="eyebrow">ABORDAGEM ASSISTIDA</span><h3>Transformar prospect em conversa</h3></div>
          </div>
          <p className="feature-copy">
            Informe a oferta uma vez. O GerenteMarketing prepara uma abordagem personalizada e um follow-up para cada prospect do CRM.
            Nada é enviado automaticamente: você revisa antes de qualquer contato.
          </p>
          <label>Produto / serviço da abordagem
            <input
              value={outreachOffer}
              onChange={(event) => setOutreachOffer(event.target.value)}
              placeholder="Ex.: fornecimento de lâmpadas H4 e H7 para oficinas"
            />
          </label>
          <div className="status-message" style={{ marginTop: 12 }}>
            Prospects no CRM: <strong>{crmProspects.length}</strong> · follow-ups vencidos: <strong>{crmProspects.filter((item) => item.outreach.due).length}</strong>
          </div>
          {outreachMessage ? <div className="status-message" style={{ marginTop: 12 }}>{outreachMessage}</div> : null}
        </article>

        <article className="panel list-panel">
          <div className="panel-title">
            <div><span className="eyebrow">PIPELINE COMERCIAL</span><h3>Revisão e follow-up</h3></div>
            <span className="status-muted">Sem disparo automático</span>
          </div>
          {crmProspects.length ? (
            <div className="entity-list" style={{ maxHeight: 720, overflowY: "auto" }}>
              {crmProspects.map((lead) => (
                <div className="entity-row" key={lead.id} style={{ alignItems: "flex-start" }}>
                  <div className="entity-main" style={{ width: "100%" }}>
                    <div className="entity-title">
                      <strong>{lead.name || "Prospect"}</strong>
                      <span className={`status-badge ${lead.outreach.due ? "pending" : "active"}`}>
                        SCORE {lead.score}
                      </span>
                    </div>
                    <small>{lead.category || "empresa"} · {lead.stage} · {lead.outreach.status}</small>
                    {lead.phone ? <small style={{ display: "block" }}>Telefone público: {lead.phone}</small> : null}
                    {lead.email ? <small style={{ display: "block" }}>E-mail público: {lead.email}</small> : null}
                    {lead.outreach.nextFollowUpAt ? (
                      <small style={{ display: "block" }}>
                        Follow-up: {new Date(lead.outreach.nextFollowUpAt).toLocaleString("pt-BR")}
                        {lead.outreach.due ? " · VENCIDO" : ""}
                      </small>
                    ) : null}

                    {lead.outreach.drafts?.whatsapp ? (
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        <textarea readOnly value={lead.outreach.drafts.whatsapp} style={{ minHeight: 110 }} />
                        <div className="row-actions">
                          <button className="ghost-button" type="button" onClick={() => copyText(lead.outreach.drafts.whatsapp, "Mensagem")}>Copiar mensagem</button>
                          {lead.email && lead.outreach.drafts.emailBody ? (
                            <button className="ghost-button" type="button" onClick={() => copyText(`${lead.outreach.drafts.emailSubject || ""}\n\n${lead.outreach.drafts.emailBody || ""}`, "E-mail")}>Copiar e-mail</button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="row-actions" style={{ marginTop: 10 }}>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={outreachBusyId === lead.id}
                        onClick={() => prepareOutreach(lead.id)}
                      >
                        {lead.outreach.drafts?.whatsapp ? "Refazer abordagem" : "Preparar abordagem"}
                      </button>
                      {lead.outreach.drafts?.whatsapp ? (
                        <>
                          <button className="ghost-button" type="button" onClick={() => updateOutreach(lead.id, "CONTACTED")} disabled={outreachBusyId === lead.id}>Contato feito</button>
                          <button className="ghost-button" type="button" onClick={() => updateOutreach(lead.id, "REPLIED")} disabled={outreachBusyId === lead.id}>Respondeu</button>
                          <button className="ghost-button" type="button" onClick={() => updateOutreach(lead.id, "FOLLOW_UP_DUE")} disabled={outreachBusyId === lead.id}>Follow-up agora</button>
                          <button className="primary-button" type="button" onClick={() => updateOutreach(lead.id, "WON")} disabled={outreachBusyId === lead.id}>Virou cliente</button>
                          <button className="danger-button" type="button" onClick={() => updateOutreach(lead.id, "NOT_INTERESTED")} disabled={outreachBusyId === lead.id}>Sem interesse</button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>Nenhum prospect no CRM</strong>
              <p>Use o Radar de Prospects acima, revise os resultados e adicione as oportunidades que fazem sentido.</p>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
