"use client";

import { FormEvent, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Operação não concluída.");
  return data;
}

export function IntegrationsManager({ initial, readiness }: { initial: any[]; readiness: any }) {
  const [items, setItems] = useState(initial || []);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function connectMeta() {
    setBusy(true); setMessage("");
    try {
      const result = await api("/integrations/meta/oauth-url", { method: "POST" });
      window.location.href = result.url;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao iniciar conexão."); setBusy(false); }
  }

  async function connectWhatsapp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/integrations/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId: String(form.get("phoneNumberId") || ""),
          wabaId: String(form.get("wabaId") || ""),
          accessToken: String(form.get("accessToken") || ""),
          displayName: String(form.get("displayName") || "") || undefined,
        }),
      });
      const updated = await api("/integrations");
      setItems(updated); setMessage("WhatsApp conectado com sucesso."); formElement.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao conectar WhatsApp."); }
    finally { setBusy(false); }
  }

  async function syncMeta() {
    setBusy(true); setMessage("");
    try { const result = await api("/integrations/meta/sync", { method: "POST" }); setMessage(`Sincronização concluída: ${result.results?.length || 0} conta(s).`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha na sincronização."); }
    finally { setBusy(false); }
  }

  async function disconnect(id: string) {
    if (!window.confirm("Desconectar esta integração?")) return;
    await api(`/integrations/${id}`, { method: "DELETE" });
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      <section className="summary-strip">
        <div><span>Conectadas</span><strong>{items.filter((item) => item.status === "CONNECTED").length}</strong></div>
        <div><span>Meta pronta</span><strong>{readiness?.meta?.ready ? "SIM" : "NÃO"}</strong></div>
        <div><span>WhatsApp pronto</span><strong>{readiness?.whatsapp?.ready ? "SIM" : "NÃO"}</strong></div>
      </section>
      <section className="workspace-grid">
        <article className="panel form-panel">
          <div className="panel-title"><div><span className="eyebrow">META / INSTAGRAM</span><h3>Dados orgânicos oficiais</h3></div></div>
          <p className="feature-copy">Conecta uma conta profissional pela autorização oficial da Meta. O token fica criptografado no backend.</p>
          <div className="stack-actions">
            <button className="primary-button" onClick={connectMeta} disabled={busy || !readiness?.meta?.ready}>Conectar Meta / Instagram</button>
            <button className="ghost-button" onClick={syncMeta} disabled={busy || !items.some((item) => item.provider === "META_INSTAGRAM" && item.status === "CONNECTED")}>Sincronizar métricas agora</button>
          </div>
          {!readiness?.meta?.ready ? <div className="form-error">Faltam variáveis da Meta no arquivo local .env. Nenhuma credencial precisa ser enviada pelo chat.</div> : null}

          <div className="divider" />
          <div className="panel-title"><div><span className="eyebrow">WHATSAPP CLOUD API</span><h3>Leads e conversas reais</h3></div></div>
          <form className="entity-form" onSubmit={connectWhatsapp}>
            <label>Nome opcional<input name="displayName" placeholder="Tem Na Loja" /></label>
            <label>Phone Number ID<input name="phoneNumberId" required /></label>
            <label>WABA ID<input name="wabaId" required /></label>
            <label>Token da Cloud API<input name="accessToken" type="password" minLength={20} required autoComplete="off" /><small>Digite apenas aqui no seu navegador; o sistema envia direto ao backend local e armazena criptografado.</small></label>
            <button className="primary-button" disabled={busy}>Conectar WhatsApp</button>
          </form>
          {message ? <div className="status-message">{message}</div> : null}
        </article>
        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">CONTAS</span><h3>Fontes de dados</h3></div><span className="status-muted">Graph API {readiness?.meta?.graphVersion || "—"}</span></div>
          <div className="entity-list">
            {items.length ? items.map((item) => (
              <div className="entity-row" key={item.id}>
                <div className="entity-main"><div className="entity-title"><strong>{item.displayName || item.provider}</strong><span className={`status-badge ${item.status?.toLowerCase()}`}>{item.status}</span></div><small>{item.provider}{item.username ? ` · @${item.username}` : ""}</small><small>Última sincronização: {item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString("pt-BR") : "ainda não sincronizada"}</small></div>
                <button className="danger-button" onClick={() => disconnect(item.id)}>Desconectar</button>
              </div>
            )) : <div className="empty-state"><strong>Nenhuma fonte conectada</strong><p>O GerenteMarketing continuará sem inventar métricas enquanto não houver uma fonte real.</p></div>}
          </div>
        </article>
      </section>
    </>
  );
}

export function ContentManager({ initial, campaigns }: { initial: any[]; campaigns: any[] }) {
  const [items, setItems] = useState(initial || []); const [message, setMessage] = useState("");
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setMessage("");
    try { const result = await api("/content/generate-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: form.get("campaignId") }) }); const updated = await api("/content"); setItems(updated); setMessage(`${result.created} novo(s) item(ns) criado(s).`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao gerar plano."); }
  }
  async function setStatus(id: string, status: string) { const updated = await api(`/content/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); setItems((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item)); }
  return <>
    <section className="summary-strip"><div><span>Total</span><strong>{items.length}</strong></div><div><span>Prontos</span><strong>{items.filter((i) => i.status === "READY").length}</strong></div><div><span>Publicados</span><strong>{items.filter((i) => i.status === "PUBLISHED").length}</strong></div></section>
    <section className="workspace-grid"><article className="panel form-panel"><span className="eyebrow">PLANO DE CONTEÚDO</span><h3>Transforme a campanha em tarefas</h3><p className="feature-copy">Gera automaticamente os Reels, posts e stories que você definiu na campanha. A publicação externa só acontece depois de conexão e autorização.</p><form className="entity-form" onSubmit={generate}><label>Campanha<select name="campaignId" required defaultValue=""><option value="" disabled>Selecione</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="primary-button">Gerar plano restante</button></form>{message ? <div className="status-message">{message}</div> : null}</article>
    <article className="panel list-panel"><div className="panel-title"><div><span className="eyebrow">CALENDÁRIO</span><h3>Fila de produção</h3></div></div><div className="entity-list">{items.length ? items.map((item) => <div className="entity-row" key={item.id}><div className="entity-main"><div className="entity-title"><strong>{item.title}</strong><span className={`status-badge ${item.status.toLowerCase()}`}>{item.status}</span></div><small>{item.type} · {item.channel}{item.campaign ? ` · ${item.campaign.name}` : ""}</small><small>{item.cta || "Sem CTA definido"}</small></div><div className="row-actions"><button className="ghost-button" onClick={() => setStatus(item.id, "READY")}>Pronto</button><button className="ghost-button" onClick={() => setStatus(item.id, "PUBLISHED")}>Marcar publicado</button></div></div>) : <div className="empty-state"><strong>Fila vazia</strong><p>Gere o plano de uma campanha para começar.</p></div>}</div></article></section>
  </>;
}

export function RadarManager({ initial }: { initial: any[] }) {
  const [items, setItems] = useState(initial || []); const [busy, setBusy] = useState(false);
  async function generate() { setBusy(true); try { setItems(await api("/recommendations/generate", { method: "POST" })); } finally { setBusy(false); } }
  async function status(id: string, next: string) { const updated = await api(`/recommendations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }); setItems((current) => current.map((item) => item.id === id ? updated : item)); }
  return <><section className="organic-banner"><div><span className="eyebrow">DECISION ENGINE</span><h3>Recomendações auditáveis, não palpites</h3><p>O motor usa dados disponíveis, metas, integrações e ritmo de produção. A IA generativa não controla orçamento sozinha.</p></div><button className="primary-button" disabled={busy} onClick={generate}>{busy ? "Analisando..." : "Analisar agora"}</button></section><section className="panel"><div className="entity-list">{items.length ? items.map((item) => <div className="recommendation-row" key={item.id}><div className="recommendation-score"><strong>{item.impactScore}</strong><span>impacto</span></div><div className="entity-main"><div className="entity-title"><strong>{item.title}</strong><span className="status-muted">{item.type}</span></div><p>{item.rationale}</p><small>Ação: {item.actionText} · confiança {Math.round(Number(item.confidence) * 100)}%</small></div><div className="row-actions">{item.status === "OPEN" ? <><button className="ghost-button" onClick={() => status(item.id, "APPLIED")}>Aplicada</button><button className="danger-button" onClick={() => status(item.id, "DISMISSED")}>Dispensar</button></> : <span className="status-muted">{item.status}</span>}</div></div>) : <div className="empty-state"><strong>Sem análise ainda</strong><p>Clique em Analisar agora para executar o motor.</p></div>}</div></section></>;
}

