import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import type { Role } from '../components/users/types';
import {
  canAuditPettyCashFunds,
  canRegisterPettyCashForOthers,
  canViewAllPettyCashFunds,
  filterPettyCashTransactionsForViewer,
  isContabilidadPettyCashProfile,
} from './pettyCashAccess';
import { canAdminFundTopUp, canApprovePettyCashMovements } from './pettyCashAudit';
import { canSelectMultiplePettyCashCustodians } from './pettyCashCustodianVisibility';

function user(partial: Partial<User> & Pick<User, 'id' | 'name' | 'role'>): User {
  return {
    initials: 'XX',
    email: `${partial.id}@test.local`,
    status: 'active',
    ...partial,
  };
}

describe('pettyCashAccess', () => {
  it('responsable no ve todos los fondos', () => {
    const u = user({ id: '1', name: 'Iris', role: 'groomer', nivelNombre: 'Encargado de Sede' });
    expect(canViewAllPettyCashFunds(u)).toBe(false);
    expect(canSelectMultiplePettyCashCustodians(u)).toBe(false);
    expect(canAuditPettyCashFunds(u)).toBe(false);
  });

  it('Contabilidad ve fondos pero no aprueba', () => {
    const u = user({ id: '2', name: 'Conta', role: 'groomer', nivelNombre: 'Contabilidad' });
    expect(canViewAllPettyCashFunds(u)).toBe(true);
    expect(canSelectMultiplePettyCashCustodians(u)).toBe(true);
    expect(canApprovePettyCashMovements(u)).toBe(false);
    expect(canAdminFundTopUp(u)).toBe(false);
  });

  it('Contabilidad por menú Gestión (sin nivelNombre) puede registrar por otros', () => {
    const u = user({ id: 'c1', name: 'Carhim', role: 'groomer' });
    const menu = { Contabilidad: true, 'Caja Chica': true };
    expect(isContabilidadPettyCashProfile(u, [], menu)).toBe(true);
    expect(canViewAllPettyCashFunds(u, [], menu)).toBe(true);
    expect(canRegisterPettyCashForOthers(u, [], menu)).toBe(true);
    expect(canApprovePettyCashMovements(u, [], menu)).toBe(false);
    expect(isContabilidadPettyCashProfile(u, [], { Contabilidad: true })).toBe(true);
  });

  it('Jefes y Gerencia ven fondos', () => {
    expect(
      canViewAllPettyCashFunds(user({ id: '3', name: 'J', role: 'groomer', nivelNombre: 'Jefes' }))
    ).toBe(true);
    expect(
      canViewAllPettyCashFunds(user({ id: '4', name: 'G', role: 'groomer', nivelNombre: 'Gerencia' }))
    ).toBe(true);
    expect(canViewAllPettyCashFunds(user({ id: '5', name: 'M', role: 'manager' }))).toBe(true);
  });

  it('Auditoría aprueba, dota y refuerza', () => {
    const u = user({ id: '6', name: 'Aud', role: 'auditoria', nivelNombre: 'Auditoría' });
    expect(canViewAllPettyCashFunds(u)).toBe(true);
    expect(canApprovePettyCashMovements(u)).toBe(true);
    expect(canAdminFundTopUp(u)).toBe(true);
  });

  it('Auditoría y Contabilidad pueden registrar gastos por otros', () => {
    expect(
      canRegisterPettyCashForOthers(user({ id: '6', name: 'Aud', role: 'auditoria', nivelNombre: 'Auditoría' }))
    ).toBe(true);
    expect(
      canRegisterPettyCashForOthers(user({ id: '2', name: 'Conta', role: 'groomer', nivelNombre: 'Contabilidad' }))
    ).toBe(true);
    expect(
      canRegisterPettyCashForOthers(user({ id: '1', name: 'Iris', role: 'groomer', nivelNombre: 'Encargado de Sede' }))
    ).toBe(false);
    expect(
      canRegisterPettyCashForOthers(user({ id: '3', name: 'J', role: 'groomer', nivelNombre: 'Jefes' }))
    ).toBe(false);
  });

  it('filtra movimientos por custodio para no elevados', () => {
    const viewer = user({ id: 'u1', name: 'A', role: 'groomer' });
    const txs = [
      { id: 'a', custodianId: 'u1', location: 'Sede A' },
      { id: 'b', custodianId: 'u2', location: 'Sede A' },
    ];
    const filtered = filterPettyCashTransactionsForViewer(txs, viewer, {
      canSeeSede: () => true,
    });
    expect(filtered.map((t) => t.id)).toEqual(['a']);
  });

  it('rol custom con Auditoría+Caja Chica puede auditar', () => {
    const roles: Role[] = [
      {
        id: 'jefe_audit',
        name: 'Jefe Audit',
        description: '',
        permissions: { Auditoría: true, 'Caja Chica': true },
        color: 'bg-slate-500',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        isSystem: false,
      },
    ];
    const u = user({ id: '7', name: 'X', role: 'jefe_audit' });
    expect(canAuditPettyCashFunds(u, roles)).toBe(true);
  });
});
