import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { ContentManager } from "../_components/growth-clients";
import { getProtectedMany } from "../_lib/server-data";

export default async function ContentPage() {
  const { me, data } = await getProtectedMany(["/content", "/campaigns"]);
  if (!me) redirect("/login");
  const [content, campaigns] = data as [any[] | null, any[] | null];
  return (
    <AppFrame me={me} active="Conteúdo" eyebrow="CONTENT ENGINE" title="Conteúdo">
      <div className="page-intro"><div><h2>Plano orgânico executável</h2><p>Transforme a quantidade de Reels, posts e stories da campanha em uma fila real de produção.</p></div></div>
      <ContentManager initial={content || []} campaigns={campaigns || []} />
    </AppFrame>
  );
}
