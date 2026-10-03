"use client";

import { FormEvent, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Operação não concluída.");
  return data;
}

export function ChannelsManager({ integrations }: { integrations: any[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const hasTiktok = integrations.some((item) => item.provider === "TIKTOK" && item.status === "CONNECTED");
  const hasTelegram = integrations.some((item) => item.provider === "TELEGRAM" && item.status === "CONNECTED");

  async function connectTiktok() {
    setBusy(true); setMessage("");
    try {
      const result = await api("/channels/tiktok/oauth-url", { method: "POST" });
      window.location.href = result.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao iniciar TikTok."); setBusy(false);
    }
  }

  async function syncTiktok() {
    setBusy(true); setMessage("");
    try {
      const result = await api("/channels/tiktok/sync", { method: "POST" });
      setMessage(`TikTok sincronizado: ${result.results?.filter((item: any) => item.ok).length || 0} conta(s).`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao sincronizar TikTok."); }
    finally { setBusy(false); }
  }

  async function connectTelegram() {
    setBusy(true); setMessage("");
    try {
      const result = await api("/channels/telegram/connect", { method: "POST" });
      setMessage(result.webhookConfigured ? "Telegram conectado e webhook configurado." : "Telegram conectado; falta URL pública HTTPS/secret para o webhook.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao conectar Telegram."); }
    finally { setBusy(false); }
  }

  return (
    <section className="workspace-grid">
      <article className="panel form-panel">
        <span className="eyebrow">FASE 11 · TIKTOK</span>
        <h3>Login Kit + Display API</h3>
        <p className="feature-copy">A conexão usa OAuth oficial. Para Web, o redirect URI cadastrado no TikTok precisa ser HTTPS. Métricas lidas: seguidores, quantidade de vídeos, views e interações dos vídeos recentes.</p>
        <div className="stack-actions">
          <button className="primary-button" onClick={connectTiktok} disabled={busy}>{hasTiktok ? "Reconectar TikTok" : "Conectar TikTok"}</button>
          <button className="ghost-button" onClick={syncTiktok} disabled={busy || !hasTiktok}>Sincronizar agora</button>
        </div>
      </article>
      <article className="panel form-panel">
        <span className="eyebrow">FASE 12 · TELEGRAM</span>
        <h3>Bot API oficial</h3>
        <p className="feature-copy">O bot é validado por getMe. Quando há uma URL pública HTTPS, o sistema registra setWebhook com secret token e novos contatos entram no CRM.</p>
        <button className="primary-button" onClick={connectTelegram} disabled={busy}>{hasTelegram ? "Revalidar Telegram" : "Conectar Telegram"}</button>
        {message ? <div className="status-message">{message}</div> : null}
      </article>
    </section>
  );
}

export function WorkspaceManager({ initial }: { initial: any[] }) {
  const [items, setItems] = useState(initial || []);
  const [message, setMessage] = useState("");

  async function refresh() { setItems(await api("/workspace/companies")); }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setMessage("");
    try {
      await api("/workspace/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name") }) });
      await refresh(); event.currentTarget.reset(); setMessage("Workspace criado. Agora você pode alternar entre empresas.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao criar workspace."); }
  }

  async function switchTo(companyId: string) {
    setMessage("");
    try {
      await api("/workspace/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
      window.location.href = "/dashboard";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao trocar workspace."); }
  }

  return (
    <section className="workspace-grid">
      <article className="panel form-panel">
        <span className="eyebrow">NOVA EMPRESA</span><h3>Workspace isolado</h3>
        <form className="entity-form" onSubmit={create}><label>Nome da empresa<input name="name" minLength={2} required placeholder="Ex.: Cliente Oficina X" /></label><button className="primary-button">Criar workspace</button></form>
        {message ? <div className="status-message">{message}</div> : null}
      </article>
      <article className="panel list-panel">
        <div className="panel-title"><div><span className="eyebrow">FASE 13 · MULTIEMPRESA</span><h3>Seus workspaces</h3></div></div>
        <div className="entity-list">{items.map((item) => <div className="entity-row" key={item.id}><div className="entity-main"><div className="entity-title"><strong>{item.name}</strong>{item.active ? <span className="status-badge active">ATUAL</span> : null}</div><small>{item.slug} · {item.role}</small></div><button className="ghost-button" disabled={item.active} onClick={() => switchTo(item.id)}>{item.active ? "Em uso" : "Trocar"}</button></div>)}</div>
      </article>
    </section>
  );
}
