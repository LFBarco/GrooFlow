import { describe, expect, it } from 'vitest';
import type { User } from '../../types';

function canUserAccessSede(user: User, sede: string): boolean {
  if (user.role === 'super_admin' || user.allSedes) return true;
  if (!user.sedes || user.sedes.length === 0) return true;
  return user.sedes.includes(sede);
}

function createUserRecord(data: Partial<User>): { valid: boolean; user?: User; error?: string } {
  if (!data.name || !data.name.trim()) return { valid: false, error: 'El nombre es obligatorio' };
  if (!data.role) return { valid: false, error: 'El rol es obligatorio' };

  const initials = data.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const newUser: User = {
    id: data.id || `u-${Date.now()}`,
    name: data.name.trim(),
    initials,
    role: data.role,
    email: data.email?.trim(),
    sedes: data.sedes || [],
    allSedes: data.role === 'super_admin' || data.allSedes === true,
    status: data.status || 'active',
  };

  return { valid: true, user: newUser };
}

describe('User Manager Module', () => {
  const superAdmin: User = { id: 'u1', name: 'Super Admin', initials: 'SA', role: 'super_admin', allSedes: true };
  const manager: User = { id: 'u2', name: 'Sede Manager', initials: 'SM', role: 'manager', sedes: ['Principal', 'Surco'] };

  it('permite a super_admin acceder a cualquier sede', () => {
    expect(canUserAccessSede(superAdmin, 'La Molina')).toBe(true);
  });

  it('valida acceso de manager solo a las sedes asignadas', () => {
    expect(canUserAccessSede(manager, 'Principal')).toBe(true);
    expect(canUserAccessSede(manager, 'La Molina')).toBe(false);
  });

  it('crea usuario con iniciales generadas automáticamente', () => {
    const res = createUserRecord({ name: 'Pedro Barco', role: 'analyst', email: 'pbarco@vet.com' });
    expect(res.valid).toBe(true);
    expect(res.user?.initials).toBe('PB');
    expect(res.user?.allSedes).toBe(false);
  });

  it('rechaza creación de usuario sin nombre', () => {
    const res = createUserRecord({ role: 'manager' });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('nombre es obligatorio');
  });
});
