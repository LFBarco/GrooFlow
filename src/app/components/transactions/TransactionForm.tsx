import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { TransactionType, type BankAccountConfig, type Provider } from "../../types";
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
import { formatDateInputValue, parseTransactionDate } from "../../utils/transactionDate";
import { formatBankAccountLabel, getPrimaryBankAccount } from "../../utils/bankAccounts";

interface TransactionFormProps {
  onSubmit: (data: any) => void;
  config?: ConfigStructure;
  providers?: Provider[];
  bankAccounts?: BankAccountConfig[];
  sedesCatalog?: string[];
  initialData?: any;
  onCancel?: () => void;
}

export function TransactionForm({
  onSubmit,
  config,
  providers = [],
  bankAccounts = [],
  sedesCatalog = [],
  initialData,
  onCancel,
}: TransactionFormProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const [selectedType, setSelectedType] = useState<TransactionType>("expense");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableSubcategories, setAvailableSubcategories] = useState<{ id: string; name: string }[]>([]);
  const [availableConcepts, setAvailableConcepts] = useState<string[]>([]);

  const selectedCategory = watch("category");
  const selectedSubcategory = watch("subcategory");
  const selectedAccountId = watch("account");
  const sedeOptions = useMemo(
    () => (sedesCatalog.length > 0 ? sedesCatalog : []),
    [sedesCatalog]
  );
  const primaryAccount = useMemo(() => getPrimaryBankAccount(bankAccounts), [bankAccounts]);
  const selectedBankAccount = useMemo(
    () => bankAccounts.find((a) => a.id === selectedAccountId),
    [bankAccounts, selectedAccountId]
  );
  const amountSymbol = selectedBankAccount?.currency === "USD" ? "$" : "S/";

  // Load initial data
  useEffect(() => {
    if (initialData) {
      setValue("amount", initialData.amount);
      setValue("description", initialData.description);
      setValue("providerId", initialData.providerId);
      setValue("location", initialData.location);
      setValue("operation", initialData.operation);
      setValue("reference", initialData.reference);
      setValue("account", initialData.account);
      setValue("currency", initialData.currency);

      setValue("date", formatDateInputValue(parseTransactionDate(initialData.date)));

      if (initialData.type) {
        setSelectedType(initialData.type);
      }

      setTimeout(() => {
        if (initialData.category) setValue("category", initialData.category);
        setTimeout(() => {
          if (initialData.subcategory) setValue("subcategory", initialData.subcategory);
          if (initialData.concept) setValue("concept", initialData.concept);
          else if (initialData.subcategory && !initialData.concept)
            setValue("concept", initialData.subcategory);
        }, 50);
      }, 50);
    } else if (primaryAccount) {
      setValue("account", primaryAccount.id);
      setValue("currency", primaryAccount.currency);
    }
  }, [initialData, primaryAccount, setValue]);

  useEffect(() => {
    if (selectedBankAccount) {
      setValue("currency", selectedBankAccount.currency);
    }
  }, [selectedBankAccount, setValue]);

  // Filter categories based on selected Type (Income/Expense)
  useEffect(() => {
    if (config) {
      const filtered = Object.entries(config)
        .filter(([_, def]) => def.type === selectedType)
        .map(([key]) => key);
      setAvailableCategories(filtered);

      let autoSelectCategory = "";

      if (selectedType === "income" && filtered.includes("Ingresos")) {
        autoSelectCategory = "Ingresos";
      } else if (filtered.length === 1) {
        autoSelectCategory = filtered[0];
      }

      if (autoSelectCategory) {
        const currentIsValid = selectedCategory && filtered.includes(selectedCategory);
        if (!currentIsValid && selectedCategory !== autoSelectCategory) {
          setValue("category", autoSelectCategory);
        }
      } else {
        if (selectedCategory && !filtered.includes(selectedCategory)) {
          setValue("category", "");
          setValue("subcategory", "");
          setValue("concept", "");
        }
      }
    }
  }, [selectedType, config, setValue, selectedCategory]);

  useEffect(() => {
    if (config && selectedCategory && config[selectedCategory]) {
      const subs = getSubcategories(config[selectedCategory], selectedCategory);
      setAvailableSubcategories(subs.map((s) => ({ id: s.id, name: s.name })));
      if (subs.length === 1) setValue("subcategory", subs[0].name);
      else if (!initialData) setValue("subcategory", "");
      if (!initialData) setValue("concept", "");
    } else {
      setAvailableSubcategories([]);
      setAvailableConcepts([]);
    }
  }, [selectedCategory, config, setValue, initialData]);

  useEffect(() => {
    if (!config || !selectedCategory || !config[selectedCategory]) {
      setAvailableConcepts([]);
      return;
    }
    const subs = getSubcategories(config[selectedCategory], selectedCategory);
    if (subs.length === 1) {
      setAvailableConcepts(subs[0].concepts.map((c) => c.name));
      return;
    }
    const sub = subs.find((s) => s.name === selectedSubcategory);
    setAvailableConcepts(sub ? sub.concepts.map((c) => c.name) : []);
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
      if (primaryAccount) {
        setValue("account", primaryAccount.id);
        setValue("currency", primaryAccount.currency);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" data-testid="transaction-form">
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
            defaultValue={formatDateInputValue(new Date())}
            {...register("date")}
          />
        </div>
      </div>

      {bankAccounts.length > 0 && (
        <div className="space-y-2">
          <Label>Cuenta bancaria</Label>
          <Select
            value={selectedAccountId || ""}
            onValueChange={(val) => {
              setValue("account", val);
              const acc = bankAccounts.find((a) => a.id === val);
              if (acc) setValue("currency", acc.currency);
            }}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Seleccionar cuenta..." />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {formatBankAccountLabel(acc)}
                  {acc.isPrimary ? " · Principal" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" {...register("account")} />
          <input type="hidden" {...register("currency")} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="provider">Proveedor (Opcional)</Label>
          <Select
            onValueChange={(val) => setValue("providerId", val)}
            defaultValue={initialData?.providerId}
          >
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
          <Select
            onValueChange={(val) => setValue("location", val)}
            defaultValue={initialData?.location || sedeOptions[0]}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {sedeOptions.map((sede) => (
                <SelectItem key={sede} value={sede}>
                  {sede}
                </SelectItem>
              ))}
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
          <SelectTrigger className="w-full bg-background" data-testid="transaction-category">
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
            onValueChange={(val) => {
              setValue("subcategory", val);
              setValue("concept", "");
            }}
            value={selectedSubcategory || ""}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Seleccionar subcategoría" />
            </SelectTrigger>
            <SelectContent>
              {availableSubcategories.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" {...register("subcategory")} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="concept">Concepto (Fila)</Label>
        {availableConcepts.length > 0 ? (
          <Select onValueChange={(val) => setValue("concept", val)} value={watch("concept") || ""}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Seleccionar concepto" />
            </SelectTrigger>
            <SelectContent>
              {availableConcepts.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="concept"
            data-testid="transaction-concept-input"
            placeholder="Escribe un concepto..."
            {...register("concept")}
            disabled={!selectedCategory}
            className="bg-background"
          />
        )}
        <input type="hidden" {...register("concept", { required: true })} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Monto</Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">{amountSymbol}</span>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="pl-9 bg-background"
              required
              {...register("amount", { min: 0 })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="operation">Nro Operación</Label>
          <Input
            id="operation"
            placeholder="Ej. 001-234567"
            className="bg-background"
            {...register("operation")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reference">Referencia</Label>
        <Input
          id="reference"
          placeholder="Referencia bancaria o interna"
          className="bg-background"
          {...register("reference")}
        />
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
        <Button type="submit" className="w-full" data-testid="transaction-submit">
          {initialData ? "Actualizar Transacción" : "Registrar Transacción"}
        </Button>
      </div>
    </form>
  );
}
