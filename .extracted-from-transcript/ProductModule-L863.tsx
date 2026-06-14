import { Package } from 'lucide-react';
import type { Product, Provider } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ProductModuleProps {
  products: Product[];
  providers: Provider[];
  onUpdateProducts: (next: Product[]) => void;
  visibleSedes: string[];
}

/** Vista mínima del catálogo; permite compilar y persistir `data:products` mientras se reconstruye el módulo completo. */
export function ProductModule({ products }: ProductModuleProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Catálogo de productos
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {products.length === 0
          ? 'No hay productos registrados.'
          : `${products.length} producto(s) en el catálogo.`}
      </CardContent>
    </Card>
  );
}
