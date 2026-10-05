import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { getProtectedMany } from "../_lib/server-data";
import { WhatsappCampaignManager } from "./whatsapp-campaign-manager";

export default async function WhatsappCampaignsPage() {
  const { me, data } = await getProtectedMany([
    "/whatsapp-campaigns/templates",
    "/whatsapp-campaigns/audience",
    "/whatsapp-campaigns",
  ]);
  if (!me) redirect("/login");
  const [templateData, audience, campaigns] = data as [any | null, any[] | null, any[] | null];

  return (
    <AppFrame me={me} active="WhatsApp Mkt" eyebrow="WHATSAPP GROWTH" title="Campanhas WhatsApp">
      <div className="page-intro">
        <div>
          <h2>Campanhas oficiais, segmentadas e com consentimento</h2>
          <p>
            Use templates aprovados da Meta, escolha apenas contatos autorizados e prepare campanhas com texto,
            imagem ou vídeo sem transformar o WhatsApp em disparo indiscriminado.
          </p>
        </div>
      </div>
      <WhatsappCampaignManager
        initialTemplates={templateData?.templates || []}
        integration={templateData?.integration || null}
        initialAudience={audience || []}
        initialCampaigns={campaigns || []}
      />
    </AppFrame>
  );
}
