"use client";

import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  return <button className="ghost-button" onClick={logout}>Sair</button>;
}
