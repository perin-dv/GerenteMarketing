import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppFrame, type AppUser } from "../_components/app-frame";
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
    <AppFrame me={me} active="Campanhas" eyebrow="PLANEJAMENTO" title="Campanhas">
      <div className="page-intro">
        <div>
          <h2>Estruture antes de anunciar</h2>
          <p>Crie campanhas internas, orçamento e objetivo. Nenhuma ação é enviada para a Meta nesta fase.</p>
        </div>
      </div>
      <CampaignManager initialCampaigns={campaigns} />
    </AppFrame>
  );
}
