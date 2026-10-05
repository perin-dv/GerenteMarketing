"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Operação não concluída.");
  return data;
}

export function AutoCampaignManager() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [progress, setProgress] = useState("");

  async function upload(file: File) {
    const body = new FormData();
    body.append("file", file);
    return api("/media/upload", { method: "POST", body });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fileValue = form.getAll("mediaFiles");
    const files = fileValue.filter((item): item is File => item instanceof File && item.size > 0);
    if (!files.length) {
      setMessage("Escolha pelo menos um vídeo MP4 ou imagem JPG.");
      return;
    }
    if (files.length > 20) {
      setMessage("Envie no máximo 20 mídias por campanha automática.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const media = [];
      for (let index = 0; index < files.length; index += 1) {
        setProgress(`Enviando mídia ${index + 1} de ${files.length}...`);
        const uploaded = await upload(files[index]!);
        media.push({
          publicUrl: uploaded.publicUrl,
          mediaKind: uploaded.mediaKind,
          fingerprint: uploaded.fingerprint,
          originalName: uploaded.originalName,
        });
      }

      setProgress("Montando campanha, agenda e legendas...");
      const result = await api("/campaign-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: String(form.get("topic") || "").trim(),
          objective: String(form.get("objective") || "LEADS"),
          days: Number(form.get("days") || 14),
          cta: String(form.get("cta") || "").trim() || undefined,
          autoPublish: form.get("autoPublish") === "on",
          media,
        }),
      });

      setMessage(
        result.autoPublish
          ? `Campanha criada com ${result.items?.length || files.length} peça(s) únicas. O GerenteMarketing agendou e vai publicar automaticamente sem repetir o mesmo arquivo.`
          : `Campanha criada com ${result.items?.length || files.length} peça(s) únicas. A agenda ficou pronta; publicação automática está desligada.`,
      );
      setProgress("");
      formElement.reset();
      setFileCount(0);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar campanha automática.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-title">
        <div>
          <span className="eyebrow">GERENTE AUTOMÁTICO</span>
          <h3>Entregue as mídias uma vez. O sistema monta e distribui a campanha.</h3>
        </div>
        <span className="live-pill">SEM REPETIR ARQUIVO</span>
      </div>
      <p className="feature-copy">
        Você informa o tema e envia vários vídeos/imagens de uma vez. O GerenteMarketing cria a campanha,
        prepara legenda + CTA + hashtags, escolhe horários com base no histórico disponível e agenda cada mídia uma única vez.
      </p>

      <form className="entity-form" onSubmit={create}>
        <div className="form-grid">
          <label>
            Tema / produto
            <input name="topic" required minLength={3} placeholder="Ex.: Lâmpadas H4 e H7" />
          </label>
          <label>
            Objetivo
            <select name="objective" defaultValue="LEADS">
              <option value="LEADS">Gerar leads</option>
              <option value="SALES">Vender</option>
              <option value="WHATSAPP">Levar para WhatsApp</option>
              <option value="ENGAGEMENT">Engajamento</option>
              <option value="AWARENESS">Alcance / marca</option>
            </select>
          </label>
          <label>
            Duração da campanha
            <select name="days" defaultValue="14">
              <option value="7">7 dias</option>
              <option value="14">14 dias</option>
              <option value="21">21 dias</option>
              <option value="30">30 dias</option>
            </select>
          </label>
          <label>
            CTA opcional
            <input name="cta" placeholder="Chame no WhatsApp para pedir orçamento." />
          </label>
        </div>

        <label>
          Vídeos e imagens da campanha
          <input
            name="mediaFiles"
            type="file"
            multiple
            required
            accept="video/mp4,image/jpeg,.mp4,.jpg,.jpeg"
            onChange={(event) => setFileCount(event.target.files?.length || 0)}
          />
          <small>
            {fileCount === 0
              ? "Escolha de 1 a 20 arquivos. MP4 vira Reel e JPG vira Post."
              : fileCount === 1
                ? "1 arquivo selecionado = 1 publicação. Ele não será repostado automaticamente."
                : `${fileCount} arquivos selecionados = até ${fileCount} publicações diferentes, sem repetir o mesmo arquivo.`}
          </small>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input name="autoPublish" type="checkbox" defaultChecked style={{ width: "auto" }} />
          Publicar automaticamente nos horários agendados pela conta oficial conectada
        </label>

        <button className="primary-button" disabled={busy}>
          {busy ? "Preparando campanha..." : "Criar campanha automática"}
        </button>
      </form>

      {progress ? <div className="status-message">{progress}</div> : null}
      {message ? <div className="status-message">{message}</div> : null}
    </section>
  );
}
