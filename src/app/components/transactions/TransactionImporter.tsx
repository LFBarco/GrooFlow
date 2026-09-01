import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Transaction, TransactionType, type Provider, type BankAccountConfig } from '../../types';
import { FileUp, AlertCircle, CheckCircle, Download, Lock } from 'lucide-react';
import { Button } from '../ui/button';
import {
  ConfigStructure,
  getSubcategories,
} from '../../data/initialData';
import { parseTransactionDate } from '../../utils/transactionDate';
import {
  formatBankAccountLabel,
  getPrimaryBankAccount,
  resolveBankAccount,
} from '../../utils/bankAccounts';

interface TransactionImporterProps {
  onImport: (transactions: Transaction[]) => void;
  config?: ConfigStructure;
  sedesCatalog?: string[];
  providers?: Provider[];
  bankAccounts?: BankAccountConfig[];
  /** Carga histórica masiva: solo Super Administrador */
  canManageHistoricalImport?: boolean;
}

type CatalogRow = {
  tipo: TransactionType;
  tipoLabel: 'Ingreso' | 'Egreso';
  categoria: string;
  subcategoria: string;
  concepto: string;
};

function buildCatalogRows(config?: ConfigStructure): CatalogRow[] {
  if (!config) return [];
  const rows: CatalogRow[] = [];
  for (const [categoria, def] of Object.entries(config)) {
    const tipo: TransactionType = def.type === 'income' ? 'income' : 'expense';
    const tipoLabel = tipo === 'income' ? 'Ingreso' : 'Egreso';
    for (const sub of getSubcategories(def, categoria)) {
      if (sub.concepts.length === 0) {
        rows.push({ tipo, tipoLabel, categoria, subcategoria: sub.name, concepto: sub.name });
        continue;
      }
      for (const concept of sub.concepts) {
        rows.push({
          tipo,
          tipoLabel,
          categoria,
          subcategoria: sub.name,
          concepto: concept.name,
        });
      }
    }
  }
  return rows;
}

function normalizeTipo(raw: string): TransactionType | null {
  const s = raw.trim().toLowerCase();
  if (s.includes('ingreso') || s === 'income') return 'income';
  if (s.includes('egreso') || s === 'expense' || s.includes('gasto')) return 'expense';
  return null;
}

