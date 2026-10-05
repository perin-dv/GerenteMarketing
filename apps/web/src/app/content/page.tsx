import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { getProtectedMany } from "../_lib/server-data";
import { ContentManager } from "./content-manager";

export default async function ContentPage() {
  const { me, data } = await getProtectedMany(["/content", "/campaigns", "/integrations", "/performance"]);
  if (!me) redirect("/login");
  const [content, campaigns, integrations, performance] = data as [any[] | null, any[] | null, any[] | null, any | null];
  return (
    <AppFrame me={me} active="Conteúdo" eyebrow="CONTENT ENGINE" title="Conteúdo">
      <div className="page-intro">
        <div>
          <h2>Planejar, publicar e aprender</h2>
          <p>Transforme a campanha em uma fila executável, publique pela Meta e reaproveite hashtags que já provaram resultado na própria conta.</p>
        </div>
      </div>
      <ContentManager
        initial={content || []}
        campaigns={campaigns || []}
        integrations={integrations || []}
        learnedHashtags={performance?.hashtags || []}
      />
    </AppFrame>
  );
}
