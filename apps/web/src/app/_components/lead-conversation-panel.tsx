"use client";

import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function api(path: string) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "Operação não concluída.");
  return data;
}

function displayPhone(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "Sem telefone";
  return digits.length > 4 ? `•••• ${digits.slice(-4)}` : digits;
}

const scrollAreaStyle = {
  maxHeight: "520px",
  overflowY: "auto" as const,
  overscrollBehavior: "contain" as const,
  paddingRight: "4px",
};

export function LeadConversationPanel({ leads }: { leads: any[] }) {
  const whatsappLeads = (leads || []).filter((lead) => lead.source === "WHATSAPP");
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openConversation(leadId: string) {
    setSelectedId(leadId);
    setBusy(true);
    setError("");
    try {
      const result = await api(`/leads/${leadId}/messages`);
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (err) {
      setMessages([]);
      setError(err instanceof Error ? err.message : "Não foi possível carregar a conversa.");
    } finally {
      setBusy(false);
    }
  }

  const selected = whatsappLeads.find((lead) => lead.id === selectedId);

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">WHATSAPP</span>
          <h3>Histórico cliente ↔ robô</h3>
        </div>
        <span className="status-muted">até 200 mensagens por histórico</span>
      </div>

      {!whatsappLeads.length ? (
        <div className="empty-state"><strong>Nenhum lead do WhatsApp</strong><p>As conversas aparecerão aqui assim que chegarem pelo relay oficial.</p></div>
      ) : (
        <div className="workspace-grid">
          <div className="entity-list" style={scrollAreaStyle}>
            {whatsappLeads.map((lead) => (
              <div className="entity-row" key={lead.id}>
                <div className="entity-main">
                  <strong>{lead.name || "Cliente WhatsApp"}</strong>
                  <small>{displayPhone(lead.phone)} · {lead._count?.conversations || 0} conversa(s)</small>
                </div>
                <button className="ghost-button" onClick={() => openConversation(lead.id)} disabled={busy && selectedId === lead.id}>
                  {busy && selectedId === lead.id ? "Carregando..." : "Ver conversa"}
                </button>
              </div>
            ))}
          </div>

          <div className="entity-list" style={scrollAreaStyle}>
            {selected ? <div className="panel-title"><div><strong>{selected.name || "Cliente WhatsApp"}</strong><small>{displayPhone(selected.phone)}</small></div></div> : null}
            {error ? <div className="form-error">{error}</div> : null}
            {selected && !busy && !messages.length && !error ? (
              <div className="empty-state"><strong>Sem mensagens armazenadas ainda</strong><p>O histórico completo começa a ser salvo a partir desta versão.</p></div>
            ) : null}
            {messages.map((message) => (
              <div className="entity-row" key={`${message.id}-${message.at}`}>
                <div className="entity-main">
                  <div className="entity-title">
                    <strong>{message.direction === "OUTBOUND" ? "Robô" : "Cliente"}</strong>
                    <span className="status-muted">{message.type}</span>
                  </div>
                  <p>{message.text || `[${message.type}]`}</p>
                  <small>{message.at ? new Date(message.at).toLocaleString("pt-BR") : ""}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
