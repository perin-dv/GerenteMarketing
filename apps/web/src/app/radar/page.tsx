import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { RadarManager } from "../_components/growth-clients";
import { getProtectedJson } from "../_lib/server-data";

export default async function RadarPage() {
  const { me, data } = await getProtectedJson<any[]>("/recommendations");
  if (!me) redirect("/login");
  return (
    <AppFrame me={me} active="Radar IA" eyebrow="DECISION ENGINE" title="Radar IA">
      <div className="page-intro"><div><h2>Decisões com evidência</h2><p>O primeiro motor é determinístico e auditável. Ele aponta gargalos antes de qualquer automação externa.</p></div></div>
      <RadarManager initial={data || []} />
    </AppFrame>
  );
}
