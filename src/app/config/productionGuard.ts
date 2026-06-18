export type ProductionConfigIssue = {
  code: string
  message: string
}

export type ProductionGuardEnv = {
  prod: boolean
  backend: string
  productionSql: string | undefined
  supabaseUrl: string | undefined
}

export function readProductionGuardEnv(): ProductionGuardEnv {
  return {
    prod: import.meta.env.PROD,
    backend: import.meta.env.VITE_BACKEND ?? 'supabase',
    productionSql: import.meta.env.VITE_PRODUCTION_SQL,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  }
}

/** Detecta configuración insegura o inconsistente en builds de producción. */
export function getProductionConfigIssues(
  env: ProductionGuardEnv = readProductionGuardEnv()
): ProductionConfigIssue[] {
  if (!env.prod) return []

  const issues: ProductionConfigIssue[] = []

  if (env.backend === 'local') {
    issues.push({
      code: 'backend_local',
      message: 'VITE_BACKEND=local en un build de producción. Use supabase.',
    })
  }

  if (env.backend === 'supabase' && env.productionSql === 'false') {
    issues.push({
      code: 'sql_disabled',
      message: 'VITE_PRODUCTION_SQL=false en producción. Los datos pueden no replicarse a SQL.',
    })
  }

  if (!env.supabaseUrl?.startsWith('https://')) {
    issues.push({
      code: 'missing_supabase_url',
      message: 'Falta VITE_SUPABASE_URL en el build de producción.',
    })
  }

  return issues
}

export function warnProductionConfigIssues(): void {
  const issues = getProductionConfigIssues()
  if (issues.length === 0) return
  console.warn(
    '[GrooFlow] Configuración de producción incompleta:',
    issues.map((i) => i.message).join(' | ')
  )
}
