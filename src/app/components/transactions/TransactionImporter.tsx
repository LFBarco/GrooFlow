import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Transaction, TransactionType, Category } from '../../types';
import { Upload, FileUp, AlertCircle, CheckCircle } from 'lucide-react';

interface TransactionImporterProps {
  onImport: (transactions: Transaction[]) => void;
}

export function TransactionImporter({ onImport }: TransactionImporterProps) {
  const [isDragging,SHIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Transaction[]>([]);

  const processFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setError("El archivo parece estar vacío.");
        return;
      }

      // Basic validation and mapping
      // Expected columns loose matching
      
      const mappedTransactions: Transaction[] = [];
      const sheetData = jsonData as any[];
      
      // Strategy 1: Matrix Detection (Cash Flow Format)
      // Look for a row that has multiple date-like columns
      let dateRowIndex = -1;
      let dateColumns: { index: string, date: Date }[] = [];

      // Helper to parse loose dates like "1-ene", "jueves 1-ene"
      const parseHeaderDate = (val: any): Date | null => {
         if (val instanceof Date) return val;
         if (typeof val === 'number') return new Date(Math.round((val - 25569)*86400*1000));
         
         const str = String(val).toLowerCase().trim();
         // Matches "1-ene", "1 ene", "1-ene-24"
         const match = str.match(/(\d{1,2})[-/ ]([a-z]{3})/);
         if (match) {
             const day = parseInt(match[1]);
             const monthMap:Record<string, number> = {
                 'ene':0, 'feb':1, 'mar':2, 'abr':3, 'may':4, 'jun':5,
                 'jul':6, 'ago':7, 'sep':8, 'oct':9, 'nov':10, 'dic':11
             };
             const month = monthMap[match[2].substring(0,3)];
             if (month !== undefined) {
                 const year = new Date().getFullYear(); // Assume current year if missing
                 return new Date(year, month, day);
             }
         }
         return null;
      };

      // Find header row
      // We convert sheet to array of arrays for easier index access if needed, but json is array of objects
      // Let's use the raw sheet to be safe about row indices
      const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:Z100");
      
      // Iterate rows to find the one with many dates
      for (let R = range.s.r; R <= Math.min(range.e.r, 20); ++R) {
          let dateCount = 0;
          let cols: { index: string, date: Date }[] = [];
          
          for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellAddress = XLSX.utils.encode_cell({r: R, c: C});
              const cell = worksheet[cellAddress];
              if (!cell) continue;
              
              const date = parseHeaderDate(cell.v);
              if (date) {
                  dateCount++;
                  // Store column key (header name in json usually, but here we need generic access)
                  // Actually, let's use the JSON data directly but we need to know WHICH keys correspond to dates
                  // If we use sheet_to_json with header:1 (array of arrays), it's easier.
              }
          }

          if (dateCount > 3) {
              dateRowIndex = R;
              break;
          }
      }

      if (dateRowIndex !== -1) {
          // Re-parse sheet as Array of Arrays to handle matrix correctly
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          const headerRow = rawData[dateRowIndex];
          
          // Map column indices to dates
          headerRow.forEach((val, idx) => {
              const date = parseHeaderDate(val);
              if (date) {
                  dateColumns.push({ index: String(idx), date });
              }
          });

          // Iterate rows BELOW header
          let currentCategory = 'Otros'; // Context state for hierarchy

          for (let i = dateRowIndex + 1; i < rawData.length; i++) {
              const row = rawData[i];
              if (!row || row.length === 0) continue;

              // Heuristics for Category vs Concept
              // Col 0 (A) -> Category (if B is empty?) OR Type
              // Col 1 (B) -> Concept
              
              const colA = row[0] ? String(row[0]).trim() : '';
              const colB = row[1] ? String(row[1]).trim() : '';

              // Skip total rows
              if (colA.toLowerCase().includes('total') || colB.toLowerCase().includes('total')) continue;
              if (colA.toLowerCase().includes('saldo')) continue;

              // If Col A has value and Col B is empty (or dates exist), maybe Col A is just a header?
              // In the user's image: Col A = "TIPO" (Ingresos), Col B = "SALDO INICIAL" / "BANCO BCP"
              // The categories repeat: "INGRESOS" is in Col A for multiple rows.
              
              if (colA) currentCategory = colA; 
              // Normalize category name
              let cat: Category = 'Otros';
              const upperCat = currentCategory.toUpperCase();
              
              if (upperCat.includes('INGRESO')) cat = 'Ingresos';
              else if (upperCat.includes('SERV') && upperCat.includes('BASICO')) cat = 'Servicios Básicos';
              else if (upperCat.includes('PLANILLA')) cat = 'Planilla';
              else if (upperCat.includes('PROVEEDOR')) cat = 'Proveedores';
              else if (upperCat.includes('MANTENIMIENTO')) cat = 'Mantenimiento';
              else if (upperCat.includes('IMPUESTO')) cat = 'Impuestos';
              else if (upperCat.includes('SEGURO')) cat = 'Seguros';
              else if (upperCat.includes('MEDICA') || upperCat.includes('MÉDICA')) cat = 'Área Médica';
              else if (upperCat.includes('GROOMING') || upperCat.includes('PELUQUERIA')) cat = 'Área Grooming';
              else if (upperCat.includes('OPERATIVA')) cat = 'Área Operativa';
              else if (upperCat.includes('OBRA')) cat = 'Obras Sedes';
              else if (upperCat.includes('PRESTAMO') || upperCat.includes('PRÉSTAMO')) cat = 'Préstamos';
              else if (upperCat.includes('REGALIA') || upperCat.includes('REGALÍA')) cat = 'Regalías';
              else if (upperCat.includes('COMISION') && upperCat.includes('BANCARIA')) cat = 'Comisiones Bancarias';
              
              const description = colB || colA; // Fallback
              if (!description) continue; // Empty row

              // Extract amounts for each date column
              dateColumns.forEach(dc => {
                  const val = row[parseInt(dc.index)];
                  if (typeof val === 'number' && val !== 0) {
                      mappedTransactions.push({
                          id: Math.random().toString(36).substr(2, 9),
                          date: dc.date,
                          description: description,
                          subcategory: description,
                          category: cat,
                          amount: Math.abs(val),
                          type: cat === 'Ingresos' ? 'income' : 'expense'
                      });
                  }
              });
          }
      } else {
         // Fallback to List Strategy (Original code)
         // ... existing list mapping logic ...
         const listData = XLSX.utils.sheet_to_json(worksheet);
         // (Insert existing logic here or simplified version)
          const listTransactions: Transaction[] = listData.map((row: any, index) => {
            // ... (Same helpers as before) ...
            const findKey = (possibleKeys: string[]) => {
                const rowKeys = Object.keys(row);
                let match = rowKeys.find(k => possibleKeys.includes(k.trim().toLowerCase()));
                if (!match) match = rowKeys.find(k => possibleKeys.some(pk => k.trim().toLowerCase().includes(pk)));
                return match;
            };
            
            const dateKey = findKey(['date', 'fecha', 'dia', 'día', 'fec']);
            const descKey = findKey(['description', 'descripcion', 'descripción', 'concepto', 'detalle']);
            const amountKey = findKey(['amount', 'monto', 'importe', 'precio']);
            const catKey = findKey(['category', 'categoria', 'categoría', 'rubro']);
            const typeKey = findKey(['type', 'tipo', 'movimiento']);
    
            if (!dateKey && !amountKey) return null; // Skip invalid rows
            
            let amount = 0;
            if (amountKey) amount = parseFloat(String(row[amountKey]).replace(/[^0-9.-]+/g, "")) || 0;
            
            let date = new Date();
            if (dateKey && row[dateKey]) {
                 if (typeof row[dateKey] === 'number') date = new Date(Math.round((row[dateKey] - 25569)*86400*1000));
                 else date = new Date(row[dateKey]);
            }

            return {
                id: Math.random().toString(36).substr(2, 9),
                date: isNaN(date.getTime()) ? new Date() : date,
                description: descKey ? String(row[descKey]) : 'Importado',
                category: catKey ? (row[catKey] as Category) : 'Otros',
                amount: Math.abs(amount),
                type: (typeKey && String(row[typeKey]).toLowerCase().includes('ingreso')) ? 'income' : 'expense'
            };
         }).filter((t): t is Transaction => t !== null && t.amount > 0);
         
         mappedTransactions.push(...listTransactions);
      }

      setPreviewData(mappedTransactions);
      setSuccess(`Se encontraron ${mappedTransactions.length} transacciones válidas.`);

      setPreviewData(mappedTransactions);
      setSuccess(`Se encontraron ${mappedTransactions.length} transacciones válidas.`);
    } catch (err) {
      console.error(err);
      setError("Error al procesar el archivo. Asegúrate de que sea un Excel válido y tenga encabezados.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    SHIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleConfirm = () => {
    if (previewData.length > 0) {
      onImport(previewData);
      setPreviewData([]);
      setSuccess(null);
      // Reset file input if needed via ref, strictly not necessary for this flow
    }
  };

  return (
    <div className="space-y-4">
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); SHIsDragging(true); }}
        onDragLeave={() => SHIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-slate-100 rounded-full">
            <FileUp className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Arrastra tu archivo Excel aquí
            </p>
            <p className="text-xs text-slate-500 mt-1">
              o haz clic para seleccionar
            </p>
          </div>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            id="file-upload"
            onChange={handleChange}
          />
          <label 
            htmlFor="file-upload"
            className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm"
          >
            Seleccionar archivo
          </label>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            {success}
          </div>
          <button 
            onClick={handleConfirm}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 font-medium"
          >
            Confirmar Importación
          </button>
        </div>
      )}

      <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-xs text-slate-600">
        <p className="font-bold text-slate-800 mb-2">Guía de Importación (Estructura Matriz):</p>
        <p className="mb-2">El sistema detecta automáticamente las siguientes categorías si aparecen en la Columna A:</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span>• INGRESOS</span>
          <span>• SERVICIOS BÁSICOS</span>
          <span>• PLANILLA</span>
          <span>• IMPUESTOS</span>
          <span>• SEGUROS</span>
          <span>• ÁREA MÉDICA</span>
          <span>• ÁREA GROOMING</span>
          <span>• ÁREA OPERATIVA</span>
          <span>• OBRAS SEDES</span>
          <span>• PRÉSTAMOS / REGALÍAS</span>
        </div>
        <p className="mt-3 text-slate-500 italic">
          * La Columna B debe contener el detalle (Concepto). Las columnas siguientes deben ser las fechas (1-ene, 2-ene...).
        </p>
      </div>
    </div>
  );
}
