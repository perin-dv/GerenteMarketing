import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { LeadsManager } from "../_components/growth-clients";
import { getProtectedMany } from "../_lib/server-data";

export default async function LeadsPage() {
  const { me, data } = await getProtectedMany(["/leads", "/leads/summary"]);
  if (!me) redirect("/login");
  const [leads, summary] = data as [any[] | null, any];
  return (
    <AppFrame me={me} active="Leads" eyebrow="CRM ORGÂNICO" title="Leads">
      <div className="page-intro"><div><h2>Da conversa até a venda</h2><p>Contatos entram manualmente agora e poderão entrar automaticamente pelo webhook oficial do WhatsApp.</p></div></div>
      <LeadsManager initial={leads || []} summary={summary || { total: 0, byStage: {}, bySource: {} }} />
    </AppFrame>
  );
}
