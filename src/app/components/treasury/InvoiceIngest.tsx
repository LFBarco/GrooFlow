import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, ArrowRight } from 'lucide-react';
import { Invoice } from './types';
import { processFile } from '../../utils/invoiceParser'; // Import the real parser
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InvoiceIngestProps {
  onProcessComplete: (invoices: Invoice[]) => void;
}

export const InvoiceIngest: React.FC<InvoiceIngestProps> = ({ onProcessComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedInvoices, setProcessedInvoices] = useState<Invoice[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => 
      file.type === 'text/xml' || 
      file.name.toLowerCase().endsWith('.xml') ||
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls')
    );
    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleProcessing = async () => {
    setIsProcessing(true);
    setErrors([]);
    const results: Invoice[] = [];
    const newErrors: string[] = [];
    
    // Process files sequentially to avoid freezing UI too much if many files
    for (const file of files) {
      try {
        const invoices = await processFile(file);
        results.push(...invoices);
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        newErrors.push(`${file.name}: ${err.message || 'Error desconocido'}`);
      }
    }

    if (results.length > 0) {
      setProcessedInvoices(results);
    }
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
    }

    setIsProcessing(false);
  };

  const handleConfirm = () => {
    onProcessComplete(processedInvoices);
    setFiles([]);
    setProcessedInvoices([]);
    setErrors([]);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Buzón de Recepción Digital</h2>
        <p className="text-gray-500">
          Sube tus XML de Facturación Electrónica (SUNAT) o plantillas Excel.
          El sistema extraerá automáticamente los datos para tu flujo de caja.
        </p>
      </div>

      {/* Dropzone */}
      <AnimatePresence mode="wait">
        {processedInvoices.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={twMerge(
              "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-colors cursor-pointer bg-white relative",
              isDragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-gray-400"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept=".xml,.xlsx,.xls"
              onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
            />
            
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Arrastra tus XML o Excel aquí
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Soporta Facturas UBL 2.1 (SUNAT) y Carga Masiva Excel
            </p>

            {files.length > 0 && (
              <div className="w-full max-w-md bg-gray-50 rounded-lg p-4 mb-4 text-left" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{files.length} archivos listos</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFiles([]); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Limpiar
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center text-sm text-gray-600 bg-white p-2 rounded border border-gray-200 shadow-sm">
                      <FileText className="w-4 h-4 mr-2 text-indigo-400" />
                      <span className="truncate flex-1 font-medium">{f.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{(f.size / 1024).toFixed(0)} KB</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles(files.filter((_, idx) => idx !== i));
                        }}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="w-full max-w-md bg-red-50 border border-red-100 rounded-lg p-3 mb-4 text-left">
                <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                  <AlertCircle className="w-4 h-4" />
                  Errores anteriores:
                </div>
                <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            {files.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleProcessing(); }}
                disabled={isProcessing}
                className="mt-4 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando Documentos...
                  </>
                ) : (
                  <>
                    Procesar {files.length} Archivos
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  {processedInvoices.length} Documentos Extraídos Exitosamente
                </h3>
                {errors.length > 0 && (
                  <p className="text-xs text-red-500 mt-1">{errors.length} archivos ignorados por errores.</p>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setProcessedInvoices([]);
                    setFiles([]);
                    setErrors([]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Descartar
                </button>
                <button 
                  onClick={handleConfirm}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                >
                  Confirmar e Importar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Documento</th>
                    <th className="px-6 py-3 font-semibold">Proveedor Detectado</th>
                    <th className="px-6 py-3 font-semibold">Categoría (IA)</th>
                    <th className="px-6 py-3 font-semibold text-right">Importe</th>
                    <th className="px-6 py-3 font-semibold">Vencimiento</th>
                    <th className="px-6 py-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {processedInvoices.map((inv, idx) => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{inv.documentNumber}</div>
                        <div className="text-xs text-gray-500">{inv.documentType}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{inv.providerName}</div>
                        <div className="text-xs text-gray-500">RUC: {inv.providerRuc}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          inv.category === 'Servicios Básicos' ? "bg-blue-50 text-blue-700 border-blue-100" :
                          inv.category === 'Insumos Médicos' ? "bg-green-50 text-green-700 border-green-100" :
                          "bg-gray-100 text-gray-800 border-gray-200"
                        )}>
                          {inv.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-gray-900">
                        {inv.currency} {inv.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {inv.dueDate.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full w-fit">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Leído OK
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
