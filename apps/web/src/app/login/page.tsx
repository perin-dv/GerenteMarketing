import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="brand-mark">GM</div>
        <div>
          <span className="eyebrow">MARKETING INTELLIGENCE OS</span>
          <h1>Gerente<span>Marketing</span></h1>
          <p className="brand-copy">
            Campanhas, conteúdo, metas e inteligência de crescimento em um único painel.
          </p>
        </div>
        <div className="signal-row">
          <span><i className="signal-dot" /> Engine online</span>
          <span>Secure access</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-heading">
            <span className="eyebrow">ACESSO</span>
            <h2>Bem-vindo de volta</h2>
            <p>Entre com sua conta para acessar o centro de comando.</p>
          </div>
          <LoginForm />
          <div className="security-note">Sessão protegida por cookie HTTP-only.</div>
        </div>
      </section>
    </main>
  );
}
