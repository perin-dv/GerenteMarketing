"use client";

import { FormEvent, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Operação não concluída.");
  return data;
}

export function ContentManager({
  initial,
  campaigns,
  integrations,
}: {
  initial: any[];
  campaigns: any[];
  integrations: any[];
}) {
  const [items, setItems] = useState(initial || []);
  const [message, setMessage] = useState("");
  const [busyContentId, setBusyContentId] = useState("");

  const metaAccounts = useMemo(
    () => (integrations || []).filter((item) => item.provider === "META_INSTAGRAM" && item.status === "CONNECTED"),
    [integrations],
  );

  async function refresh() {
    const updated = await api("/content");
    setItems(updated);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    try {
      const result = await api("/content/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: form.get("campaignId") }),
      });
      await refresh();
      setMessage(`${result.created} novo(s) item(ns) criado(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao gerar plano.");
    }
  }

  async function setReady(id: string) {
    setBusyContentId(id);
    setMessage("");
    try {
      await api(`/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY" }),
      });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o conteúdo.");
    } finally {
      setBusyContentId("");
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>, item: any) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mediaUrl = String(form.get("mediaUrl") || "").trim();
    const integrationId = String(form.get("integrationId") || "").trim();
    const mediaKind = String(form.get("mediaKind") || "").trim();
    const caption = String(form.get("caption") || "").trim();

    if (!mediaUrl) return;
    if (!window.confirm(`Publicar \"${item.title}\" agora no Instagram oficial?`)) return;

    setBusyContentId(item.id);
    setMessage("");
    try {
      const result = await api(`/content/${item.id}/publish/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl,
          integrationId: integrationId || undefined,
          mediaKind: mediaKind || undefined,
          caption: caption || undefined,
          shareToFeed: true,
        }),
      });
      await refresh();
      setMessage(`Publicado de verdade no Instagram${result.account ? ` @ ${result.account}` : ""}. ID: ${result.mediaId}`);
      event.currentTarget.reset();
    } catch (error) {
      await refresh().catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "Falha na publicação oficial.");
    } finally {
      setBusyContentId("");
    }
  }

  function supportsMetaPublish(item: any) {
    return ["POST", "IMAGE", "REEL", "VIDEO", "STORY"].includes(item.type)
      && ["INSTAGRAM", "MULTICHANNEL"].includes(item.channel);
  }

  return (
    <>
      <section className="summary-strip">
        <div><span>Total</span><strong>{items.length}</strong></div>
        <div><span>Prontos</span><strong>{items.filter((item) => item.status === "READY").length}</strong></div>
        <div><span>Publicados reais</span><strong>{items.filter((item) => item.status === "PUBLISHED" && item.externalId).length}</strong></div>
      </section>

      <section className="workspace-grid">
        <article className="panel form-panel">
          <span className="eyebrow">PLANO DE CONTEÚDO</span>
          <h3>Da campanha para a execução</h3>
          <p className="feature-copy">Gere a fila da campanha e publique pela integração oficial da Meta. O sistema só marca como publicado depois que a API retorna o ID real.</p>
          <form className="entity-form" onSubmit={generate}>
            <label>
              Campanha
              <select name="campaignId" required defaultValue="">
                <option value="" disabled>Selecione</option>
                {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </label>
            <button className="primary-button">Gerar plano restante</button>
          </form>
          {metaAccounts.length ? (
            <div className="status-message">Meta conectada: {metaAccounts.map((account) => account.username ? `@${account.username}` : account.displayName).join(", ")}</div>
          ) : (
            <div className="form-error">Conecte o Instagram profissional em Integrações para publicar de verdade.</div>
          )}
          {message ? <div className="status-message">{message}</div> : null}
        </article>

        <article className="panel list-panel">
          <div className="panel-title">
            <div><span className="eyebrow">EXECUÇÃO</span><h3>Fila de publicação</h3></div>
            <span className="status-muted">Meta Graph API oficial</span>
          </div>
          <div className="entity-list">
            {items.length ? items.map((item) => {
              const publishable = supportsMetaPublish(item);
              const isBusy = busyContentId === item.id;
              return (
                <div className="entity-row" key={item.id} style={{ alignItems: "flex-start" }}>
                  <div className="entity-main" style={{ width: "100%" }}>
                    <div className="entity-title">
                      <strong>{item.title}</strong>
                      <span className={`status-badge ${String(item.status || "").toLowerCase()}`}>{item.status}</span>
                    </div>
                    <small>{item.type} · {item.channel}{item.campaign ? ` · ${item.campaign.name}` : ""}</small>
                    <small>{item.caption || item.cta || "Sem legenda/CTA definido"}</small>
                    {item.externalId ? <small>Meta media ID: {item.externalId}</small> : null}

                    {item.status !== "PUBLISHED" ? (
                      <div className="stack-actions" style={{ marginTop: 12 }}>
                        <button className="ghost-button" onClick={() => setReady(item.id)} disabled={isBusy}>Marcar pronto</button>

                        {publishable && metaAccounts.length ? (
                          <form className="entity-form" onSubmit={(event) => publish(event, item)} style={{ marginTop: 8 }}>
                            <label>
                              Conta
                              <select name="integrationId" defaultValue={metaAccounts[0]?.id || ""} required>
                                {metaAccounts.map((account) => (
                                  <option key={account.id} value={account.id}>{account.username ? `@${account.username}` : account.displayName || "Instagram"}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              URL HTTPS pública da mídia
                              <input name="mediaUrl" type="url" required placeholder={item.type === "REEL" || item.type === "VIDEO" ? "https://.../video.mp4" : "https://.../imagem.jpg"} />
                              <small>A Meta precisa conseguir baixar essa imagem ou vídeo pela internet.</small>
                            </label>
                            {item.type === "STORY" ? (
                              <label>
                                Tipo da mídia
                                <select name="mediaKind" defaultValue="IMAGE"><option value="IMAGE">Imagem</option><option value="VIDEO">Vídeo</option></select>
                              </label>
                            ) : null}
                            <label>
                              Legenda opcional
                              <textarea name="caption" placeholder={item.caption || item.cta || "Se deixar vazio, usa a legenda/CTA do plano."} />
                            </label>
                            <button className="primary-button" disabled={isBusy}>{isBusy ? "Publicando na Meta..." : "Publicar agora no Instagram"}</button>
                          </form>
                        ) : publishable ? (
                          <small>Conecte a Meta para liberar publicação oficial.</small>
                        ) : (
                          <small>Carrossel/texto entra no próximo bloco de publicação.</small>
                        )}
                      </div>
                    ) : (
                      <div className="status-message" style={{ marginTop: 10 }}>Publicado pela Meta em {item.publishedAt ? new Date(item.publishedAt).toLocaleString("pt-BR") : "data registrada"}.</div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="empty-state"><strong>Fila vazia</strong><p>Gere o plano de uma campanha para começar.</p></div>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
