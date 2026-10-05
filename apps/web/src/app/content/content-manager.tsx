"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./content-manager.module.css";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type FilterKey = "ALL" | "REEL" | "POST" | "STORY" | "PUBLISHED";

const HASHTAG_STOPWORDS = new Set([
  "para", "com", "sem", "uma", "uns", "umas", "que", "por", "seu", "sua", "seus", "suas",
  "voce", "voces", "isso", "essa", "esse", "esta", "este", "como", "mais", "muito", "muita",
  "reel", "reels", "post", "story", "stories", "campanha", "conteudo", "crescimento", "organico",
  "chame", "fale", "gente", "duvida", "pedir", "orcamento", "agora", "melhor", "dica", "rapida",
]);

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Operação não concluída.");
  return data;
}

function hashtagToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();
}

function autoHashtags(item: any) {
  const text = [
    item?.title,
    item?.hook,
    item?.script,
    item?.caption,
    item?.cta,
    item?.campaign?.name,
  ].filter(Boolean).join(" ");
  const lower = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tags: string[] = [];

  const add = (...values: string[]) => {
    for (const value of values) {
      const clean = hashtagToken(value);
      if (clean.length < 2) continue;
      const key = clean.toLowerCase();
      if (!tags.some((tag) => tag.toLowerCase() === key)) tags.push(clean);
    }
  };

  if (/tem\s*na\s*loja/.test(lower)) {
    add("TemNaLoja", "Autopecas", "PecasAutomotivas", "Carros", "DicasAutomotivas", "Maringa", "Parana");
  }

  if (/(autopec|automot|carro|veiculo|peca|motor|oficina)/.test(lower)) {
    add("Autopecas", "PecasAutomotivas", "DicasAutomotivas", "ManutencaoAutomotiva");
  }
  if (/(lampad|farol|iluminacao|\bh4\b|\bh7\b)/.test(lower)) {
    add("LampadasAutomotivas", "IluminacaoAutomotiva", "Farol");
  }
  if (/\bh4\b/.test(lower)) add("H4", "LampadaH4");
  if (/\bh7\b/.test(lower)) add("H7", "LampadaH7");
  if (/(bosch|ngk|osram|philips)/.test(lower)) {
    for (const brand of ["Bosch", "NGK", "Osram", "Philips"]) {
      if (lower.includes(brand.toLowerCase())) add(brand);
    }
  }

  const keywordSource = [item?.caption, item?.hook, item?.script].filter(Boolean).join(" ");
  const words = keywordSource
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[A-Za-z0-9]{3,}/g) || [];

  for (const word of words) {
    const clean = hashtagToken(word);
    const lowerWord = clean.toLowerCase();
    if (clean.length < 4 || HASHTAG_STOPWORDS.has(lowerWord)) continue;
    add(clean.charAt(0).toUpperCase() + clean.slice(1));
    if (tags.length >= 10) break;
  }

  return tags.slice(0, 10).map((tag) => `#${tag}`);
}

