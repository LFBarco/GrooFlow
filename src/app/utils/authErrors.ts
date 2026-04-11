/**
 * Mensajes claros para errores de Auth / red (español).
 */
export function describeAuthOrNetworkError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    raw === "TypeError: Failed to fetch"
  ) {
    return (
      "Sin conexión a Supabase. Comprueba .env (URL y clave anon completas; no dejes líneas vacías), " +
      "proyecto activo en el panel, internet y firewall. Ver docs/DEPURAR_CONEXION_SUPABASE.md"
    );
  }

  if (lower.includes("already") && lower.includes("registered")) {
    return raw;
  }

  return raw || "Error desconocido";
}
