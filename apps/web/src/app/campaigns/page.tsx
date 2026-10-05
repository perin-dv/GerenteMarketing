import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppFrame, type AppUser } from "../_components/app-frame";
import { AutoCampaignManager } from "./auto-campaign-manager";
import { CampaignManager } from "./campaign-manager";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getData() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const [meResponse, campaignsResponse] = await Promise.all([
    fetch(`${apiUrl}/auth/me`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    fetch(`${apiUrl}/campaigns`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
  ]);

  const me: AppUser | null = meResponse.ok ? await meResponse.json() : null;
  const campaigns = campaignsResponse.ok ? await campaignsResponse.json() : [];
  return { me, campaigns };
}

export default async function CampaignsPage() {
  const { me, campaigns } = await getData();
  if (!me) redirect("/login");

  return (
    <AppFrame me={me} active="Campanhas" eyebrow="CRESCIMENTO ORGÂNICO" title="Campanhas">
      <div className="page-intro">
        <div>
          <h2>Do lote de vídeos para uma campanha automática</h2>
          <p>Você entrega as mídias uma vez. O GerenteMarketing organiza, agenda e publica cada peça sem ficar repetindo o mesmo vídeo.</p>
        </div>
      </div>
      <AutoCampaignManager />
      <CampaignManager initialCampaigns={campaigns} />
    </AppFrame>
  );
}
