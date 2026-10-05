"use client";

import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Operação não concluída.");
  return data;
}

function number(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

export function PerformanceManager({ initial }: { initial: any }) {
  const [data, setData] = useState(initial || {});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/performance/sync", { method: "POST" });
      const updated = await api("/performance");
      setData(updated);
      setMessage(`Leitura concluída: ${result.updated || 0} conteúdo(s) atualizado(s)${result.failed ? ` · ${result.failed} sem dados completos` : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao ler desempenho do Instagram.");
    } finally {
      setBusy(false);
    }
  }

  const topContent = data?.topContent || [];
  const hashtags = data?.hashtags || [];

  return (
    <>
      <section className="summary-strip">
        <div><span>Conteúdos lidos</span><strong>{number(data?.syncedContent)}</strong></div>
        <div><span>Alcance somado</span><strong>{number(data?.totals?.reach)}</strong></div>
        <div><span>Views somadas</span><strong>{number(data?.totals?.views)}</strong></div>
        <div><span>Engajamentos</span><strong>{number(data?.totals?.engagements)}</strong></div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">
          <div>
            <span className="eyebrow">APRENDIZADO REAL</span>
            <h3>Atualizar desempenho do Instagram</h3>
          </div>
          <button className="primary-button" onClick={sync} disabled={busy}>
            {busy ? "Lendo a Meta..." : "Ler desempenho agora"}
          </button>
        </div>
        <p className="feature-copy">O sistema consulta os conteúdos publicados pela conta conectada, compara alcance, views, curtidas e comentários e usa esses dados para descobrir o que funcionou melhor. Não inventa tendência.</p>
        {message ? <div className="status-message">{message}</div> : null}
      </section>

      <section className="workspace-grid">
        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">CONTEÚDO</span><h3>Melhores peças</h3></div></div>
          <div className="entity-list">
            {topContent.length ? topContent.map((item: any, index: number) => (
              <div className="entity-row" key={item.contentId}>
                <div className="entity-main">
                  <div className="entity-title"><strong>#{index + 1} · {item.title}</strong><span className="status-badge published">{item.type}</span></div>
                  <small>{number(item.reach)} alcance · {number(item.views)} views · {number(item.engagements)} engajamentos</small>
                  <small>{item.engagementRate === null ? "Taxa sem alcance disponível" : `${item.engagementRate}% de engajamento por alcance`}</small>
                </div>
                {item.permalink ? <a className="ghost-button" href={item.permalink} target="_blank" rel="noreferrer">Abrir</a> : null}
              </div>
            )) : <div className="empty-state"><strong>Ainda sem leitura por conteúdo</strong><p>Publique algumas peças e clique em “Ler desempenho agora”.</p></div>}
          </div>
        </article>

        <article className="panel list-panel">
          <div className="panel-title"><div><span className="eyebrow">HASHTAGS</span><h3>O que funcionou na sua conta</h3></div></div>
          <div className="entity-list">
            {hashtags.length ? hashtags.map((item: any, index: number) => (
              <div className="entity-row" key={String(item.hashtag).toLowerCase()}>
                <div className="entity-main">
                  <div className="entity-title"><strong>#{index + 1} · {item.hashtag}</strong><span className="status-badge ready">{item.posts} post(s)</span></div>
                  <small>{number(item.engagements)} engajamentos · {number(item.reach)} alcance · {number(item.views)} views</small>
                  <small>{item.engagementRate === null ? "Sem taxa calculável" : `${item.engagementRate}% de engajamento por alcance`}</small>
                </div>
              </div>
            )) : <div className="empty-state"><strong>Ainda não há hashtags medidas</strong><p>As hashtags dos próximos posts serão comparadas com o desempenho real depois da sincronização.</p></div>}
          </div>
          <p className="feature-copy" style={{ marginTop: 14 }}>{data?.note || ""}</p>
        </article>
      </section>
    </>
  );
}
