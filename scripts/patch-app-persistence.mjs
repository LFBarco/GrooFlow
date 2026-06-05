import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = path.join(root, 'src/app/App.tsx');
const text = fs.readFileSync(p, 'utf8');

const markerStart = '  useEffect(() => {\n    if (!isDataLoaded || !invoicesHydratedFromKvRef.current) return;';
const fleetMarker = '  useEffect(() => {\n    if (!isDataLoaded || !fleetHydratedFromKvRef.current) return;';

const j0 = text.indexOf(markerStart);
const j1 = text.indexOf(fleetMarker);
if (j0 < 0 || j1 < 0) {
  console.error('Markers not found', { j0, j1 });
  process.exit(1);
}

const replacement = `  const { handleUpdateProviders } = useProvidersPersistence({
    isDataLoaded,
    providers,
    setProviders,
    cloudHydrationDoneRef: providersCloudHydrationDoneRef,
    hydratedRef: providersHydratedFromKvRef,
    skipHydrateRef: skipProvidersHydrateRef,
    chainRef: providersKvChainRef,
    latestRef: providersKvLatestRef,
    cooldownUntilRef: providersKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  });

  const { persistUsersToCloud, handleUpdateRoles } = useUsersRolesPersistence({
    isDataLoaded,
    canSaveUsers,
    users,
    roles,
    setUsers,
    setRoles,
    setCanSaveUsers,
    usersHydratedRef: usersHydratedFromKvRef,
    rolesHydratedRef: rolesHydratedFromKvRef,
    skipUsersHydrateRef,
    skipRolesHydrateRef,
    usersChainRef: usersKvChainRef,
    usersLatestRef: usersKvLatestRef,
    usersCooldownRef: usersKvCooldownUntilRef,
    rolesChainRef: rolesKvChainRef,
    rolesLatestRef: rolesKvLatestRef,
    rolesCooldownRef: rolesKvCooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync: cloudSyncTrackerRef.current,
  });

  useOperationalDomainsPersistence({
    isDataLoaded,
    cloudSync: cloudSyncTrackerRef.current,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    invoices,
    invoicesRefs: {
      chainRef: invoicesKvChainRef,
      latestRef: invoicesKvLatestRef,
      cooldownUntilRef: invoicesKvCooldownUntilRef,
    },
    invoicesHydratedRef: invoicesHydratedFromKvRef,
    requests,
    requestsRefs: {
      chainRef: requestsKvChainRef,
      latestRef: requestsKvLatestRef,
      cooldownUntilRef: requestsKvCooldownUntilRef,
    },
    requestsHydratedRef: requestsHydratedFromKvRef,
    chartOfAccounts,
    chartRefs: {
      chainRef: chartOfAccountsKvChainRef,
      latestRef: chartOfAccountsKvLatestRef,
      cooldownUntilRef: chartOfAccountsKvCooldownUntilRef,
    },
    chartHydratedRef: chartOfAccountsHydratedFromKvRef,
    products,
    productsRefs: {
      chainRef: productsKvChainRef,
      latestRef: productsKvLatestRef,
      cooldownUntilRef: productsKvCooldownUntilRef,
    },
    productsHydratedRef: productsHydratedFromKvRef,
    feeReceipts,
    feeReceiptsRefs: {
      chainRef: feeReceiptsKvChainRef,
      latestRef: feeReceiptsKvLatestRef,
      cooldownUntilRef: feeReceiptsKvCooldownUntilRef,
    },
    feeReceiptsHydratedRef: feeReceiptsHydratedFromKvRef,
    alertThresholds,
    alertRefs: {
      chainRef: alertThresholdsKvChainRef,
      latestRef: alertThresholdsKvLatestRef,
      cooldownUntilRef: alertThresholdsKvCooldownUntilRef,
    },
    alertHydratedRef: alertThresholdsHydratedFromKvRef,
    theme,
    themeRefs: {
      chainRef: themeKvChainRef,
      latestRef: themeKvLatestRef,
      cooldownUntilRef: themeKvCooldownUntilRef,
    },
    themeHydratedRef: themeHydratedFromKvRef,
    treasuryInvoices,
    treasuryInvoicesRefs: {
      chainRef: treasuryInvoicesKvChainRef,
      latestRef: treasuryInvoicesKvLatestRef,
      cooldownUntilRef: treasuryKvCooldownUntilRef,
    },
    treasuryBankBalance,
    treasuryBankBalanceRefs: {
      chainRef: treasuryBankBalanceKvChainRef,
      latestRef: treasuryBankBalanceKvLatestRef,
      cooldownUntilRef: treasuryKvCooldownUntilRef,
    },
    treasuryPaidHistory,
    treasuryPaidHistoryRefs: {
      chainRef: treasuryPaidHistoryKvChainRef,
      latestRef: treasuryPaidHistoryKvLatestRef,
      cooldownUntilRef: treasuryKvCooldownUntilRef,
    },
    treasuryHydratedRef: treasuryHydratedFromKvRef,
    treasuryBankBalanceLoadedRef: treasuryBankBalanceLoadedFromKvRef,
  });

`;

const out = text.slice(0, j0) + replacement + text.slice(j1);
fs.writeFileSync(p, out, 'utf8');
console.log('Patched persistence block');
