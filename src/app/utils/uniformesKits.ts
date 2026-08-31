import type {
  UniformDeliveryItem,
  UniformItemType,
  UniformKit,
  UniformKitItem,
} from '../types/uniformes';

export function newUniformKitId(): string {
  return `kit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultUniformKits(): UniformKit[] {
  return [
    {
      id: 'kit_grooming',
      name: 'Kit Grooming',
      workArea: 'Grooming / Peluquería',
      items: [
        { itemType: 'polo', quantity: 2, defaultSize: 'M' },
        { itemType: 'pantalon', quantity: 2, defaultSize: '32' },
        { itemType: 'delantal_grooming', quantity: 1, defaultSize: 'M' },
        { itemType: 'zapatos_seguridad', quantity: 1, defaultSize: '38' },
      ],
    },
    {
      id: 'kit_medico',
      name: 'Kit Área Médica',
      workArea: 'Área Médica',
      items: [
        { itemType: 'bata_medica', quantity: 2, defaultSize: 'M' },
        { itemType: 'pantalon', quantity: 2, defaultSize: '32' },
        { itemType: 'zapatos_seguridad', quantity: 1, defaultSize: '38' },
        { itemType: 'cofia', quantity: 2, defaultSize: 'Único' },
      ],
    },
    {
      id: 'kit_recepcion',
      name: 'Kit Recepción',
      workArea: 'Recepción / Counter',
      items: [
        { itemType: 'polo', quantity: 2, defaultSize: 'M' },
        { itemType: 'pantalon', quantity: 2, defaultSize: '32' },
        { itemType: 'chaleco', quantity: 1, defaultSize: 'M' },
      ],
    },
    {
      id: 'kit_mantenimiento',
      name: 'Kit Mantenimiento',
      workArea: 'Mantenimiento',
      items: [
        { itemType: 'polo', quantity: 2, defaultSize: 'L' },
        { itemType: 'pantalon', quantity: 2, defaultSize: '34' },
        { itemType: 'zapatos_seguridad', quantity: 1, defaultSize: '40' },
        { itemType: 'guantes', quantity: 2, defaultSize: 'Único' },
      ],
    },
  ];
}

export function mergeUniformKits(kits?: UniformKit[] | null): UniformKit[] {
  const defaults = defaultUniformKits();
  if (!Array.isArray(kits) || kits.length === 0) return defaults;
  return kits;
}

function resolveSize(
  itemType: UniformItemType,
  kitItem: UniformKitItem,
  userSizes?: Partial<Record<string, string>>
): string {
  return userSizes?.[itemType] ?? kitItem.defaultSize ?? 'M';
}

export function buildItemsFromKit(
  kit: UniformKit,
  userSizes?: Partial<Record<string, string>>
): UniformDeliveryItem[] {
  return kit.items.map((item) => ({
    itemType: item.itemType,
    quantity: item.quantity,
    size: resolveSize(item.itemType, item, userSizes),
    color: '',
  }));
}

export function findMatchingKit(
  kits: UniformKit[],
  input: { jobTitle?: string; workArea?: string }
): UniformKit | undefined {
  const job = input.jobTitle?.trim().toLowerCase() ?? '';
  const area = input.workArea?.trim().toLowerCase() ?? '';

  const byJob = kits.find((k) => k.jobTitle && job.includes(k.jobTitle.toLowerCase()));
  if (byJob) return byJob;

  const byArea = kits.find(
    (k) => k.workArea && area.includes(k.workArea.toLowerCase().slice(0, 8))
  );
  if (byArea) return byArea;

  return kits.find((k) => k.workArea && k.workArea.toLowerCase() === area);
}

export function upsertUniformKit(kits: UniformKit[], kit: UniformKit): UniformKit[] {
  const rest = kits.filter((k) => k.id !== kit.id);
  return [kit, ...rest];
}

export function removeUniformKit(kits: UniformKit[], kitId: string): UniformKit[] {
  return kits.filter((k) => k.id !== kitId);
}
