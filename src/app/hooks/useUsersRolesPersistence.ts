import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import type { Role } from '../components/users/types';
import { saveAppUsersToSql, saveRolesToSql } from '../services/repository/businessDomainsSql';
import { isAdminAppUser, syncUserProfilesToSql } from '../services/repository/userProfileSync';
import { getSupabaseClient } from '../services/repository/supabase';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import type { User } from '../types';
import { backupDomainSqlAfterKvSave, ensureSqlSave } from '../utils/sqlAutosaveBackup';
import { dequeueSqlRetry } from '../services/repository/sqlRetryQueue';
import {
  autosaveKvDomain,
  persistKvDomainNow,
  type CloudSyncTracker,
} from '../utils/kvDomainPersistence';
import { sanitizeUsersForCloud } from '../utils/sanitizeUsersForCloud';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();

export type UseUsersRolesPersistenceOptions = {
  isDataLoaded: boolean;
  canSaveUsers: boolean;
  /** Solo administradores pueden escribir app_users / roles en SQL (RLS). */
  canWriteUsersRoles: boolean;
  users: User[];
  roles: Role[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  setRoles: Dispatch<SetStateAction<Role[]>>;
  setCanSaveUsers: Dispatch<SetStateAction<boolean>>;
  usersHydratedRef: MutableRefObject<boolean>;
  rolesHydratedRef: MutableRefObject<boolean>;
  skipUsersHydrateRef: MutableRefObject<boolean>;
  skipRolesHydrateRef: MutableRefObject<boolean>;
  usersChainRef: MutableRefObject<Promise<unknown>>;
  usersLatestRef: MutableRefObject<User[]>;
  usersCooldownRef: MutableRefObject<number>;
  rolesChainRef: MutableRefObject<Promise<unknown>>;
  rolesLatestRef: MutableRefObject<Role[]>;
  rolesCooldownRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  cloudSync: CloudSyncTracker;
};

export function useUsersRolesPersistence(options: UseUsersRolesPersistenceOptions) {
  const {
    isDataLoaded,
    canSaveUsers,
    canWriteUsersRoles,
    users,
    roles,
    setUsers,
    setRoles,
    setCanSaveUsers,
    usersHydratedRef,
    rolesHydratedRef,
    skipUsersHydrateRef,
    skipRolesHydrateRef,
    usersChainRef,
    usersLatestRef,
    usersCooldownRef,
    rolesChainRef,
    rolesLatestRef,
    rolesCooldownRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync,
  } = options;

  const persistUsersToCloud = useCallback(
    async (list: User[]) => {
      if (!isDataLoaded || !usersHydratedRef.current) {
        toast.error('Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.');
        return false;
      }
      if (!canWriteUsersRoles) {
        toast.error('Solo un administrador puede modificar la lista de usuarios.');
        return false;
      }
      const clean = sanitizeUsersForCloud(list);
      usersLatestRef.current = clean;

      if (PRODUCTION_USE_SQL && canWriteUsersRoles) {
        const { data: sess } = await getSupabaseClient().auth.getSession();
        const sqlOk = await ensureSqlSave(
          true,
          'data:users',
          () => saveAppUsersToSql(getSupabaseClient(), clean, sess.session?.user?.id ?? null),
          lastSaveErrorAtRef
        );
        if (!sqlOk) return false;
      }

      const ok = await persistKvDomainNow({
        kvKey: 'data:users',
        payload: clean,
        refs: {
          hydratedFromKvRef: usersHydratedRef,
          skipHydrateRef: skipUsersHydrateRef,
          cooldownUntilRef: usersCooldownRef,
          chainRef: usersChainRef,
          latestRef: usersLatestRef,
        },
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        errorMessage: 'No se pudo guardar la lista de usuarios en la nube. Revisa conexión y vuelve a intentar.',
        sync: cloudSync,
      });
      if (ok) {
        setCanSaveUsers(true);
        if ((import.meta.env.VITE_BACKEND ?? 'supabase') === 'supabase') {
          const { data: sess } = await getSupabaseClient().auth.getSession();
          const authId = sess.session?.user?.id;
          const actor = authId ? clean.find((u) => u.id === authId) : undefined;
          void syncUserProfilesToSql(getSupabaseClient(), clean, {
            authUserId: authId,
            isAdmin: isAdminAppUser(actor),
          });
        }
        return true;
      }
      return false;
    },
    [isDataLoaded, cloudSync, canWriteUsersRoles]
  );

  const handleUpdateRoles = useCallback(
    async (nextRoles: Role[]) => {
      setRoles(nextRoles);
      if (!isDataLoaded || !rolesHydratedRef.current) {
        toast.error('Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.');
        return false;
      }
      if (!canWriteUsersRoles) {
        toast.error('Solo un administrador puede modificar la configuración de roles.');
        return false;
      }
      rolesLatestRef.current = nextRoles;

      if (PRODUCTION_USE_SQL) {
        const { data: sess } = await getSupabaseClient().auth.getSession();
        const sqlOk = await ensureSqlSave(
          true,
          'data:roles',
          () => saveRolesToSql(getSupabaseClient(), nextRoles, sess.session?.user?.id ?? null),
          lastSaveErrorAtRef
        );
        if (!sqlOk) return false;
      }

      return persistKvDomainNow({
        kvKey: 'data:roles',
        payload: nextRoles,
        refs: {
          hydratedFromKvRef: rolesHydratedRef,
          skipHydrateRef: skipRolesHydrateRef,
          cooldownUntilRef: rolesCooldownRef,
          chainRef: rolesChainRef,
          latestRef: rolesLatestRef,
        },
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        errorMessage: 'No se pudo guardar la configuración de roles en la nube.',
        sync: cloudSync,
      });
    },
    [isDataLoaded, setRoles, cloudSync, canWriteUsersRoles]
  );

  useEffect(() => {
    if (canWriteUsersRoles) return;
    dequeueSqlRetry('data:users');
    dequeueSqlRetry('data:roles');
  }, [canWriteUsersRoles]);

  useEffect(() => {
    if (!isDataLoaded || !usersHydratedRef.current || !canSaveUsers || !canWriteUsersRoles) return;
    const cleanUsers = sanitizeUsersForCloud(users);
    void autosaveKvDomain({
      kvKey: 'data:users',
      payload: cleanUsers,
      refs: {
        chainRef: usersChainRef,
        latestRef: usersLatestRef,
        cooldownUntilRef: usersCooldownRef,
      },
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      errorMessage: 'No se pudo guardar la lista de usuarios en la nube. Revisa conexión y vuelve a intentar.',
      sync: cloudSync,
    }).then((ok) => {
      if (ok) {
        void backupDomainSqlAfterKvSave(
          PRODUCTION_USE_SQL,
          'data:users',
          cleanUsers,
          saveAppUsersToSql,
          lastSaveErrorAtRef
        );
      }
    });
  }, [users, isDataLoaded, canSaveUsers, canWriteUsersRoles]);

  useEffect(() => {
    if (!isDataLoaded || !rolesHydratedRef.current || !canWriteUsersRoles) return;
    void autosaveKvDomain({
      kvKey: 'data:roles',
      payload: roles,
      refs: {
        chainRef: rolesChainRef,
        latestRef: rolesLatestRef,
        cooldownUntilRef: rolesCooldownRef,
      },
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      errorMessage: 'No se pudo guardar la configuración de roles en la nube.',
      sync: cloudSync,
    }).then((ok) => {
      if (ok) {
        void backupDomainSqlAfterKvSave(
          PRODUCTION_USE_SQL,
          'data:roles',
          roles,
          saveRolesToSql,
          lastSaveErrorAtRef
        );
      }
    });
  }, [roles, isDataLoaded, canWriteUsersRoles]);

  return { persistUsersToCloud, handleUpdateRoles };
}