export function ExperimentsManager({ initial, campaigns }: { initial: any[]; campaigns: any[] }) {
  const [items, setItems] = useState(initial || []); const [message, setMessage] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setMessage("");
    try {
      await api("/experiments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), hypothesis: form.get("hypothesis"), metric: form.get("metric"), campaignId: form.get("campaignId") || undefined, variants: [String(form.get("variantA") || "A"), String(form.get("variantB") || "B")] }) });
      setItems(await api("/experiments"));
      formElement.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha."); }
  }
  async function setExperiment(id: string, status: string) { await api(`/experiments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); setItems(await api("/experiments")); }
  async function updateVariant(expId: string, variant: any) { const sample = window.prompt(`Tamanho da amostra para ${variant.label}:`, String(variant.sampleSize)); if (sample === null) return; const value = window.prompt(`Valor da métrica para ${variant.label}:`, String(variant.metricValue)); if (value === null) return; await api(`/experiments/${expId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: variant.id, sampleSize: Number(sample), metricValue: Number(value) }) }); setItems(await api("/experiments")); }
  return <section className="workspace-grid"><article className="panel form-panel"><span className="eyebrow">NOVO TESTE A/B</span><h3>Teste antes de concluir</h3><form className="entity-form" onSubmit={create}><label>Nome<input name="name" required minLength={3} /></label><label>Hipótese<textarea name="hypothesis" required minLength={5} /></label><label>Métrica<select name="metric" defaultValue="WHATSAPP_CONVERSATIONS"><option value="WHATSAPP_CONVERSATIONS">Conversas no WhatsApp</option><option value="VIEWS">Visualizações</option><option value="REACH">Alcance</option><option value="ENGAGEMENTS">Interações</option></select></label><label>Campanha<select name="campaignId" defaultValue=""><option value="">Sem vínculo</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="form-row"><label>Variante A<input name="variantA" required placeholder="CTA: chama no WhatsApp" /></label><label>Variante B<input name="variantB" required placeholder="CTA: peça seu orçamento" /></label></div><button className="primary-button">Criar experimento</button></form>{message ? <div className="form-error">{message}</div> : null}</article><article className="panel"><div className="entity-list">{items.map((item) => <div className="goal-row" key={item.id}><div className="goal-row-head"><div><strong>{item.name}</strong><small>{item.metric} · {item.hypothesis}</small></div><span className="status-badge">{item.status}</span></div><div className="variant-grid">{item.variants.map((v: any) => <button className={`variant-card ${item.winnerKey === v.key ? "winner" : ""}`} key={v.id} onClick={() => updateVariant(item.id, v)}><strong>{v.key} · {v.label}</strong><span>Amostra {v.sampleSize} · valor {v.metricValue}</span></button>)}</div><div className="row-actions"><button className="ghost-button" onClick={() => setExperiment(item.id, "RUNNING")}>Iniciar</button><button className="primary-button" onClick={() => setExperiment(item.id, "COMPLETED")}>Concluir e escolher vencedor</button></div></div>)}</div></article></section>;
}

