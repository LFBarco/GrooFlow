import { describe, expect, it } from 'vitest';
import { getUserAvatarSrc, isUsableAvatarUrl } from './userAvatar';
import type { User } from '../types';

describe('userAvatar', () => {
  it('rejects empty and truncated data URLs', () => {
    expect(isUsableAvatarUrl('')).toBe(false);
    expect(isUsableAvatarUrl('data:image/jpeg;base64,abc')).toBe(false);
    expect(isUsableAvatarUrl('data:image/jpeg;base64,' + 'a'.repeat(40))).toBe(false);
  });

  it('accepts https and /uploads paths', () => {
    expect(isUsableAvatarUrl('https://gestionveterinariagroomers.com/uploads/a.jpg')).toBe(true);
    expect(isUsableAvatarUrl('/uploads/usuarios/a.jpg')).toBe(true);
  });

  it('returns empty src when user has no photo (avoids broken <img>)', () => {
    const user: User = {
      id: '168',
      name: 'Anais Villegas',
      initials: 'AV',
      role: 'groomer',
      personalProfile: {},
    };
    expect(getUserAvatarSrc(user)).toBe('');
  });
});
