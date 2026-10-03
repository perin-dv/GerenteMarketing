import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { AutopilotManager } from "../_components/growth-clients";
import { getProtectedJson } from "../_lib/server-data";

export default async function AutopilotPage() {
  const { me, data } = await getProtectedJson<any>("/autopilot");
  if (!me) redirect("/login");
  return (
    <AppFrame me={me} active="Autopilot" eyebrow="AUTOMAÇÃO CONTROLADA" title="Autopilot">
      <div className="page-intro"><div><h2>Automação com limite e kill switch</h2><p>SAFE é o padrão. Alteração de orçamento permanece bloqueada; primeiro automatizamos análise e rotina orgânica.</p></div></div>
      <AutopilotManager initial={data || { mode: "SAFE", enabled: false, killSwitch: true, allowPublishing: false, allowReplies: false, maxActionsPerDay: 3 }} />
    </AppFrame>
  );
}
