import { Invoice } from '../components/treasury/types';
import * as XLSX from 'xlsx';

// Helper to safely get text content from XML, handling namespaces
const getTagValue = (doc: Document, tags: string[]): string => {
  for (const tag of tags) {
    const elements = doc.getElementsByTagName(tag);
    if (elements.length > 0) {
      return elements[0].textContent || '';
    }
  }
  return '';
};

const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date() : date;
};

// Parse SUNAT UBL 2.1 XML Invoice
const parseInvoiceXML = async (file: File): Promise<Invoice> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');

        // Extract basic fields (UBL 2.1 Standard for Peru)
        // We try multiple tag variations because UBL versions differ
        
        // 1. Document Number (Series-Correlative)
        const documentNumber = getTagValue(doc, ['cbc:ID', 'ID']) || 'S/N';
        
        // 2. Issue Date
        const issueDateStr = getTagValue(doc, ['cbc:IssueDate', 'IssueDate']);
        const issueDate = parseDate(issueDateStr);
        
        // 3. Due Date (Often in cbc:DueDate or inferred)
        const dueDateStr = getTagValue(doc, ['cbc:DueDate', 'DueDate']);
        const dueDate = dueDateStr ? parseDate(dueDateStr) : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        // 4. Provider Info
        // Usually in AccountingSupplierParty -> Party -> PartyLegalEntity -> RegistrationName
        let providerName = getTagValue(doc, ['cbc:RegistrationName', 'RegistrationName']);
        if (!providerName) {
            // Fallback: try to find any Name tag under Supplier
            const supplier = doc.getElementsByTagName('cac:AccountingSupplierParty')[0];
            if (supplier) {
                providerName = supplier.getElementsByTagName('cbc:Name')[0]?.textContent || 'Proveedor Desconocido';
            } else {
                providerName = 'Proveedor Desconocido';
            }
        }
        
        const providerRuc = getTagValue(doc, ['cbc:CustomerAssignedAccountID', 'CustomerAssignedAccountID']) || '00000000000';

        // 5. Amount
        // LegalMonetaryTotal -> PayableAmount
        const amountStr = getTagValue(doc, ['cbc:PayableAmount', 'PayableAmount']);
        const amount = parseFloat(amountStr) || 0;

        // 6. Currency
        let currency = 'PEN';
        const payableAmountNode = doc.getElementsByTagName('cbc:PayableAmount')[0] || doc.getElementsByTagName('PayableAmount')[0];
        if (payableAmountNode) {
            currency = payableAmountNode.getAttribute('currencyID') || 'PEN';
        }

        // 7. Auto-Categorization (Simple Rule-Based)
        let category = 'Otros Gastos';
        const nameLower = providerName.toLowerCase();
        if (nameLower.includes('luz') || nameLower.includes('enel') || nameLower.includes('sedapal') || nameLower.includes('agua')) category = 'Servicios Básicos';
        else if (nameLower.includes('internet') || nameLower.includes('claro') || nameLower.includes('movistar') || nameLower.includes('entel')) category = 'Telecomunicaciones';
        else if (nameLower.includes('vet') || nameLower.includes('farma') || nameLower.includes('lab') || nameLower.includes('medic')) category = 'Insumos Médicos';
        else if (nameLower.includes('seguros') || nameLower.includes('rimac') || nameLower.includes('pacifico')) category = 'Seguros';
        else if (nameLower.includes('transport') || nameLower.includes('uber') || nameLower.includes('cabify')) category = 'Movilidad';

        resolve({
          id: `xml-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          documentNumber,
          documentType: 'Factura',
          providerName,
          providerRuc,
          amount,
          currency,
          issueDate,
          dueDate,
          tentativePaymentDate: dueDate,
          category,
          status: 'pending',
          branchId: 'Global',
          description: `XML Importado: ${file.name}`,
          fileUrl: URL.createObjectURL(file) // Create a blob URL for preview
        });

      } catch (error) {
        console.error("XML Parse Error", error);
        reject(new Error("Error al leer el archivo XML. Verifique que sea un formato UBL 2.1 válido."));
      }
    };
    reader.onerror = () => reject(new Error("Error de lectura de archivo."));
    reader.readAsText(file);
  });
};

// Parse Excel (Bulk Ingest)
const parseInvoiceExcel = async (file: File): Promise<Invoice[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Archivo vacío");

        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON (Array of Objects)
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        if (jsonData.length === 0) {
            throw new Error("El archivo Excel está vacío o no tiene datos legibles.");
        }

        const invoices: Invoice[] = jsonData.map((row, index) => {
            // Helper for Excel dates (Serial number to Date)
            const getJsDate = (excelDate: any) => {
                if (excelDate instanceof Date) return excelDate;
                if (typeof excelDate === 'number') {
                    return new Date(Math.round((excelDate - 25569) * 86400 * 1000));
                }
                if (typeof excelDate === 'string') {
                    const parsed = Date.parse(excelDate);
                    return isNaN(parsed) ? new Date() : new Date(parsed);
                }
                return new Date();
            };

            const issueDate = getJsDate(row['Fecha Emision'] || row['Fecha'] || row['Date']);
            // Try to find due date, otherwise issue date + 30
            const dueDate = row['Vencimiento'] ? getJsDate(row['Vencimiento']) : new Date(issueDate.getTime() + 30 * 86400000);

            // Extract Amount (handle currency symbols if present as string)
            let amount = 0;
            if (typeof row['Monto'] === 'number') amount = row['Monto'];
            else if (typeof row['Monto'] === 'string') amount = parseFloat(row['Monto'].replace(/[^0-9.-]+/g,""));
            
            // Auto-detect category from row or provider
            let category = row['Categoria'] || 'Otros Gastos';
            const provName = (row['Proveedor'] || '').toString();
            
            if (category === 'Otros Gastos') {
                 const nameLower = provName.toLowerCase();
                 if (nameLower.includes('luz') || nameLower.includes('agua')) category = 'Servicios Básicos';
                 else if (nameLower.includes('vet') || nameLower.includes('farma')) category = 'Insumos Médicos';
            }

            return {
                id: `xls-${Date.now()}-${index}`,
                documentNumber: row['Documento'] || row['Factura'] || row['Nro'] || `F001-${1000+index}`,
                documentType: row['Tipo'] || 'Factura',
                providerName: provName || 'Proveedor Excel',
                providerRuc: row['RUC'] || '00000000000',
                amount: amount || 0,
                currency: row['Moneda'] || 'PEN',
                issueDate,
                dueDate,
                tentativePaymentDate: dueDate,
                category,
                status: 'pending',
                branchId: row['Sede'] || 'Global',
                description: `Excel Import: ${file.name} (Fila ${index+2})`,
                fileUrl: URL.createObjectURL(file)
            };
        });

        resolve(invoices);
      } catch (error) {
        console.error("Excel Parse Error", error);
        reject(new Error("Error al procesar Excel. Verifique el formato (Columnas: Fecha, Proveedor, Monto, Documento)."));
      }
    };
    reader.onerror = () => reject(new Error("Error de lectura de archivo."));
    reader.readAsArrayBuffer(file);
  });
};

export const processFile = async (file: File): Promise<Invoice[]> => {
  if (file.name.toLowerCase().endsWith('.xml')) {
    const invoice = await parseInvoiceXML(file);
    return [invoice];
  } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
    return await parseInvoiceExcel(file);
  }
  throw new Error('Formato no soportado. Por favor sube un XML (Factura Electrónica) o un Excel (.xlsx).');
};
