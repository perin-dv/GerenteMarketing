import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { ExperimentsManager } from "../_components/growth-clients";
import { getProtectedMany } from "../_lib/server-data";

export default async function ExperimentsPage() {
  const { me, data } = await getProtectedMany(["/experiments", "/campaigns"]);
  if (!me) redirect("/login");
  const [experiments, campaigns] = data as [any[] | null, any[] | null];
  return (
    <AppFrame me={me} active="Experimentos" eyebrow="EXPERIMENT ENGINE" title="Experimentos">
      <div className="page-intro"><div><h2>Teste formatos e CTAs</h2><p>Registre hipótese, variantes, amostra e resultado. O sistema escolhe o melhor valor apenas quando você encerra o teste.</p></div></div>
      <ExperimentsManager initial={experiments || []} campaigns={campaigns || []} />
    </AppFrame>
  );
}
