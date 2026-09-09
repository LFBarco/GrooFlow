import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, Loader2, CheckCircle2 } from 'lucide-react';
import { fetchSunatRucData, isValidRucDigits, normalizeRucDigits, SunatRucInfo } from '../../utils/sunatRucApi';
import { toast } from 'sonner';

interface RucSearchFieldProps {
  rucValue: string;
  onRucChange: (value: string) => void;
  onRazonSocialFound?: (info: SunatRucInfo) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const RucSearchField: React.FC<RucSearchFieldProps> = ({
  rucValue,
  onRucChange,
  onRazonSocialFound,
  label = 'RUC (11 dígitos)',
  placeholder = 'Ingrese RUC de 11 dígitos',
  className = '',
  id = 'ruc-search-input',
}) => {
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = normalizeRucDigits(e.target.value);
    onRucChange(clean);
    if (clean.length === 11) {
      void performSearch(clean);
    }
  };

  const performSearch = async (targetRuc: string) => {
    if (!isValidRucDigits(targetRuc)) {
      toast.error('El RUC debe contener exactamente 11 dígitos numéricos.');
      return;
    }
    setLoading(true);
    try {
      const info = await fetchSunatRucData(targetRuc);
      if (info && info.razonSocial) {
        onRazonSocialFound?.(info);
        toast.success(`SUNAT: ${info.razonSocial}`, {
          description: info.direccion ? `Dirección: ${info.direccion}` : undefined,
        });
      } else {
        toast.warning('No se obtuvieron datos automáticos de SUNAT. Puedes ingresar la razón social manualmente.');
      }
    } catch {
      toast.error('No se pudo consultar el RUC en SUNAT. Ingresa los datos manualmente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label htmlFor={id} className="text-sm font-medium text-foreground block">{label}</label>}
      <div className="relative flex items-center">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength={11}
          value={rucValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pr-10 font-mono tracking-wider"
        />
        <div className="absolute right-1 flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => performSearch(rucValue)}
            disabled={loading || rucValue.length !== 11}
            title="Consultar RUC en SUNAT"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : rucValue.length === 11 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
