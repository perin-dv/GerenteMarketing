import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { getProtectedJson } from "../_lib/server-data";
import { PerformanceManager } from "./performance-manager";

export default async function PerformancePage() {
  const { me, data } = await getProtectedJson<any>("/performance");
  if (!me) redirect("/login");

  return (
    <AppFrame me={me} active="Performance" eyebrow="LEARNING ENGINE" title="Performance">
      <div className="page-intro">
        <div>
          <h2>O GerenteMarketing começa a aprender com o que realmente performou</h2>
          <p>Leia os resultados dos conteúdos publicados, compare formatos e descubra quais hashtags trouxeram mais alcance e engajamento na própria conta.</p>
        </div>
      </div>
      <PerformanceManager initial={data || {}} />
    </AppFrame>
  );
}
