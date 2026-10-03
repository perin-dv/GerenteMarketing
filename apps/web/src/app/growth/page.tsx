import Link from "next/link";
import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { getProtectedJson } from "../_lib/server-data";

const areas: Array<[string, string, string]> = [
  ["Integrações", "/integrations", "Meta/Instagram e WhatsApp oficial"],
  ["Conteúdo", "/content", "Fila de Reels, posts e stories"],
  ["Radar IA", "/radar", "Recomendações com evidência"],
  ["Experimentos", "/experiments", "Testes A/B e vencedores"],
  ["Autopilot", "/autopilot", "Políticas, limites e kill switch"],
  ["Leads", "/leads", "CRM e conversas do WhatsApp"],
];

export default async function GrowthPage() {
  const { me } = await getProtectedJson("/integrations/readiness");
  if (!me) redirect("/login");
  return (
    <AppFrame me={me} active="" eyebrow="GROWTH OS" title="Central de crescimento">
      <div className="page-intro"><div><h2>Fases 5–10 em uma central</h2><p>Entre por aqui enquanto as novas áreas são incorporadas à navegação principal.</p></div></div>
      <section className="metric-grid">
        {areas.map(([title, href, text]) => (
          <Link href={href} key={href} className="metric-card" style={{ textDecoration: "none" }}>
            <span>{title}</span><strong>ABRIR</strong><small>{text}</small>
          </Link>
        ))}
      </section>
    </AppFrame>
  );
}
