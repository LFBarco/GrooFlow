/**
 * Mensajes claros para errores de Auth / red (español).
 */
export function describeAuthOrNetworkError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("authretryablefetcherror") ||
    raw === "TypeError: Failed to fetch"
  ) {
    return (
      "No se pudo conectar con Supabase (servidor de autenticación). " +
      "Comprueba que el proyecto esté activo en supabase.com/dashboard (no pausado), " +
      "revisa status.supabase.com e intenta de nuevo en unos minutos. " +
      "Si persiste, reinicia el proyecto en Supabase → Settings → Infrastructure."
    );
  }

  if (lower.includes("already") && lower.includes("registered")) {
    return raw;
  }

  return raw || "Error desconocido";
}
