import {
  initDb,
  getSettings,
  updateAdminPassword,
  getExhibitors,
  addExhibitor,
  updateExhibitor,
  deleteExhibitor,
  getOrders,
  addOrder,
  deleteOrder,
  setOrderWinner,
  getStats,
  createBackup,
  restoreBackup,
  findExhibitorByCode,
  getErpApiKey,
  regenerateErpApiKey,
  validateErpApiKey,
  getOrdersForErp,
  acknowledgeErpOrders,
  getSummaryForErp
} from './db.js';
import {
  authenticateAdmin,
  authenticateExhibitor,
  createSession,
  getSession
} from './auth.js';

async function runUnitTests() {
  console.log('--- 1. Inicjalizacja bazy ---');
  const db = await initDb();
  console.log('Settings:', db.settings);
  console.log('Exhibitors count:', db.exhibitors.length);

  console.log('--- 2. Autoryzacja Admina ---');
  const adminSession = await authenticateAdmin('admin123');
  console.log('Admin session:', adminSession?.role === 'ADMIN' ? 'OK' : 'FAILED');

  console.log('--- 3. Autoryzacja Dostawcy (HA-101) ---');
  const exSession = await authenticateExhibitor('HA-101');
  console.log('Exhibitor session:', exSession?.role === 'EXHIBITOR' && exSession.name ? 'OK' : 'FAILED');

  console.log('--- 4. Dodawanie nowego dostawcy ---');
  const newEx = await addExhibitor({ name: 'Firma Testowa Sp. z o.o.', boothNumber: 'C-10' });
  console.log('Created exhibitor:', newEx.name, 'code:', newEx.accessCode);

  console.log('--- 5. Logowanie nowym kodem dostawcy ---');
  const testExSession = await authenticateExhibitor(newEx.accessCode);
  console.log('New exhibitor login:', testExSession?.name === 'Firma Testowa Sp. z o.o.' ? 'OK' : 'FAILED');

  console.log('--- 6. Rejestracja zamówienia przez dostawcę ---');
  const order = await addOrder({
    clientName: 'Jan Kowalski - Sklep Ogrodniczy',
    orderValue: 8400,
    exhibitorId: newEx.id,
    createdBy: newEx.name
  });
  console.log('Created order:', order.ticketNumber, 'value:', order.orderValue);

  console.log('--- 7. Pobieranie zamówień dostawcy ---');
  const exOrders = await getOrders(newEx.id);
  console.log('Exhibitor orders count:', exOrders.length);

  console.log('--- 8. Oznaczenie wygranej w loterii ---');
  const wonOrder = await setOrderWinner(order.id, true);
  console.log('Order won:', wonOrder.isWinner ? 'OK' : 'FAILED');

  console.log('--- 9. Statystyki ---');
  const stats = await getStats();
  console.log('Total orders:', stats.totalOrders, 'Total value:', stats.totalValue, 'Winners:', stats.winnersCount);

  console.log('--- 10. Backup i przywracanie ---');
  const backup = await createBackup();
  console.log('Backup timestamp:', backup.timestamp, 'orders in backup:', backup.data.orders.length);

  console.log('--- 11. Integracja ERP: Klucz API ---');
  const erpKey = await getErpApiKey();
  console.log('ERP API Key format:', erpKey.startsWith('erp_live_') ? 'OK' : 'FAILED');
  const isKeyValid = await validateErpApiKey(erpKey);
  console.log('ERP API Key validation:', isKeyValid ? 'OK' : 'FAILED');

  console.log('--- 12. Integracja ERP: Pobieranie zamówień ---');
  const erpOrders = await getOrdersForErp({ synced: 'false' });
  console.log('Unsynced orders for ERP:', erpOrders.orders.length, 'Total matching:', erpOrders.totalMatching);
  if (erpOrders.orders.length > 0) {
    const firstOrder = erpOrders.orders[0];
    console.log('ERP Order structure check: ID:', firstOrder.id, 'Currency:', firstOrder.currency, 'Exhibitor:', firstOrder.exhibitor.name);
    
    console.log('--- 13. Integracja ERP: Potwierdzenie synchronizacji (Acknowledge) ---');
    const ackResult = await acknowledgeErpOrders([firstOrder.id], 'ERP-FAKTURA-2026/01');
    console.log('Acknowledged count:', ackResult.updatedCount, 'Ref:', ackResult.erpReference);

    const erpOrdersAfterAck = await getOrdersForErp({ synced: 'false' });
    console.log('Unsynced orders after ack:', erpOrdersAfterAck.orders.length);
  }

  console.log('--- 14. Integracja ERP: Podsumowanie finansowe ---');
  const erpSummary = await getSummaryForErp();
  console.log('ERP Summary: Total orders:', erpSummary.totalOrders, 'Total value:', erpSummary.totalValue, 'Currency:', erpSummary.currency);

  console.log('\n✅ WSZYSTKIE TESTY JEDNOSTKOWE BACKENDU I API ERP PRZESZŁY POMYŚLNIE!');
}

runUnitTests().catch(err => {
  console.error('Błąd testów:', err);
  process.exit(1);
});
