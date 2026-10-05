import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { ChannelsManager } from "../_components/extended-clients";
import { getProtectedJson } from "../_lib/server-data";

export default async function ChannelsPage() {
  const { me, data } = await getProtectedJson<any[]>("/integrations");
  if (!me) redirect("/login");
  return (
    <AppFrame me={me} active="Canais" eyebrow="NOVOS CANAIS" title="TikTok + Telegram">
      <div className="page-intro"><div><h2>Canais orgânicos adicionais</h2><p>Conectores oficiais, sem automação abusiva e sem geração artificial de engajamento.</p></div></div>
      <ChannelsManager integrations={data || []} />
    </AppFrame>
  );
}
