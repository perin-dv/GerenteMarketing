import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { IntegrationsManager } from "../_components/growth-clients";
import { getProtectedMany } from "../_lib/server-data";

export default async function IntegrationsPage() {
  const { me, data } = await getProtectedMany(["/integrations", "/integrations/readiness"]);
  if (!me) redirect("/login");
  const [integrations, readiness] = data as [any[] | null, any];
  return (
    <AppFrame me={me} active="Integrações" eyebrow="FONTES OFICIAIS" title="Integrações">
      <div className="page-intro"><div><h2>Conecte dados reais</h2><p>Meta/Instagram e WhatsApp entram primeiro. Tokens ficam no backend e não são exibidos de volta na interface.</p></div></div>
      <IntegrationsManager initial={integrations || []} readiness={readiness || {}} />
    </AppFrame>
  );
}
