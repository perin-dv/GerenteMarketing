"use client";

import { FormEvent, useMemo, useState } from "react";

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

  const visibleItems = useMemo(() => items.filter((item) => item.status !== "DISCONNECTED"), [items]);
  const connectedWhatsapp = visibleItems.find((item) => item.provider === "WHATSAPP" && item.status === "CONNECTED");

  async function connectMeta() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/integrations/meta/oauth-url", { method: "POST" });
      window.location.href = result.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao iniciar conexão.");
      setBusy(false);
    }
  }

  async function connectWhatsapp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/integrations/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId: String(form.get("whatsappPhoneNumberId") || "").replace(/\D/g, ""),
          wabaId: String(form.get("whatsappWabaId") || "").replace(/\D/g, ""),
          accessToken: String(form.get("whatsappAccessToken") || ""),
          displayName: String(form.get("displayName") || "") || undefined,
        }),
      });
      setItems(await api("/integrations"));
      setMessage("WhatsApp conectado com sucesso.");
      formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao conectar WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  async function syncMeta() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/integrations/meta/sync", { method: "POST" });
      setMessage(`Sincronização concluída: ${result.results?.length || 0} conta(s).`);
      setItems(await api("/integrations"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na sincronização.");
    } finally {
      setBusy(false);
    }
  }

  async function testWhatsapp() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/integrations/whatsapp/test", { method: "POST" });
      const last = result.lastMessageAt ? new Date(result.lastMessageAt).toLocaleString("pt-BR") : null;
      setMessage(last ? `WhatsApp operacional. Última mensagem recebida: ${last}.` : "WhatsApp conectado. Envie uma mensagem para validar a recepção em tempo real.");
      setItems(await api("/integrations"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao testar WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    if (!window.confirm("Desconectar esta integração?")) return;
    await api(`/integrations/${id}`, { method: "DELETE" });
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      <section className="summary-strip">
        <div><span>Conectadas</span><strong>{visibleItems.filter((item) => item.status === "CONNECTED").length}</strong></div>
        <div><span>Meta pronta</span><strong>{readiness?.meta?.ready ? "SIM" : "NÃO"}</strong></div>
        <div><span>WhatsApp pronto</span><strong>{readiness?.whatsapp?.ready ? "SIM" : "NÃO"}</strong></div>
      </section>

      <section className="workspace-grid">
        <article className="panel form-panel">
          <div className="panel-title"><div><span className="eyebrow">META / INSTAGRAM</span><h3>Dados orgânicos oficiais</h3></div></div>
          <p className="feature-copy">Conecta uma conta profissional pela autorização oficial da Meta. O token fica criptografado no backend.</p>
          <div className="stack-actions">
            <button className="primary-button" onClick={connectMeta} disabled={busy || !readiness?.meta?.ready}>Conectar Meta / Instagram</button>
            <button className="ghost-button" onClick={syncMeta} disabled={busy || !visibleItems.some((item) => item.provider === "META_INSTAGRAM" && item.status === "CONNECTED")}>Sincronizar métricas agora</button>
          </div>
          {!readiness?.meta?.ready ? <div className="form-error">Faltam variáveis da Meta no arquivo local .env. Nenhuma credencial precisa ser enviada pelo chat.</div> : null}

          <div className="divider" />
          <div className="panel-title"><div><span className="eyebrow">WHATSAPP CLOUD API</span><h3>Leads e conversas reais</h3></div></div>
          <form className="entity-form" onSubmit={connectWhatsapp} autoComplete="off">
            <label>Nome opcional<input name="displayName" placeholder="Tem Na Loja" autoComplete="off" /></label>
            <label>Phone Number ID<input name="whatsappPhoneNumberId" required inputMode="numeric" pattern="[0-9]+" autoComplete="off" spellCheck={false} /></label>
            <label>WABA ID<input name="whatsappWabaId" required inputMode="numeric" pattern="[0-9]+" autoComplete="off" spellCheck={false} /></label>
            <label>Token da Cloud API<input name="whatsappAccessToken" type="password" minLength={20} required autoComplete="new-password" /><small>Digite apenas aqui no seu navegador; o sistema envia direto ao backend local e armazena criptografado.</small></label>
            <div className="stack-actions">
              <button className="primary-button" disabled={busy}>Conectar WhatsApp</button>
              {connectedWhatsapp ? <button className="ghost-button" type="button" onClick={testWhatsapp} disabled={busy}>Testar WhatsApp</button> : null}
            </div>
          </form>
          {message ? <div className="status-message">{message}</div> : null}
        </article>

        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">CONTAS</span><h3>Fontes de dados</h3></div><span className="status-muted">Graph API {readiness?.meta?.graphVersion || "—"}</span></div>
          <div className="entity-list">
            {visibleItems.length ? visibleItems.map((item) => {
              const isWhatsapp = item.provider === "WHATSAPP";
              return (
                <div className="entity-row" key={item.id}>
                  <div className="entity-main">
                    <div className="entity-title"><strong>{item.displayName || item.provider}</strong><span className={`status-badge ${item.status?.toLowerCase()}`}>{item.status}</span></div>
                    <small>{item.provider}{item.username ? ` · @${item.username}` : ""}</small>
                    <small>{isWhatsapp ? "Última mensagem recebida" : "Última sincronização"}: {item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString("pt-BR") : isWhatsapp ? "aguardando primeira mensagem" : "ainda não sincronizada"}</small>
                  </div>
                  <button className="danger-button" onClick={() => disconnect(item.id)}>Desconectar</button>
                </div>
              );
            }) : <div className="empty-state"><strong>Nenhuma fonte conectada</strong><p>O GerenteMarketing continuará sem inventar métricas enquanto não houver uma fonte real.</p></div>}
          </div>
        </article>
      </section>
    </>
  );
}