export function AutopilotManager({ initial }: { initial: any }) {
  const [policy, setPolicy] = useState(initial); const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const updated = await api("/autopilot", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: form.get("mode"), enabled: form.get("enabled") === "on", killSwitch: form.get("killSwitch") === "on", allowPublishing: form.get("allowPublishing") === "on", allowReplies: form.get("allowReplies") === "on", maxActionsPerDay: Number(form.get("maxActionsPerDay") || 3) }) }); setPolicy(updated); setMessage("Política salva."); }
  async function run() { const result = await api("/autopilot/run", { method: "POST" }); setMessage(result.executed ? `${result.actions.length} ação(ões) de recomendação executada(s).` : `Bloqueado: ${result.reason}`); }
  return <section className="workspace-grid"><article className="panel form-panel"><span className="eyebrow">POLÍTICA</span><h3>Automação com freios</h3><form className="entity-form" onSubmit={save}><label>Modo<select name="mode" defaultValue={policy.mode}><option value="SAFE">SAFE</option><option value="MANAGED">MANAGED</option><option value="AUTOPILOT">AUTOPILOT</option><option value="AGGRESSIVE">AGGRESSIVE</option></select></label><label className="check-row"><input name="enabled" type="checkbox" defaultChecked={policy.enabled} /> Habilitar motor</label><label className="check-row"><input name="killSwitch" type="checkbox" defaultChecked={policy.killSwitch} /> Kill switch ligado</label><label className="check-row"><input name="allowPublishing" type="checkbox" defaultChecked={policy.allowPublishing} /> Permitir publicação orgânica quando houver integração</label><label className="check-row"><input name="allowReplies" type="checkbox" defaultChecked={policy.allowReplies} /> Permitir respostas quando houver regras aprovadas</label><label>Máximo de ações por dia<input name="maxActionsPerDay" type="number" min="1" max="50" defaultValue={policy.maxActionsPerDay} /></label><button className="primary-button">Salvar política</button></form></article><article className="panel"><span className="eyebrow">SEGURANÇA</span><h3>Orçamento bloqueado por padrão</h3><p className="feature-copy">Nesta implementação, nenhuma política pode alterar orçamento. O Autopilot trabalha primeiro com recomendações, conteúdo e rotinas orgânicas auditáveis.</p><div className="policy-status"><span>Modo</span><strong>{policy.mode}</strong><span>Motor</span><strong>{policy.enabled ? "ON" : "OFF"}</strong><span>Kill switch</span><strong>{policy.killSwitch ? "ATIVO" : "LIBERADO"}</strong></div><button className="primary-button" onClick={run}>Executar ciclo agora</button>{message ? <div className="status-message">{message}</div> : null}</article></section>;
}

