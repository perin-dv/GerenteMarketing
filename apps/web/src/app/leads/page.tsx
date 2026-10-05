import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { LeadsManager } from "../_components/growth-clients";
import { LeadConversationPanel } from "../_components/lead-conversation-panel";
import { getProtectedMany } from "../_lib/server-data";

export default async function LeadsPage() {
  const { me, data } = await getProtectedMany(["/leads", "/leads/summary"]);
  if (!me) redirect("/login");
  const [leads, summary] = data as [any[] | null, any];
  const safeLeads = leads || [];
  return (
    <AppFrame me={me} active="Leads" eyebrow="CRM ORGÂNICO" title="Leads">
      <div className="page-intro"><div><h2>Da conversa até a venda</h2><p>Leads do WhatsApp já entram automaticamente pelo relay oficial e agora o histórico cliente ↔ robô pode ser consultado aqui.</p></div></div>
      <LeadsManager initial={safeLeads} summary={summary || { total: 0, byStage: {}, bySource: {} }} />
      <LeadConversationPanel leads={safeLeads} />
    </AppFrame>
  );
}
