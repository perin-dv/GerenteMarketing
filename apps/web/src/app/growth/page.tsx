import Link from "next/link";
import { redirect } from "next/navigation";
import { AppFrame } from "../_components/app-frame";
import { getProtectedJson } from "../_lib/server-data";

const areas: Array<[string, string, string]> = [
  ["Integrações", "/integrations", "Meta/Instagram e WhatsApp oficial"],
  ["Conteúdo", "/content", "Fila de Reels, posts e stories"],
  ["WhatsApp Marketing", "/whatsapp-campaigns", "Templates aprovados, público autorizado e campanhas segmentadas"],
  ["Performance", "/performance", "Aprende com alcance, views, engajamento e hashtags reais"],
  ["Radar IA", "/radar", "Recomendações com evidência"],
  ["Experimentos", "/experiments", "Testes A/B e vencedores"],
  ["Autopilot", "/autopilot", "Políticas, limites e kill switch"],
  ["Leads", "/leads", "CRM e conversas do WhatsApp"],
  ["TikTok + Telegram", "/channels", "Login Kit, Display API e Bot API"],
  ["Workspaces", "/workspaces", "Multiempresa e troca de contexto"],
];

export default async function GrowthPage() {
  const { me } = await getProtectedJson("/integrations/readiness");
  if (!me) redirect("/login");
  return (
    <AppFrame me={me} active="" eyebrow="GROWTH OS" title="Central de crescimento">
      <div className="page-intro"><div><h2>Growth OS em operação</h2><p>Dados reais, conteúdo, campanhas de WhatsApp com consentimento, leitura de performance, decisão, testes e automação controlada.</p></div></div>
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
