/* ==========================================================================
   Application data persistence and audit logging
   Depends on: storage.js + state.js
   ========================================================================== */

const persistState = () => {
  try {
    if (currentUser.id !== 'guest') carts[currentUser.id] = cart;
    const payload = {
      inventoryData: products,
      inventoryLogs: logs,
      inventoryLogArchive: logArchive,
      inventoryStores: stores,
      inventoryUsers: users,
      inventoryOrders: orders,
      inventorySales: sales,
      inventoryTransactions,
      customerCarts: carts
    };
    Object.entries(payload).forEach(([key, value]) => {
      if (!save(key, value)) throw new Error('storage');
    });
    if (!setSession('sessionUser', currentUser.id)) throw new Error('session');
    return true;
  } catch (err) {
    toast('ذخیره‌سازی با خطا مواجه شد؛ حافظه محلی را بررسی کنید.', 'var(--danger)');
    return false;
  }
};

function log(type, message, storeId = '', buyerInfo = null) {
  logs.unshift({
    id: Date.now() + Math.random(),
    type,
    message,
    time: new Date().toLocaleString('fa-IR'),
    by: currentUser.name,
    uid: currentUser.id,
    role: currentUser.role,
    storeId: storeId || currentUser.storeId || '',
    buyerInfo
  });
  if (logs.length > 500) logArchive.push(...logs.splice(500));
  persistState();
}
