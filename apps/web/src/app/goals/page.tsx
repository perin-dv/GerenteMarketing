import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppFrame, type AppUser } from "../_components/app-frame";
import { GoalManager } from "./goal-manager";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getData() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const [meResponse, goalsResponse, campaignsResponse] = await Promise.all([
    fetch(`${apiUrl}/auth/me`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    fetch(`${apiUrl}/goals`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    fetch(`${apiUrl}/campaigns`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
  ]);

  const me: AppUser | null = meResponse.ok ? await meResponse.json() : null;
  const goals = goalsResponse.ok ? await goalsResponse.json() : [];
  const campaigns = campaignsResponse.ok ? await campaignsResponse.json() : [];
  return { me, goals, campaigns };
}

export default async function GoalsPage() {
  const { me, goals, campaigns } = await getData();
  if (!me) redirect("/login");

  return (
    <AppFrame me={me} active="Metas" eyebrow="CRESCIMENTO MENSURÁVEL" title="Metas">
      <div className="page-intro">
        <div>
          <h2>Meta real, sem precisar comprar alcance</h2>
          <p>Defina o que quer conquistar organicamente — conteúdo, seguidores, alcance, visualizações ou conversas no WhatsApp — e acompanhe o ritmo até o prazo.</p>
        </div>
      </div>
      <GoalManager initialGoals={goals} campaigns={campaigns} />
    </AppFrame>
  );
}
