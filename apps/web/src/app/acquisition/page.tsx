import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { getProtectedJson } from "../_lib/server-data";
import { AcquisitionManager } from "./acquisition-manager";

type Plan = {
  id: string;
  name: string;
  objective: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  contentItems: Array<{
    id: string;
    title: string;
    channel: string;
    hook: string | null;
    script: string | null;
    caption: string | null;
    cta: string | null;
    scheduledAt: string | null;
    status: string;
  }>;
};

export default async function AcquisitionPage() {
  const { me, data } = await getProtectedJson<Plan[]>("/acquisition/plans");
  if (!me) redirect("/login");

  return (
    <AppFrame me={me} active="Aquisição" eyebrow="AQUISIÇÃO" title="Buscar clientes">
      <div className="page-intro">
        <div>
          <h2>Cliente novo é o objetivo principal</h2>
          <p>Crie uma missão de aquisição mesmo começando do zero. O GerenteMarketing monta os temas, hooks, CTA, frequência e canais para transformar conteúdo em conversa, lead e venda.</p>
        </div>
      </div>
      <AcquisitionManager initialPlans={data || []} />
    </AppFrame>
  );
}
