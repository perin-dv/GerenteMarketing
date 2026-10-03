import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { WorkspaceManager } from "../_components/extended-clients";
import { getProtectedJson } from "../_lib/server-data";

export default async function WorkspacesPage() {
  const { me, data } = await getProtectedJson<any[]>("/workspace/companies");
  if (!me) redirect("/login");
  return (
    <AppFrame me={me} active="" eyebrow="SAAS MULTIEMPRESA" title="Workspaces">
      <div className="page-intro"><div><h2>Uma conta, várias empresas</h2><p>Dados, campanhas, integrações e leads continuam isolados por companyId. A troca emite uma nova sessão para o workspace selecionado.</p></div></div>
      <WorkspaceManager initial={data || []} />
    </AppFrame>
  );
}
