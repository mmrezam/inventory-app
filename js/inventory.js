/* ==========================================================================
   Inventory/product domain
   ========================================================================== */

const find = id => products.find(p => p.id === id);
const getStore = sId => stores.find(s => s.id === sId) || { id: sId, name: sId };
const storeName = sId => getStore(sId).name;

const isLow = p => p.stock < LOW_STOCK;

/* استخراج خودکار فروشگاه‌هایی که فروشنده فعال دارند */
const getActiveStores = () => stores.filter(st => users.some(u => u.role === 'seller' && u.storeId === st.id && u.status !== 'pending'));

/* فقط کالاهای فروشگاه‌های دارای صاحب نمایش داده شوند */
const visible = () => {
  const activeStoreIds = getActiveStores().map(s => s.id);
  const activeProds = products.filter(p => activeStoreIds.includes(p.storeId));
  
  if (isSeller()) return activeProds.filter(p => p.storeId === currentUser.storeId);
  if (isCustomer()) return activeProds.filter(p => storeFilter === 'all' || p.storeId === storeFilter);
  return activeProds;
};

function recordTransaction(productId, storeId, type, quantity, reason, delta = quantity) {
  const allowedTypes = new Set(['in', 'sale', 'return', 'waste', 'adjustment']);
  if (!allowedTypes.has(type)) return null;
  const qty = Math.abs(Number(quantity) || 0);
  const tx = {
    id: uid('tx'),
    productId,
    storeId,
    type,
    quantity: qty,
    delta: Number(delta) || 0,
    reason: String(reason || ''),
    userId: currentUser.id,
    createdAt: nowISO()
  };
  inventoryTransactions.unshift(tx);
  return tx;
}

const same = (p, d) => d.stock.trim() !== '' && Number(d.stock) === p.stock && d.category === p.category && d.subcategory === p.subcategory;
const draftOf = p => drafts[p.id] || { stock: String(p.stock), category: p.category, subcategory: p.subcategory };

function commit(id) {
  const p = find(id), d = drafts[id];
  if (!p || !d || !canAccessProduct(p)) return 'none';
  const stock = Number(d.stock);
  if (d.stock.trim() === '' || !isFinite(stock) || stock < 0) return 'invalid';
  const changes = [];
  if (stock !== p.stock) {
    recordTransaction(p.id, p.storeId, 'adjustment', stock - p.stock, 'تغییر مستقیم موجودی');
    changes.push(`موجودی از ${p.stock} به ${stock}`);
    p.stock = stock;
  }
  if (d.category !== p.category || d.subcategory !== p.subcategory) {
    changes.push(`دسته‌بندی به (${d.category} / ${d.subcategory})`);
    p.category = d.category; p.subcategory = d.subcategory;
  }
  delete drafts[id];
  log('edit', `ویرایش مشخصات "${p.name}": ${changes.join(' و ')}`, p.storeId);
  return 'ok';
}