function autoCaption(item: any) {
  const current = String(item?.caption || "").trim();
  const cta = String(item?.cta || "").trim();
  let base = current;

  if (!base) {
    const rawHook = String(item?.hook || "").trim();
    const looksLikeInstruction = /^(comece|use|faça|mostre|explique|crie|apresente)\b/i.test(rawHook);
    const hook = rawHook && !looksLikeInstruction ? rawHook : "";
    const type = String(item?.type || "");
    const opening = hook || (
      type === "REEL"
        ? "Dica rápida para ajudar você a escolher melhor e evitar dor de cabeça."
        : type === "STORY"
          ? "Uma dica rápida que pode facilitar sua escolha."
          : "Informação prática para ajudar você a decidir com mais segurança."
    );
    const action = cta || "Fale com a gente para tirar sua dúvida ou pedir um orçamento.";
    base = `${opening}\n\n${action}`;
  } else if (cta && !base.includes(cta)) {
    base = `${base}\n\n${cta}`;
  }

  const existing = new Set((base.match(/#[A-Za-z0-9_]+/g) || []).map((tag) => tag.toLowerCase()));
  const hashtags = autoHashtags(item).filter((tag) => !existing.has(tag.toLowerCase()));
  return hashtags.length ? `${base}\n\n${hashtags.join(" ")}` : base;
}

function statusDotClass(status: string) {
  if (status === "READY") return `${styles.statusDot} ${styles.statusDotReady}`;
  if (status === "PUBLISHED") return `${styles.statusDot} ${styles.statusDotPublished}`;
  if (status === "FAILED") return `${styles.statusDot} ${styles.statusDotFailed}`;
  return styles.statusDot;
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
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [selectedId, setSelectedId] = useState<string>(() => {
    const firstPending = (initial || []).find((item: any) => item.status !== "PUBLISHED");
    return firstPending?.id || initial?.[0]?.id || "";
  });

  const metaAccounts = useMemo(
    () => (integrations || []).filter((item) => item.provider === "META_INSTAGRAM" && item.status === "CONNECTED"),
    [integrations],
  );

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return items;
    if (filter === "PUBLISHED") return items.filter((item) => item.status === "PUBLISHED");
    return items.filter((item) => item.type === filter);
  }, [filter, items]);

  const selected = items.find((item) => item.id === selectedId) || visibleItems[0] || items[0];
  const generatedCaption = selected ? autoCaption(selected) : "";

  async function refresh() {
    const updated = await api("/content");
    setItems(updated);
    return updated as any[];
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
      const updated = await refresh();
      const firstPending = updated.find((item) => item.status !== "PUBLISHED");
      if (firstPending) setSelectedId(firstPending.id);
      setMessage(`${result.created} novo(s) item(ns) criado(s). A fila já está pronta para receber os arquivos.`);
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

  async function uploadMedia(file: File) {
    const body = new FormData();
    body.append("file", file);
    return api("/media/upload", { method: "POST", body });
  }

  async function publish(event: FormEvent<HTMLFormElement>, item: any) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const integrationId = String(form.get("integrationId") || "").trim();
    const caption = String(form.get("caption") || "").trim() || autoCaption(item);
    const mediaValue = form.get("mediaFile");
    const mediaFile = mediaValue instanceof File ? mediaValue : null;

    if (!mediaFile || mediaFile.size === 0) {
      setMessage("Selecione o arquivo que será publicado.");
      return;
    }
    if (!window.confirm(`Publicar \"${item.title}\" agora no Instagram oficial?`)) return;

    setBusyContentId(item.id);
    setMessage("Enviando mídia...");
    try {
      const uploaded = await uploadMedia(mediaFile);
      setMessage("Mídia enviada. Publicando pela Meta...");
      const result = await api(`/content/${item.id}/publish/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: uploaded.publicUrl,
          integrationId: integrationId || undefined,
          mediaKind: uploaded.mediaKind,
          caption,
          shareToFeed: true,
        }),
      });
      const updated = await refresh();
      const next = updated.find((candidate) => candidate.status !== "PUBLISHED" && candidate.id !== item.id);
      if (next) setSelectedId(next.id);
      setMessage(`Publicado no Instagram${result.account ? ` · ${result.account}` : ""}. A próxima peça da fila já foi selecionada.`);
      formElement.reset();
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

  function acceptFor(item: any) {
    if (["REEL", "VIDEO"].includes(item.type)) return "video/mp4,.mp4";
    if (["POST", "IMAGE"].includes(item.type)) return "image/jpeg,.jpg,.jpeg";
    return "image/jpeg,video/mp4,.jpg,.jpeg,.mp4";
  }

  const filters: Array<[FilterKey, string]> = [
    ["ALL", "Todos"],
    ["REEL", "Reels"],
    ["POST", "Posts"],
    ["STORY", "Stories"],
    ["PUBLISHED", "Publicados"],
  ];

  return (
    <>
      <section className="summary-strip">
        <div><span>Total</span><strong>{items.length}</strong></div>
        <div><span>Pendentes</span><strong>{items.filter((item) => item.status !== "PUBLISHED").length}</strong></div>
        <div><span>Publicados reais</span><strong>{items.filter((item) => item.status === "PUBLISHED" && item.externalId).length}</strong></div>
      </section>

      <section className={`panel ${styles.commandBar}`}>
        <div className={styles.commandCopy}>
          <span className="eyebrow">FILA DE MARKETING</span>
          <h3 style={{ margin: 0 }}>Você entra com a mídia. O sistema cuida da publicação.</h3>
          <p>Legenda, CTA e hashtags relevantes são preenchidos automaticamente. Você só edita se quiser.</p>
        </div>
        <form className={styles.commandForm} onSubmit={generate}>
          <label>
            Campanha
            <select name="campaignId" required defaultValue="">
              <option value="" disabled>Selecione</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </label>
          <button className="ghost-button">Completar plano</button>
        </form>
      </section>

      {message ? <div className="status-message" style={{ marginBottom: 14 }}>{message}</div> : null}

      <section className={styles.workbench}>
        <article className={`panel ${styles.queuePanel}`}>
          <div className="panel-title">
            <div><span className="eyebrow">CONTEÚDO</span><h3>Fila compacta</h3></div>
            <span className="status-muted">{visibleItems.length}</span>
          </div>
          <div className={styles.filters}>
            {filters.map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={`${styles.filterButton} ${filter === key ? styles.filterButtonActive : ""}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.queueList}>
            {visibleItems.length ? visibleItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`${styles.queueItem} ${selected?.id === item.id ? styles.queueItemActive : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className={styles.queueTop}>
                  <span className={styles.queueTitle}>{item.title}</span>
                  <span className={statusDotClass(item.status)} />
                </div>
                <div className={styles.queueMeta}>
                  <span>{item.type}</span>
                  <span>{item.status}</span>
                </div>
              </button>
            )) : <div className="empty-state"><strong>Nada neste filtro</strong><p>Escolha outro tipo de conteúdo.</p></div>}
          </div>
        </article>

        <article className={`panel ${styles.detailPanel}`}>
          {selected ? (
            <>
              <div className={styles.detailHead}>
                <div>
                  <span className="eyebrow">PEÇA SELECIONADA</span>
                  <h3>{selected.title}</h3>
                  <div className={styles.detailMeta}>{selected.type} · {selected.channel}{selected.campaign ? ` · ${selected.campaign.name}` : ""}</div>
                </div>
                <span className={`status-badge ${String(selected.status || "").toLowerCase()}`}>{selected.status}</span>
              </div>

              {selected.status === "PUBLISHED" ? (
                <div className="status-message">
                  Publicado pela Meta{selected.publishedAt ? ` em ${new Date(selected.publishedAt).toLocaleString("pt-BR")}` : ""}.
                  {selected.externalId ? ` ID: ${selected.externalId}` : ""}
                </div>
              ) : supportsMetaPublish(selected) && metaAccounts.length ? (
                <>
                  <div className={styles.quickHint}><strong>Fluxo rápido:</strong> escolha o arquivo → confira legenda + hashtags automáticas → publicar. Depois o sistema já pula para a próxima peça.</div>
                  <form className={styles.publishForm} onSubmit={(event) => publish(event, selected)}>
                    {metaAccounts.length === 1 ? (
                      <>
                        <input type="hidden" name="integrationId" value={metaAccounts[0].id} />
                        <div><span className={styles.accountChip}>{metaAccounts[0].username ? `@${metaAccounts[0].username}` : metaAccounts[0].displayName || "Instagram"}</span></div>
                      </>
                    ) : (
                      <label>
                        Conta do Instagram
                        <select name="integrationId" defaultValue={metaAccounts[0]?.id || ""} required>
                          {metaAccounts.map((account) => (
                            <option key={account.id} value={account.id}>{account.username ? `@${account.username}` : account.displayName || "Instagram"}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className={styles.fileBox}>
                      <strong>{["REEL", "VIDEO"].includes(selected.type) ? "Escolha o vídeo MP4" : selected.type === "STORY" ? "Escolha imagem ou vídeo" : "Escolha a imagem JPG"}</strong>
                      <input name="mediaFile" type="file" required accept={acceptFor(selected)} />
                      <small>Limite atual: 250 MB.</small>
                    </label>

                    <div className={styles.copyPreview}>
                      <strong>Legenda + hashtags que serão usadas automaticamente</strong>
                      <p>{generatedCaption}</p>
                    </div>

                    <details className={styles.advanced}>
                      <summary>Editar legenda, hashtags ou opções avançadas</summary>
                      <label>
                        Legenda completa
                        <textarea name="caption" defaultValue={generatedCaption} rows={7} />
                      </label>
                    </details>

                    <div className={styles.actions}>
                      <button type="button" className="ghost-button" onClick={() => setReady(selected.id)} disabled={busyContentId === selected.id}>Marcar pronto</button>
                      <button className={`primary-button ${styles.primaryWide}`} disabled={busyContentId === selected.id}>
                        {busyContentId === selected.id ? "Enviando e publicando..." : "Publicar agora no Instagram"}
                      </button>
                    </div>
                  </form>
                </>
              ) : supportsMetaPublish(selected) ? (
                <div className="form-error">Conecte a Meta / Instagram para liberar a publicação oficial.</div>
              ) : (
                <div className="empty-state"><strong>Formato ainda não publicável nesta etapa</strong><p>Carrossel e texto entram no próximo bloco.</p></div>
              )}
            </>
          ) : (
            <div className={styles.emptyDetail}><div><strong>Selecione uma peça</strong><p>A configuração aparece aqui sem você precisar descer a página.</p></div></div>
          )}
        </article>
      </section>
    </>
  );
}
