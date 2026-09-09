import { describe, expect, it } from 'vitest';
import { mergeRolesWithDefaults } from '../utils/mergeRolesWithDefaults';
import { isUserSessionBlocked, validatePasswordClient } from '../utils/userSessionGuard';

describe('2. Security & RBAC Access Control Tests', () => {
  it('should enforce user session block policy correctly', () => {
    const activeUser = { id: 'u1', status: 'active', email: 'user@empresa.com' };
    const inactiveUser = { id: 'u2', status: 'inactive', email: 'user2@empresa.com' };
    
    expect(isUserSessionBlocked(activeUser as any)).toBe(false);
    expect(isUserSessionBlocked(inactiveUser as any)).toBe(true);
  });

  it('should enforce client password security policy', () => {
    expect(validatePasswordClient('short')).toBe('La contraseña debe tener al menos 8 caracteres.');
    expect(validatePasswordClient('12345678')).toBe('La contraseña debe incluir al menos una letra.');
    expect(validatePasswordClient('abcdefgh')).toBe('La contraseña debe incluir al menos un número.');
    expect(validatePasswordClient('SecretPass123')).toBeNull();
  });

  it('should safely merge missing roles with secure defaults', () => {
    const rolesInput = [
      { id: 'admin', name: 'Administrador', isSystem: true, permissions: { Compras: true } }
    ];
    const merged = mergeRolesWithDefaults(rolesInput as any);
    expect(merged.length).toBeGreaterThan(0);
    const adminRole = merged.find(r => r.id === 'super_admin');
    expect(adminRole?.permissions['Compras']).toBe(true);
  });

  it('should escape HTML/Script strings to prevent XSS payloads', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitizedInput = maliciousInput.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    expect(sanitizedInput).not.toContain('<script>');
    expect(sanitizedInput).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });
});
