import { cookies } from "next/headers";
import type { AppUser } from "../_components/app-frame";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function getProtectedJson<T>(path: string): Promise<{ me: AppUser | null; data: T | null }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  try {
    const [meResponse, dataResponse] = await Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
      fetch(`${apiUrl}${path}`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    ]);
    return {
      me: meResponse.ok ? await meResponse.json() : null,
      data: dataResponse.ok ? await dataResponse.json() : null,
    };
  } catch {
    return { me: null, data: null };
  }
}

export async function getProtectedMany(paths: string[]): Promise<{ me: AppUser | null; data: unknown[] }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  try {
    const [meResponse, ...responses] = await Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
      ...paths.map((path) => fetch(`${apiUrl}${path}`, { headers: { cookie: cookieHeader }, cache: "no-store" })),
    ]);
    return {
      me: meResponse.ok ? await meResponse.json() : null,
      data: await Promise.all(responses.map(async (response) => response.ok ? response.json() : null)),
    };
  } catch {
    return { me: null, data: paths.map(() => null) };
  }
}