export function TransactionImporter({
  onImport,
  config,
  sedesCatalog = [],
  providers = [],
  bankAccounts = [],
  canManageHistoricalImport = false,
}: TransactionImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Transaction[]>([]);

  const sedeOptions = useMemo(
    () => (sedesCatalog.length > 0 ? sedesCatalog : []),
    [sedesCatalog]
  );

  const catalogRows = useMemo(() => buildCatalogRows(config), [config]);
  const primaryBankAccount = useMemo(
    () => getPrimaryBankAccount(bankAccounts),
    [bankAccounts]
  );
  const defaultCuentaLabel = primaryBankAccount
    ? formatBankAccountLabel(primaryBankAccount)
    : bankAccounts[0]
      ? formatBankAccountLabel(bankAccounts[0])
      : '';

  const downloadTemplate = () => {
    const transactionRows = (catalogRows.length > 0
      ? catalogRows
      : [
          {
            tipo: 'income' as const,
            tipoLabel: 'Ingreso' as const,
            categoria: 'Ingresos',
            subcategoria: 'Ingresos',
            concepto: 'Efectivo',
          },
          {
            tipo: 'expense' as const,
            tipoLabel: 'Egreso' as const,
            categoria: 'Otros',
            subcategoria: 'Otros',
            concepto: 'Gasto operativo',
          },
        ]
    ).map((row) => ({
      Cuenta: defaultCuentaLabel,
      Moneda: primaryBankAccount?.currency ?? 'PEN',
      Fecha: '',
      Tipo: row.tipoLabel,
      Sede: '',
      Categoria: row.categoria,
      Subcategoria: row.subcategoria,
      Concepto: row.concepto,
      Monto: '',
      Operacion: '',
      Referencia: '',
    }));

    const catalogSheet = catalogRows.map((row) => ({
      Tipo: row.tipoLabel,
      Categoria: row.categoria,
      Subcategoria: row.subcategoria,
      Concepto: row.concepto,
    }));

    const sedesSheet = sedeOptions.map((s) => ({ Sede: s }));
    const cuentasSheet = bankAccounts.length
      ? bankAccounts.map((a) => ({
          Cuenta: formatBankAccountLabel(a),
          Banco: a.bankName,
          Numero: a.accountNumber,
          Moneda: a.currency,
          Principal: a.isPrimary ? 'Si' : 'No',
        }))
      : [{ Nota: 'Configure cuentas en Configuración → Contabilidad' }];
    const providersSheet = providers.slice(0, 500).map((p) => ({
      ID: p.id,
      Nombre: p.name,
      RUC: p.ruc ?? '',
    }));

    const instrucciones = [
      ['Instrucciones — importación masiva GrooFlow'],
      [''],
      ['1. Complete la hoja Transacciones (una fila = un movimiento).'],
      ['2. Cuenta: use el formato de la hoja Cuentas o el número de cuenta.'],
      ['3. Moneda: PEN o USD (debe coincidir con la cuenta si se indica).'],
      ['4. Tipo: Ingreso o Egreso.'],
      ['5. Fecha: DD/MM/AAAA (día/mes/año), también AAAA-MM-DD.'],
      ['6. Sede es opcional. Si la completas, debe existir en la hoja Sedes.'],
      ['7. Categoría / Subcategoría / Concepto deben coincidir con Flujo de Caja (hoja Catalogo).'],
      ['8. Monto: número positivo.'],
      ['9. Operación y Referencia: opcionales (número de operación bancaria).'],
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instrucciones), 'Instrucciones');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transactionRows), 'Transacciones');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(catalogSheet.length ? catalogSheet : [{ Nota: 'Configure Flujo de Caja' }]),
      'Catalogo'
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sedesSheet), 'Sedes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cuentasSheet), 'Cuentas');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(providersSheet.length ? providersSheet : [{ Nota: 'Sin proveedores' }]),
      'Proveedores'
    );
    XLSX.writeFile(wb, `plantilla_transacciones_grooflow_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const processListSheet = (worksheet: XLSX.WorkSheet): Transaction[] => {
    const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
    const errors: string[] = [];
    const mapped: Transaction[] = [];

    const findKey = (row: Record<string, unknown>, possibleKeys: string[]) => {
      const rowKeys = Object.keys(row);
      let match = rowKeys.find((k) => possibleKeys.includes(k.trim().toLowerCase()));
      if (!match) {
        match = rowKeys.find((k) =>
          possibleKeys.some((pk) => k.trim().toLowerCase().includes(pk))
        );
      }
      return match;
    };

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const cuentaKey = findKey(row, ['cuenta', 'account', 'banco']);
      const monedaKey = findKey(row, ['moneda', 'currency', 'divisa']);
      const tipoKey = findKey(row, ['tipo', 'type', 'movimiento']);
      const fechaKey = findKey(row, ['fecha', 'date', 'fec']);
      const sedeKey = findKey(row, ['sede', 'location', 'local']);
      const catKey = findKey(row, ['categoria', 'category', 'rubro']);
      const subKey = findKey(row, ['subcategoria', 'subcategoría', 'subcategory']);
      const conceptKey = findKey(row, ['concepto', 'concept']);
      const montoKey = findKey(row, ['monto', 'amount', 'importe']);
      const descKey = findKey(row, ['descripcion', 'descripción', 'description', 'detalle']);
      const provKey = findKey(row, ['proveedor', 'provider']);
      const opKey = findKey(row, ['operacion', 'operación', 'operation', 'nro operacion', 'nro operación']);
      const refKey = findKey(row, ['referencia', 'reference']);

      if (!montoKey && !fechaKey && !tipoKey) return;

      const tipoRaw = tipoKey ? String(row[tipoKey] ?? '') : '';
      const tipo = normalizeTipo(tipoRaw);
      if (!tipo) {
        errors.push(`Fila ${rowNumber}: tipo inválido (use Ingreso o Egreso).`);
        return;
      }

      let amount = 0;
      if (montoKey) {
        amount = parseFloat(String(row[montoKey]).replace(/[^0-9.-]+/g, '')) || 0;
      }
      if (amount <= 0) {
        errors.push(`Fila ${rowNumber}: monto requerido y mayor a cero.`);
        return;
      }

      let date = new Date();
      if (fechaKey && row[fechaKey]) {
        const parsed = parseTransactionDate(row[fechaKey]);
        if (!isNaN(parsed.getTime())) date = parsed;
      }

      const categoria = catKey ? String(row[catKey] ?? '').trim() : '';
      const subcategoria = subKey ? String(row[subKey] ?? '').trim() : '';
      const concepto = conceptKey ? String(row[conceptKey] ?? '').trim() : '';
      const locationRaw = sedeKey ? String(row[sedeKey] ?? '').trim() : '';
      const location = locationRaw || undefined;

      if (location && sedeOptions.length > 0 && !sedeOptions.includes(location)) {
        errors.push(`Fila ${rowNumber}: sede "${location}" no existe en la configuración.`);
        return;
      }

      if (config && categoria && !config[categoria]) {
        errors.push(`Fila ${rowNumber}: categoría "${categoria}" no existe en Flujo de Caja.`);
        return;
      }

      let providerId: string | undefined;
      if (provKey && row[provKey]) {
        const provRaw = String(row[provKey]).trim();
        const byId = providers.find((p) => p.id === provRaw);
        const byName = providers.find(
          (p) => p.name.trim().toLowerCase() === provRaw.toLowerCase()
        );
        providerId = byId?.id ?? byName?.id;
      }

      const cuentaRaw = cuentaKey ? String(row[cuentaKey] ?? '').trim() : '';
      const monedaRaw = monedaKey ? String(row[monedaKey] ?? '').trim().toUpperCase() : '';
      let accountId: string | undefined;
      let currency: string | undefined;

      if (cuentaRaw && bankAccounts.length > 0) {
        const matched = resolveBankAccount(bankAccounts, cuentaRaw);
        if (!matched) {
          errors.push(`Fila ${rowNumber}: cuenta "${cuentaRaw}" no existe en Configuración → Contabilidad.`);
          return;
        }
        accountId = matched.id;
        currency = matched.currency;
      } else if (primaryBankAccount) {
        accountId = primaryBankAccount.id;
        currency = primaryBankAccount.currency;
      }

      if (monedaRaw) {
        const normalized =
          monedaRaw.includes('USD') || monedaRaw.includes('DOL')
            ? 'USD'
            : monedaRaw.includes('PEN') || monedaRaw.includes('SOL')
              ? 'PEN'
              : monedaRaw;
        if (currency && normalized !== currency) {
          errors.push(
            `Fila ${rowNumber}: moneda "${monedaRaw}" no coincide con la cuenta seleccionada (${currency}).`
          );
          return;
        }
        currency = normalized;
      }

      const description =
        (descKey ? String(row[descKey] ?? '').trim() : '') ||
        concepto ||
        subcategoria ||
        categoria ||
        'Importado';

      mapped.push({
        id: `tx_imp_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
        date,
        description,
        category: categoria || 'Otros',
        subcategory: subcategoria || undefined,
        concept: concepto || subcategoria || undefined,
        amount,
        type: tipo,
        location,
        providerId,
        account: accountId,
        currency,
        operation: opKey ? String(row[opKey] ?? '').trim() || undefined : undefined,
        reference: refKey ? String(row[refKey] ?? '').trim() || undefined : undefined,
      });
    });

    if (errors.length > 0) {
      throw new Error(errors.slice(0, 8).join('\n'));
    }
    return mapped;
  };

  const processFile = async (file: File) => {
    if (!canManageHistoricalImport) {
      setError('La carga masiva está habilitada solo para el Super Administrador.');
      return;
    }

    setError(null);
    setSuccess(null);
    setPreviewData([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName =
        workbook.SheetNames.find((n) => n.toLowerCase().includes('transaccion')) ??
        workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        setError('No se encontró una hoja válida en el archivo.');
        return;
      }

      const mapped = processListSheet(worksheet);
      if (mapped.length === 0) {
        setError('No se encontraron filas válidas. Use la plantilla descargada.');
        return;
      }

      setPreviewData(mapped);
      setSuccess(`Se encontraron ${mapped.length} transacciones válidas.`);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Error al procesar el archivo. Use la plantilla GrooFlow.'
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canManageHistoricalImport) return;
    if (e.dataTransfer.files?.[0]) {
      void processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      void processFile(e.target.files[0]);
    }
  };

  const handleConfirm = () => {
    if (previewData.length > 0) {
      onImport(previewData);
      setPreviewData([]);
      setSuccess(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Plantilla — visible para todos; descarga siempre disponible */}
      <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Plantilla de carga masiva
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Excel con hojas Transacciones, Catálogo, Sedes, Cuentas bancarias y Proveedores actuales.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 border-cyan-500/40 text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10"
            onClick={downloadTemplate}
          >
            <Download className="h-4 w-4" />
            Descargar plantilla .xlsx
          </Button>
        </div>
        {!canManageHistoricalImport && (
          <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Puedes descargar la plantilla. La importación del archivo completado requiere Super Administrador.
          </p>
        )}
      </div>

      {canManageHistoricalImport ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
              <FileUp className="h-6 w-6 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Arrastra tu archivo Excel aquí
              </p>
              <p className="text-xs text-slate-500 mt-1">o haz clic para seleccionar</p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              id="transaction-file-upload"
              onChange={handleChange}
            />
            <label
              htmlFor="transaction-file-upload"
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-sm"
            >
              Seleccionar archivo
            </label>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-6 text-center text-sm text-slate-500">
          <Lock className="h-8 w-8 mx-auto mb-2 text-slate-400" />
          Carga histórica restringida al Super Administrador.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-md flex items-start whitespace-pre-line">
          <AlertCircle className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-sm rounded-md flex items-center justify-between gap-2">
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 shrink-0" />
            {success}
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 font-medium shrink-0"
          >
            Confirmar importación
          </button>
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
        <p className="font-bold text-slate-800 dark:text-slate-200 mb-2">Columnas de la hoja Transacciones</p>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
          <span>• Cuenta: catálogo bancario (hoja Cuentas)</span>
          <span>• Moneda: PEN / USD</span>
          <span>• Fecha: DD/MM/AAAA (día/mes/año)</span>
          <span>• Tipo: Ingreso / Egreso</span>
          <span>• Sede: opcional, catálogo configurado</span>
          <span>• Categoría / Subcategoría / Concepto</span>
          <span>• Monto: número positivo</span>
          <span>• Operación / Referencia: opcionales</span>
        </div>
      </div>
    </div>
  );
}
