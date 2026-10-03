"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError(response.status === 401 ? "E-mail ou senha inválidos." : "Não foi possível entrar agora.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("API indisponível. Verifique se o backend está rodando.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        <span>E-mail</span>
        <input name="email" type="email" autoComplete="email" placeholder="voce@empresa.com" required />
      </label>

      <label>
        <span>Senha</span>
        <div className="password-field">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            minLength={8}
            required
          />
          <button type="button" onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </label>

      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar no GerenteMarketing"}
      </button>
    </form>
  );
}
