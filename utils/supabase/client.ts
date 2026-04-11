/**
 * Cliente único de Supabase para toda la app (misma URL y anon key que el repositorio).
 * Evita errores "Failed to fetch" por configuración distinta entre pantallas.
 */
import { getSupabaseClient } from "../../src/app/services/repository/supabase";

export const supabase = getSupabaseClient();