export function LeadsManager({ initial, summary }: { initial: any[]; summary: any }) {
  const [items, setItems] = useState(initial || []); const [stats, setStats] = useState(summary || {}); const [message, setMessage] = useState("");
  async function refresh() { setItems(await api("/leads")); setStats(await api("/leads/summary")); }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setMessage("");
    try {
      await api("/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name") || undefined, phone: form.get("phone") || undefined, source: form.get("source"), notes: form.get("notes") || undefined }) });
      await refresh();
      formElement.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha."); }
  }
  async function stage(id: string, next: string) { await api(`/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: next }) }); await refresh(); }
  return <><section className="summary-strip"><div><span>Leads</span><strong>{stats.total || 0}</strong></div><div><span>Qualificados</span><strong>{stats.byStage?.QUALIFIED || 0}</strong></div><div><span>Ganhos</span><strong>{stats.byStage?.WON || 0}</strong></div></section><section className="workspace-grid"><article className="panel form-panel"><span className="eyebrow">CRM</span><h3>Novo contato manual</h3><form className="entity-form" onSubmit={create}><label>Nome<input name="name" /></label><label>Telefone<input name="phone" /></label><label>Origem<select name="source" defaultValue="ORGANIC"><option value="WHATSAPP">WhatsApp</option><option value="INSTAGRAM">Instagram</option><option value="ORGANIC">Orgânico</option><option value="FACEBOOK">Facebook</option><option value="TIKTOK">TikTok</option><option value="TELEGRAM">Telegram</option><option value="OTHER">Outro</option></select></label><label>Notas<textarea name="notes" /></label><button className="primary-button">Adicionar lead</button></form>{message ? <div className="form-error">{message}</div> : null}</article><article className="panel"><div className="entity-list">{items.length ? items.map((lead) => <div className="entity-row" key={lead.id}><div className="entity-main"><div className="entity-title"><strong>{lead.name || lead.phone || "Contato"}</strong><span className="status-badge">{lead.stage}</span></div><small>{lead.source} · {lead.phone || "sem telefone"} · {lead._count?.conversations || 0} conversa(s)</small></div><div className="row-actions"><button className="ghost-button" onClick={() => stage(lead.id, "CONTACTED")}>Contatado</button><button className="ghost-button" onClick={() => stage(lead.id, "QUALIFIED")}>Qualificar</button><button className="primary-button" onClick={() => stage(lead.id, "WON")}>Ganho</button></div></div>) : <div className="empty-state"><strong>Nenhum lead</strong><p>Quando o webhook do WhatsApp estiver conectado, novos contatos poderão entrar automaticamente.</p></div>}</div></article></section></>;
}