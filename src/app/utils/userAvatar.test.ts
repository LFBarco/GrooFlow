import { describe, expect, it } from 'vitest';

import { getUserAvatarSrc } from './userAvatar';

describe('userAvatar', () => {
  it('usa avatarUrl personalizado si existe', () => {
    expect(
      getUserAvatarSrc({
        id: '1',
        name: 'A',
        initials: 'A',
        role: 'manager',
        avatarUrl: 'data:image/jpeg;base64,abc',
      })
    ).toBe('data:image/jpeg;base64,abc');
  });

  it('retorna vacio sin avatarUrl para mostrar iniciales', () => {
    const src = getUserAvatarSrc({
      id: '1',
      name: 'A',
      initials: 'A',
      role: 'manager',
      email: 'user@test.com',
    });
    expect(src).toBe('');
  });
});
