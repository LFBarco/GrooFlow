import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { TransactionType } from "../../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { ConfigStructure, getSubcategories } from "../../data/initialData";
import { Provider } from "../../types";

interface TransactionFormProps {
  onSubmit: (data: any) => void;
  config?: ConfigStructure;
  providers?: Provider[];
  initialData?: any;
  onCancel?: () => void;
}

export function TransactionForm({ onSubmit, config, providers = [], initialData, onCancel }: TransactionFormProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const [selectedType, setSelectedType] = useState<TransactionType>("expense");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableSubcategories, setAvailableSubcategories] = useState<{ id: string; name: string }[]>([]);
  const [availableConcepts, setAvailableConcepts] = useState<string[]>([]);
  
  const selectedCategory = watch('category');
  const selectedSubcategory = watch('subcategory');

  // Load initial data
  useEffect(() => {
    if (initialData) {
      // Set simple fields
      setValue('amount', initialData.amount);
      setValue('description', initialData.description);
      setValue('providerId', initialData.providerId);
      setValue('location', initialData.location);
      
      // Handle Date: If it's a Date object, format it. If string, use as is (assuming YYYY-MM-DD)
      const dateVal = initialData.date instanceof Date 
        ? initialData.date.toISOString().split('T')[0] 
        : typeof initialData.date === 'string' 
          ? initialData.date.split('T')[0] 
          : new Date().toISOString().split('T')[0];
      setValue('date', dateVal);

      // Set Type
      if (initialData.type) {
        setSelectedType(initialData.type);
      }
      
      // Category and Subcategory will be set after the type effect runs
      // But we need to ensure they are set after the options are available
      // Using a timeout or a separate effect dependent on availableCategories might be needed
      // For now, let's force set them after a tick to allow the type-effect to populate categories
      setTimeout(() => {
        if (initialData.category) setValue('category', initialData.category);
        setTimeout(() => {
          if (initialData.subcategory) setValue('subcategory', initialData.subcategory);
          if (initialData.concept) setValue('concept', initialData.concept);
          else if (initialData.subcategory && !initialData.concept) setValue('concept', initialData.subcategory);
        }, 50);
      }, 50);
    }
  }, [initialData, setValue]);

  // Filter categories based on selected Type (Income/Expense)
  useEffect(() => {
    if (config) {
      const filtered = Object.entries(config)
        .filter(([_, def]) => def.type === selectedType)
        .map(([key]) => key);
      setAvailableCategories(filtered);
      
      // Smart Auto-selection Logic
      let autoSelectCategory = "";

      // 1. If there is a category named exactly like "Ingresos" for income type, pick it.
      if (selectedType === 'income' && filtered.includes('Ingresos')) {
        autoSelectCategory = 'Ingresos';
      }
      // 2. If there is only one category available, pick it automatically.
      else if (filtered.length === 1) {
        autoSelectCategory = filtered[0];
      }

      // Apply selection
      if (autoSelectCategory) {
         // Only set if current selection is invalid or empty, to avoid overwriting during edit
         const currentIsValid = selectedCategory && filtered.includes(selectedCategory);
         if (!currentIsValid && selectedCategory !== autoSelectCategory) {
            setValue('category', autoSelectCategory);
         }
      } else {
         // Reset category if the current selection is no longer valid for the new type
         if (selectedCategory && !filtered.includes(selectedCategory)) {
           setValue('category', '');
           setValue('subcategory', '');
           setValue('concept', '');
         }
      }
    }
  }, [selectedType, config, setValue, selectedCategory]); 

  // Subcategories for selected category
  useEffect(() => {
    if (config && selectedCategory && config[selectedCategory]) {
      const subs = getSubcategories(config[selectedCategory], selectedCategory);
      setAvailableSubcategories(subs.map(s => ({ id: s.id, name: s.name })));
      if (subs.length === 1) setValue('subcategory', subs[0].name);
      else setValue('subcategory', '');
      setValue('concept', '');
    } else {
      setAvailableSubcategories([]);
      setAvailableConcepts([]);
    }
  }, [selectedCategory, config, setValue]);

  // Concepts when category (and subcategory if multiple) change
  useEffect(() => {
    if (!config || !selectedCategory || !config[selectedCategory]) {
      setAvailableConcepts([]);
      return;
    }
    const subs = getSubcategories(config[selectedCategory], selectedCategory);
    if (subs.length === 1) {
      setAvailableConcepts(subs[0].concepts.map(c => c.name));
      return;
    }
    const sub = subs.find(s => s.name === selectedSubcategory);
    setAvailableConcepts(sub ? sub.concepts.map(c => c.name) : []);
  }, [selectedCategory, selectedSubcategory, config]);

  const onFormSubmit = (data: any) => {
    const payload = { ...data, type: selectedType, id: initialData?.id };
    if (config && selectedCategory && config[selectedCategory]) {
      const subs = getSubcategories(config[selectedCategory], selectedCategory);
      if (subs.length === 1 && !payload.subcategory) payload.subcategory = subs[0].name;
      if (!payload.concept) payload.concept = payload.subcategory;
    }
    onSubmit(payload);
    if (!initialData) {
      reset();
      setSelectedType("expense");
      setValue("category", "");
      setValue("subcategory", "");
      setValue("concept", "");
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <div className="flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedType("income")}
              className={`flex-1 px-4 py-2 text-sm font-medium border rounded-l-md focus:z-10 focus:ring-2 focus:ring-blue-500 transition-colors ${
                selectedType === "income"
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("expense")}
              className={`flex-1 px-4 py-2 text-sm font-medium border rounded-r-md focus:z-10 focus:ring-2 focus:ring-blue-500 transition-colors ${
                selectedType === "expense"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              Egreso
            </button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            required
            className="bg-background"
            defaultValue={new Date().toISOString().split('T')[0]}
            {...register("date")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="provider">Proveedor (Opcional)</Label>
          <Select onValueChange={(val) => setValue("providerId", val)}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {providers.map((prov) => (
                <SelectItem key={prov.id} value={prov.id}>
                  {prov.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" {...register("providerId")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Sede (Opcional)</Label>
          <Select onValueChange={(val) => setValue("location", val)} defaultValue="Principal">
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Principal">Principal</SelectItem>
              <SelectItem value="Norte">Norte</SelectItem>
              <SelectItem value="Sur">Sur</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" {...register("location")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categoría</Label>
        <Select 
          onValueChange={(val) => {
            setValue("category", val);
            setValue("subcategory", "");
            setValue("concept", "");
          }}
          value={selectedCategory}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Seleccionar categoría" />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" {...register("category", { required: true })} />
      </div>

      {availableSubcategories.length > 1 && (
        <div className="space-y-2">
          <Label>Subcategoría</Label>
          <Select 
            onValueChange={(val) => { setValue("subcategory", val); setValue("concept", ""); }} 
            value={selectedSubcategory || ""}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Seleccionar subcategoría" />
            </SelectTrigger>
            <SelectContent>
              {availableSubcategories.map((s) => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" {...register("subcategory")} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="concept">Concepto (Fila)</Label>
        {availableConcepts.length > 0 ? (
          <Select onValueChange={(val) => setValue("concept", val)} value={watch('concept') || ""}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Seleccionar concepto" />
            </SelectTrigger>
            <SelectContent>
              {availableConcepts.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input 
            id="concept" 
            placeholder="Escribe un concepto..." 
            {...register("concept")} 
            disabled={!selectedCategory}
            className="bg-background"
          />
        )}
        <input type="hidden" {...register("concept", { required: true })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Monto</Label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-gray-500">S/</span>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            className="pl-7 bg-background"
            required
            {...register("amount", { min: 0 })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción (Opcional)</Label>
        <Textarea
          id="description"
          placeholder="Detalles adicionales..."
          className="resize-none bg-background"
          {...register("description")}
        />
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="w-full">
          {initialData ? 'Actualizar Transacción' : 'Registrar Transacción'}
        </Button>
      </div>
    </form>
  );
}