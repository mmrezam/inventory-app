/* ==========================================================================
   Application controller, rendering, event wiring and bootstrapping
   ========================================================================== */

let toastTimer;
function toast(text, color = 'var(--ok)') {
  const el = $('#toast');
  el.textContent = text; el.style.background = color; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.hidden = true, 3000);
}
/* ==========================================================================
/* ==========================================================================
   ۵. سیستم پیش‌نویس جدول انبار (Drafts & Dirty Checking)
   ========================================================================== */
function syncRow(tr) {
  const id = Number(tr.dataset.id), p = find(id);
  if (!p || !canAccessProduct(p)) return;
  const d = { stock: tr.querySelector('.stock input').value, category: tr.querySelector('.row-cat').value, subcategory: tr.querySelector('.row-subcat').value };
  if (same(p, d)) delete drafts[id]; else drafts[id] = d;
  const isDirty = id in drafts;
  tr.classList.toggle('dirty', isDirty);
  tr.querySelectorAll('.save, .undo').forEach(b => b.hidden = !isDirty);
  updateDirtyBar();
}
function updateDirtyBar() {
  const n = Object.keys(drafts).length;
  $('#dirtyBar').hidden = n === 0;
  $('#dirtyText').textContent = `${fa(n)} ردیف تغییر ثبت‌نشده دارد`;
}
function saveOne(id) {
  if (!can('manageInventory')) return unauthorized();
  const r = commit(id);
  if (r === 'invalid') return toast('خطا: موجودی نامعتبر است', 'var(--danger)');
  persistState(); render();
  toast(`تغییرات "${find(id).name}" ثبت شد ✅`);
}
$('#saveAll').onclick = () => {
  if (!can('manageInventory')) return unauthorized();
  let done = 0, bad = 0;
  Object.keys(drafts).forEach(id => { const r = commit(Number(id)); if (r === 'ok') done++; else if (r === 'invalid') bad++; });
  persistState(); render();
  bad ? toast(`${fa(done)} ردیف ثبت شد؛ ${fa(bad)} مقدار نامعتبر داشت`, 'var(--danger)') : toast(`${fa(done)} ردیف ثبت شد ✅`);
};
$('#undoAll').onclick = () => {
  if (!confirm(`تغییرات ${fa(Object.keys(drafts).length)} ردیف لغو شود؟`)) return;
  Object.keys(drafts).forEach(id => delete drafts[id]);
  render();
};
addEventListener('beforeunload', e => { if (Object.keys(drafts).length) { e.preventDefault(); e.returnValue = ''; } });
/* ==========================================================================
   ۶. متدهای پنل هشدار موجودی اندک و رندرینگ
   ========================================================================== */
function renderLowStockPanel() {
  const items = visible().filter(isLow);
  $('#lowStockPanelTitle').textContent = isSeller()
    ? `⚠️ کالاهای نیازمند شارژ در ${storeName(currentUser.storeId)}`
    : '⚠️ کالاهای نیازمند شارژ فوری (کمتر از ۵ عدد)';
  $('#lowStockPanelContent').innerHTML = items.length
    ? `<div class="low-stock-grid">${items.map(p => `
        <div class="low-stock-item">
          <div class="low-stock-item-info"><b>${esc(p.name)}</b><span>${esc(storeName(p.storeId))} | ${esc(p.category)}</span></div>
          <div class="btn-row">
            <span class="low-stock-badge">${fa(p.stock)} عدد</span>
            ${can('manageInventory') && canAccessProduct(p) ? `<button type="button" class="ok" data-restock="${p.id}" style="padding:4px 10px;font-size:12px">+ شارژ</button>` : ''}
          </div>
        </div>`).join('')}</div>`
    : emptyBlockHTML('✅', 'موجودی‌ها در وضعیت خوبی هستند', 'هیچ کالایی زیر حد هشدار موجودی قرار ندارد.');
}
const setLowPanel = open => {
  $('#lowStockPanel').hidden = !open;
  $('#statLowCard').classList.toggle('open', open);
};
const mine = l => l.uid ? l.uid === currentUser.id : l.by === currentUser.name;
let renderQueued = 0;
function render() {
  if (renderQueued) return;
  renderQueued = requestAnimationFrame(() => {
    renderQueued = 0;
    renderNow();
  });
}
function renderPending() {
  const p = users.filter(u => u.role === 'seller' && u.status === 'pending');
  $('#pendingCard').hidden = !isAdmin() || !p.length;
  $('#pendingList').innerHTML = p.map(u => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span><b>${esc(u.name)}</b> — ${esc(storeName(u.storeId))} <small style="color:var(--muted)">(@${esc(u.username)})</small></span>
      <span class="btn-row">
        <button class="ok" data-pact="approve" data-uid="${esc(u.id)}">تأیید</button>
        <button class="danger" data-pact="reject" data-uid="${esc(u.id)}">رد</button>
      </span>
    </div>
  `).join('');
}
function updateBadges() {
  const pend = isAdmin() ? users.filter(u => u.role === 'seller' && u.status === 'pending').length : 0;
  const fresh = (isAdmin() || isSeller()) ? orders.filter(o => o.status === 'pending' && (isAdmin() || o.storeId === currentUser.storeId)).length : 0;
  const tag = (tab, n) => {
    const el = $(`.menu-item[data-tab="${tab}"]`);
    if (el) el.textContent = el.textContent.replace(/\s*\([۰-۹]+\)$/, '') + (n ? ` (${fa(n)})` : '');
  };
  tag('analytics', pend);
  tag('orders', fresh);
}
/* تابع حذف کاربر از سیستم */
window.deleteUser = function(id) {
  if (!isAdmin()) return unauthorized();
  if (id === currentUser.id || id === 'u_admin') {
    return toast('حذف حساب مدیر ارشد یا حساب پایه امکان‌پذیر نیست!', 'var(--danger)');
  }
  const u = users.find(x => x.id === id);
  if (!u) return;
  if (!confirm(`آیا از حذف کامل حساب "${u.name}" (${u.role === 'seller' ? 'فروشنده' : 'خریدار'}) اطمینان دارید؟`)) return;

  users = users.filter(x => x.id !== id);
  log('delete', `حساب کاربر "${u.name}" با نقش ${u.role} از سیستم حذف شد.`);
  save();
  render();
  toast(`کاربر "${u.name}" با موفقیت حذف شد 🗑️`);
};

/* رندر لیست کاربران با مرتب‌سازی هوشمند */
function renderUsers() {
  if (!isAdmin()) return;

  // ۱. توابع کمکی برای محاسبه موجودی فروشنده و خریدهای قطعی مشتری
  const getSellerStock = (storeId) => products.filter(p => p.storeId === storeId).reduce((sum, p) => sum + p.stock, 0);
  const getCustomerPurchases = (uid) => orders.filter(o => o.uid === uid && o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);

  // ۲. کپی و مرتب‌سازی کاربران (ابتدا بر اساس نقش، سپس بر اساس شاخص مالی)
  const sortedUsers = [...users].sort((a, b) => {
    const weights = { admin: 3, seller: 2, customer: 1, guest: 0 };
    if (weights[a.role] !== weights[b.role]) {
      return weights[b.role] - weights[a.role]; // ادمین > فروشنده > خریدار
    }
    if (a.role === 'seller') {
      return getSellerStock(b.storeId) - getSellerStock(a.storeId); // فروشنده با موجودی بیشتر بالاتر
    }
    if (a.role === 'customer') {
      return getCustomerPurchases(b.id) - getCustomerPurchases(a.id); // خریدار با پرداخت بیشتر بالاتر
    }
    return 0;
  });

  // ۳. رندر ردیف‌ها
  $('#userList').innerHTML = sortedUsers.map((u, i) => {
    const isSelf = u.id === currentUser.id || u.id === 'u_admin';
    
    // اطلاعات تکمیلی زیر نام کاربر
    let extraInfo = '';
    if (u.role === 'seller') extraInfo = `<div style="font-size:11px;color:var(--muted)">موجودی کل انبار: ${fa(getSellerStock(u.storeId))} قلم</div>`;
    if (u.role === 'customer') extraInfo = `<div style="font-size:11px;color:var(--muted)">مجموع خرید قطعی: ${fa(getCustomerPurchases(u.id))} تومان</div>`;

    return `
      <tr>
        <td>${fa(i + 1)}</td>
        <td><b>${esc(u.name)}</b>${extraInfo}</td>
        <td><code>${esc(u.username || '—')}</code></td>
        <td><span class="badge ${u.role === 'admin' ? 'edit' : u.role === 'seller' ? 'sale' : 'add'}">${u.role === 'admin' ? 'مدیر کل' : u.role === 'seller' ? 'فروشنده' : 'خریدار'}</span></td>
        <td>${u.storeId ? esc(storeName(u.storeId)) : '—'}</td>
        <td>${esc(u.phone || '—')}</td>
        <td>
          <div style="display:flex; gap:6px; align-items:center; justify-content:center">
            ${isSelf ? '<small style="color:var(--muted)">حساب پایه (غیرقابل ویرایش)</small>' : `
              <select class="user-role-select" data-uid="${u.id}" style="padding:3px 6px;font-size:12px;width:auto" title="تغییر نقش">
                <option value="customer" ${u.role==='customer'?'selected':''}>خریدار</option>
                <option value="seller" ${u.role==='seller'?'selected':''}>فروشنده</option>
                <option value="admin" ${u.role==='admin'?'selected':''}>مدیر کل</option>
              </select>
              <button type="button" class="danger" style="padding:3px 8px;font-size:13px" onclick="deleteUser('${u.id}')" title="حذف دائمی کاربر">🗑️</button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
function passLogFilters(l) {
  const t = Math.floor(l.id), r = $('#logRange').value;
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  if (r === 'today' && t < day0.getTime()) return false;
  if (r === 'week' && t < Date.now() - 7 * 864e5) return false;
  if (r === 'custom') {
    const f = $('#logFrom').value, to = $('#logTo').value;
    if (f && t < new Date(f + 'T00:00:00').getTime()) return false;
    if (to && t > new Date(to + 'T23:59:59').getTime()) return false;
  }
  const sh = $('#logShopFilter').value;
  if (isAdmin() && sh && sh !== 'all' && l.storeId !== sh) return false;
  const q = $('#logSearch').value.trim().toLowerCase();
  return !q || `${l.message} ${l.by || ''} ${l.buyerInfo ? l.buyerInfo.name : ''}`.toLowerCase().includes(q);
}
/* رندر دکمه‌های ورود سریع بر اساس کاربران موجود در سیستم */
function renderDemoChips() {
  const container = $('#demoChipsContainer');
  if (!container) return;

  const demoAccounts = [
    { u: 'admin', p: 'admin123', label: '👑 مدیر کل' },
    { u: 'seller1', p: '1234', label: '🏪 فروشنده ۱' },
    { u: 'seller2', p: '1234', label: '🏪 فروشنده ۲' },
    { u: 'sara', p: '1234', label: '🛍️ خریدار (سارا)' }
  ];

  const availableChips = demoAccounts
    .filter(demo => users.some(user => user.username === demo.u))
    .map(demo => `<button type="button" class="demo-chip" data-user="${demo.u}" data-pass="${demo.p}">${demo.label}</button>`);

  container.innerHTML = availableChips.join('');
  
  const box = $('#demoHintBox');
  if (box) box.hidden = availableChips.length === 0;
}
/* رندر پنل صندوق فروشگاهی اختصاصی برای فروشنده */
/* رندر پنل صندوق فروشگاهی اختصاصی برای فروشنده */
function renderSellerPOS() {
  const posContainer = $('#sellerPosContainer');
  if (!posContainer) return;

  // اگر کاربر فروشنده نیست، پنل کاملا مخفی شود
  if (!isSeller()) {
    posContainer.style.display = 'none';
    return;
  }

  // نمایش پنل برای فروشنده
  posContainer.style.display = 'grid';

  // استخراج کالاهای همین فروشنده
  const myProds = products.filter(p => p.storeId === currentUser.storeId);

  // تزریق کالاها به دیتالیست (جستجوی هوشمند با قابلیت تایپ)
  const datalist = $('#posProductsDatalist');
  if (datalist) {
    datalist.innerHTML = myProds.map(p => `<option value="${p.name}">موجودی: ${fa(p.stock)} قلم</option>`).join('');
  }
}
function renderNow() {
  renderDemoChips();
  renderSellerPOS(); //
  /* =========================================
   توابع عملیاتی صندوق فروشگاهی (POS)
========================================= */

// تابع ثبت فروش (کسر از انبار)
// تابع ثبت فروش (کسر از انبار و ثبت در درآمد)
// تابع ثبت فروش (کسر از انبار و ثبت در درآمد)
window.posSell = function() {
  const nameInput = $('#posSaleProduct').value.trim();
  const qty = parseInt($('#posSaleQty').value);
  
  if (!nameInput || isNaN(qty) || qty <= 0) {
    return toast('لطفاً نام کالا و تعداد صحیح را وارد کنید!', 'var(--danger)');
  }

  const product = products.find(p => p.name === nameInput && p.storeId === currentUser.storeId);
  
  if (!product) {
    return toast('کالایی با این نام در انبار شما یافت نشد!', 'var(--danger)');
  }
  
  if (qty > product.stock) {
    return toast(`موجودی کافی نیست! فقط ${fa(product.stock)} قلم موجود است.`, 'var(--danger)');
  }

  // کسر موجودی از انبار
  product.stock -= qty;
  
  const customerName = $('#posSaleCustomer').value.trim() || 'مشتری حضوری';

  // ساخت یک فاکتور تایید شده برای ثبت در درآمد سیستم
  if (typeof orders !== 'undefined') {
    orders.push({
      id: 'POS-' + Date.now(),
      storeId: currentUser.storeId,
      buyer: customerName,
      status: 'delivered',
      date: new Date().toISOString(),
      type: 'in-person',
      totalPrice: product.price * qty,
      items: [{
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: qty
      }]
    });
  }

  // ثبت در رویدادها
  log('sale', `فروش حضوری ${fa(qty)} عدد ${product.name} به ${customerName} ثبت شد.`);

  save();
  render();
  toast(`فروش ثبت شد و به درآمد امروز اضافه گردید 🛒`, 'var(--success)');
  
  // پاک کردن فرم
  $('#posSaleProduct').value = '';
  $('#posSaleQty').value = '1';
  $('#posSaleCustomer').value = '';
};

// تابع ثبت خرید (اضافه به انبار)
window.posBuy = function() {
  const nameInput = $('#posBuyProduct').value.trim();
  const qty = parseInt($('#posBuyQty').value);
  
  if (!nameInput || isNaN(qty) || qty <= 0) {
    return toast('لطفاً نام کالا و تعداد صحیح را وارد کنید!', 'var(--danger)');
  }

  const product = products.find(p => p.name === nameInput && p.storeId === currentUser.storeId);
  
  if (!product) {
    return toast('کالایی با این نام در انبار شما یافت نشد!', 'var(--danger)');
  }

  // افزایش موجودی
  product.stock += qty;
  
  const supplier = $('#posBuySupplier').value.trim() || 'نامشخص';
  log('buy', `خرید ${fa(qty)} عدد ${product.name} از تامین‌کننده: ${supplier}.`);

  save();
  render();
  toast(`موجودی انبار با موفقیت شارژ شد 📦`, 'var(--success)');
  
  // پاک کردن فرم
  $('#posBuyProduct').value = '';
  $('#posBuyQty').value = '10';
  $('#posBuySupplier').value = '';
};
  const vis = visible();
  renderOrders();
  renderPending();
  updateBadges();
  renderUsers();
  const total = vis.reduce((s, p) => s + p.price * p.stock, 0);
  const lowItems = vis.filter(isLow);
  $('#dashboardTitle').textContent = isAdmin() ? '📊 داشبورد کلان مدیر سیستم' : isSeller() ? `📊 داشبورد ${storeName(currentUser.storeId)}` : '📊 آمار و گزارش‌ها';
  $('#statCount').textContent = fa(vis.length);
  $('#statValue').textContent = fa(total) + ' تومان';
  $('#statLow').textContent = fa(lowItems.length) + ' قلم';
  const sumTotal = arr => arr.reduce((s, o) => s + o.total, 0);
  const deliveredAll = orders.filter(o => o.status === 'delivered');
  const delivered = deliveredAll.filter(o => isAdmin() || o.storeId === currentUser.storeId);
  const dayOf = o => localDateKey(o.deliveredAt || o.createdAt || '');
  const todayStr = localDateKey(new Date()), monthStr = todayStr.slice(0, 7);
  $('#statTodaySales').textContent = fa(sumTotal(delivered.filter(o => dayOf(o) === todayStr))) + ' تومان';
  $('#statMonthSales').textContent = fa(sumTotal(delivered.filter(o => dayOf(o).startsWith(monthStr)))) + ' تومان';
  $('#statOrderCount').textContent = fa(delivered.length);
  ['#statCount', '#statValue', '#statLow'].forEach(s => $(s).closest('.stat').hidden = isAdmin());
  $$('[data-admin-stat]').forEach(el => el.hidden = !isAdmin());
  $('#catCard').hidden = isAdmin() || isCustomer();
  $('#storeMetricsCard').hidden = !isAdmin();
  $('#customerRankCard').hidden = !isAdmin();
  if (isAdmin()) {
    $('#statSellerCount').textContent = fa(users.filter(u => u.role === 'seller' && u.status !== 'pending').length);
    $('#statCustomerCount').textContent = fa(users.filter(u => u.role === 'customer').length);
    $('#statTotalSales').textContent = fa(sumTotal(deliveredAll)) + ' تومان';
    const dir = $('#storeRankSort').value === 'asc' ? 1 : -1;
   const rank = getActiveStores().map(st => {
      const os = deliveredAll.filter(o => o.storeId === st.id);
      return { name: st.name, n: os.length, total: sumTotal(os) };
    }).sort((a, b) => dir * (a.total - b.total));
    $('#storeRankList').innerHTML = rank.length
      ? rank.map((r, i) => `<tr><td>${fa(i + 1)}</td><td class="name">${esc(r.name)}</td><td>${fa(r.n)}</td><td><b>${fa(r.total)}</b> تومان</td></tr>`).join('')
      : emptyStateHTML(4, '🏪', 'فروشگاهی ثبت نشده است', 'هنوز فروشگاهی برای مقایسه یا رتبه‌بندی وجود ندارد.');
    const byBuyer = {};
    deliveredAll.forEach(o => {
      const b = byBuyer[o.uid] = byBuyer[o.uid] || { name: (users.find(u => u.id === o.uid) || {}).name || (o.buyer ? o.buyer.name : 'کاربر'), n: 0, total: 0 };
      b.n++; b.total += o.total;
    });
    const top = Object.values(byBuyer).sort((a, b) => b.total - a.total).slice(0, 20);
    $('#customerRankList').innerHTML = top.length
      ? top.map((b, i) => `<tr><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : fa(i + 1)}</td><td class="name">${esc(b.name)}</td><td>${fa(b.n)}</td><td><b>${fa(b.total)}</b> تومان</td></tr>`).join('')
      : emptyStateHTML(4, '⭐', 'هنوز خرید قطعی ثبت نشده است', 'بعد از ثبت و تحویل سفارش‌ها، مشتریان برتر اینجا نمایش داده می‌شوند.');
  }
  renderLowStockPanel();
  if (isAdmin()) setLowPanel(false);
  const byCat = {};
  vis.forEach(p => byCat[p.category] = (byCat[p.category] || 0) + p.price * p.stock);
  $('#catStats').innerHTML = Object.keys(byCat).length
    ? Object.entries(byCat).map(([c, v]) => `<div><strong>${esc(c)}:</strong> ${fa(v)} تومان <span style="color:var(--muted)">(${fa(total ? (v / total * 100).toFixed(1) : 0)}٪)</span></div>`).join('')
    : emptyBlockHTML('📊', 'داده‌ای برای تحلیل وجود ندارد', 'با ثبت کالا و موجودی، ارزش موجودی به تفکیک دسته‌بندی در این بخش نمایش داده می‌شود.');
  $('#total').hidden = isCustomer();
  $('#total').textContent = `ارزش کل انبار: ${fa(total)} تومان | با ۱۰٪ تخفیف: ${fa(total * DISCOUNT)} تومان`;
  const q = $('#search').value.trim().toLowerCase();
  const rows = vis.filter(p => {
    const sMatch = p.name.toLowerCase().includes(q);
    const kMatch = stockFilter === 'all' || isLow(p);
    const cMatch = catFilter === 'all' || p.category === catFilter;
    const subMatch = subFilter === 'all' || p.subcategory === subFilter;
    const stMatch = storeFilter === 'all' || p.storeId === storeFilter;
    return sMatch && kMatch && cMatch && subMatch && stMatch;
  });
  $('#productHead').innerHTML = isCustomer()
    ? '<tr><th>نام کالا</th><th>فروشگاه</th><th>دسته‌بندی</th><th>قیمت واحد</th><th>وضعیت موجودی</th><th>عملیات</th></tr>'
    : '<tr><th>نام محصول</th><th>دسته‌بندی</th><th>قیمت واحد</th><th>موجودی</th><th>عملیات</th></tr>';
  $('#productList').innerHTML = !rows.length
    ? emptyStateHTML(
        isCustomer() ? 6 : 5,
        '📦',
        'هیچ کالایی پیدا نشد',
        q || catFilter !== 'all' || subFilter !== 'all' || storeFilter !== 'all' || stockFilter !== 'all'
          ? 'کلمه کلیدی یا فیلترهای فعلی را تغییر دهید و دوباره امتحان کنید.'
          : (isCustomer() ? 'در حال حاضر کالایی برای نمایش در کاتالوگ وجود ندارد.' : 'برای شروع، یک کالا به انبار اضافه کنید.')
      )
    : isCustomer()
    ? rows.map(p => {
        let stockLabel = '<b style="color:var(--ok)">🟢 موجود</b>';
        if (p.stock <= 0) stockLabel = '<b style="color:var(--danger)">🔴 ناموجود</b>';
        else if (isLow(p)) stockLabel = '<b style="color:var(--warn)">🟡 موجودی محدود</b>';
        return `<tr>
          <td class="name">${esc(p.name)}</td>
          <td><b style="color:var(--accent)">${esc(storeName(p.storeId))}</b></td>
          <td>${esc(p.category)}</td>
          <td>${fa(p.price)} تومان</td>
          <td>${stockLabel}</td>
          <td>${cartCell(p)}</td>
        </tr>`;
      }).join('')
    : rows.map(p => {
        const d = draftOf(p), dirty = p.id in drafts;
        const storeBadge = isAdmin() ? `<div style="font-size:11px;color:var(--muted);font-weight:normal">فروشگاه: ${esc(storeName(p.storeId))}</div>` : '';
        return `
        <tr data-id="${p.id}"${dirty ? ' class="dirty"' : ''}>
          <td class="name">${esc(p.name)}${isLow(p) ? '<span class="low">(موجودی کم)</span>' : ''}${storeBadge}</td>
          <td><div class="cat-box">
            <select class="row-cat">${options(Object.keys(CATEGORIES), d.category)}</select>
            <select class="row-subcat">${options(subsOf(d.category), d.subcategory)}</select>
          </div></td>
          <td>${fa(p.price)} تومان</td>
          <td><div class="stock">
            <button type="button" class="qty" data-act="dec">-</button>
            <input type="number" value="${esc(d.stock)}" min="0" step="any">
            <button type="button" class="qty" data-act="inc">+</button>
          </div></td>
          <td><div class="btn-row">
            <button class="ok save" data-act="save"${dirty ? '' : ' hidden'}>ثبت</button>
            <button class="gray undo" data-act="undo"${dirty ? '' : ' hidden'}>لغو</button>
            <button class="info" data-act="edit">ویرایش</button>
            <button class="danger" data-act="del">حذف</button>
          </div></td>
        </tr>`;
      }).join('');
  updateDirtyBar();
  $('#shopBar').hidden = !(isCustomer() && storeFilter !== 'all');
  $('#shopBarName').textContent = '🏪 ' + storeName(storeFilter);
 $('#shopGrid').innerHTML = getActiveStores().length
    ? getActiveStores().map(st => {
        const stProds = products.filter(p => p.storeId === st.id);
        const avail = stProds.filter(p => p.stock > 0).length;
        return `<button class="shop-card" data-storeid="${esc(st.id)}"><b>🏪 ${esc(st.name)}</b><span>${fa(stProds.length)} قلم کالا | ${fa(avail)} موجود</span></button>`;
      }).join('')
    : emptyBlockHTML('🏪', 'فروشگاهی ثبت نشده است', 'بعد از ایجاد فروشگاه، فهرست آن‌ها در این بخش نمایش داده می‌شود.');
  $('#historyToolbar').hidden = isCustomer();
  let shownLogs = isAdmin() ? logs : isSeller() ? logs.filter(l => l.storeId === currentUser.storeId || mine(l)) : [];
  if (!isCustomer() && logFilter !== 'all') {
    if (logFilter === 'register') shownLogs = shownLogs.filter(l => l.type === 'register');
    else if (logFilter === 'sale') shownLogs = shownLogs.filter(l => l.type === 'sale');
    else if (logFilter === 'manage') shownLogs = shownLogs.filter(l => ['add', 'edit', 'delete', 'system'].includes(l.type));
  }
  if (!isCustomer()) shownLogs = shownLogs.filter(passLogFilters);
  $('#archiveLogs').hidden = !isAdmin();
  $('#archiveLogs').textContent = `📦 آرشیو (${fa(logArchive.length)})`;
  const logLabels = { add: 'افزودن', edit: 'ویرایش', delete: 'حذف', system: 'سیستم', sale: 'فروش', register: 'ثبت‌نام' };
  $('#historyHead').innerHTML = '<tr><th>ردیف</th><th>نوع رویداد</th><th>شرح رویداد و جزئیات</th><th>زمان ثبت</th></tr>';
  $('#logList').innerHTML = shownLogs.length ? shownLogs.map((l, i) => {
    let buyerDetails = '';
    if (l.buyerInfo) {
      buyerDetails = `<div style="font-size:11.5px;color:var(--accent);margin-top:4px">
        👤 <b>خریدار:</b> ${esc(l.buyerInfo.name)} | 📞 <b>تماس:</b> ${esc(l.buyerInfo.phone)}<br>
        🏠 <b>آدرس:</b> ${esc(l.buyerInfo.address)}
      </div>`;
    }
    const storeInfo = l.storeId ? `<span style="font-size:11px;color:var(--muted);margin-right:6px">(${esc(storeName(l.storeId))})</span>` : '';
    return `<tr>
      <td>${fa(i + 1)}</td>
      <td><span class="badge ${logLabels[l.type] ? l.type : 'system'}">${logLabels[l.type] || 'سیستم'}</span></td>
      <td style="text-align:right">${esc(l.message)} ${storeInfo}${buyerDetails}</td>
      <td>${esc(l.time)}</td>
    </tr>`;
  }).join('') : emptyStateHTML(4, '🕒', 'رویدادی ثبت نشده است', 'تاریخچه فعالیت این بخش در حال حاضر خالی است یا فیلترهای انتخاب‌شده نتیجه‌ای ندارند.');
}
/* ==========================================================================
   ۷. مدیریت ناوبری، تب‌ها و کنترل منو
   ========================================================================== */
let booted = false;
function showTab(tab, push = true) {
  const item = $(`.menu-item[data-tab="${tab}"]`);
  if (!item) return false;
  $$('.menu-item').forEach(i => i.classList.toggle('active', i === item));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
  $('#subtitle').textContent = `(${item.textContent.trim().replace(/\s*\([۰-۹]+\)$/, '')})`;
  toggleMenu(false);
  if (push && location.hash !== '#' + tab) history.pushState({ tab }, '', '#' + tab);
  scrollTo({ top: 0 });
  return true;
}
addEventListener('popstate', () => {
  if (!showTab(location.hash.slice(1), false)) showTab(isCustomer() ? 'shops' : 'analytics', false);
});
const storeOptions = withAll => (withAll ? '<option value="all">🏪 همه فروشگاه‌ها</option>' : '')
  + getActiveStores().map(st => `<option value="${esc(st.id)}">${esc(st.name)}</option>`).join('');
function applyUserAuth() {
  storeFilter = 'all';
  logFilter = 'all';
  cart = (currentUser.role === 'customer') ? (carts[currentUser.id] || []) : [];
  persistState();
  setLowPanel(false);
  const subTxt = isMember() && currentUser.subscriptionNo ? ` (اشتراک: ${faRaw(currentUser.subscriptionNo)})` : '';
  const storeLabel = currentUser.storeId ? ` [${storeName(currentUser.storeId)}]` : '';
  $('#userGreeting').textContent = isGuest() ? '👤 کاربر مهمان' : `👤 ${currentUser.name}${storeLabel}${subTxt}`;
  const badge = $('#userRoleBadge');
  badge.className = 'role-badge ' + currentUser.role;
  badge.textContent = isAdmin() ? '👑 مدیر کل' : isSeller() ? '🏪 فروشنده' : isGuest() ? '👁️ مهمان' : '🛍️ خریدار';
  const menuConfig = {
    admin: [
      { tab: 'analytics', title: '📊 داشبورد کلان' },
      { tab: 'inventory', title: '📦 انبار کل' },
      { tab: 'orders', title: '🧾 سفارش‌ها و فروش' },
      { tab: 'shops', title: '🏪 فروشگاه‌ها' },
      { tab: 'users', title: '👥 کاربران' },
      { tab: 'history', title: '🕒 تاریخچه رویدادها' },
      { tab: 'backup', title: '💾 پشتیبان‌گیری' }
    ],
    seller: [
      { tab: 'analytics', title: `📊 داشبورد فروشگاه` },
      { tab: 'inventory', title: `📦 موجودی فروشگاه` },
      { tab: 'orders', title: '🧾 سفارش‌های اینترنتی' },
      { tab: 'history', title: '🕒 رویدادهای فروشگاه' }
    ],
    customer: [
      { tab: 'shops', title: '🏬 فروشگاه‌ها' },
      { tab: 'inventory', title: '🛍️ کاتالوگ محصولات' },
      { tab: 'orders', title: '📦 سفارش‌های من' }
    ],
    guest: [
      { tab: 'shops', title: '🏬 فروشگاه‌ها' },
      { tab: 'inventory', title: '🛍️ کاتالوگ محصولات' }
    ]
  };
  const currentRoleMenus = menuConfig[currentUser.role] || menuConfig.guest;
  $('#menuList').innerHTML = currentRoleMenus.map(m => `
    <li class="menu-item" data-tab="${m.tab}">${m.title}</li>
  `).join('');
  $$('.menu-item').forEach(item => {
    item.onclick = () => showTab(item.dataset.tab);
  });
  $('#formCard').hidden = !can('manageProducts');
  $('#clearLogs').hidden = !isAdmin();
  $('#filterLowBtn').hidden = isCustomer();
  $('#openCartBtn').hidden = !isMember();
  $('#openAuthModal').hidden = !isGuest();
  $('#customerLogoutBtn').hidden = isGuest();
  $('#changePinBtn').hidden = !(isAdmin() || isSeller());
  $('#calcFab').hidden = isCustomer();
  if (isCustomer()) $('#calc').hidden = true;
  $('#fStore').hidden = isSeller();
  $('#fStore').innerHTML = storeOptions();
  $('#filterStore').hidden = isSeller() || isCustomer();
  $('#filterStore').innerHTML = storeOptions(true);
  $('#logShopFilter').hidden = !isAdmin();
  $('#logShopFilter').innerHTML = storeOptions(true);
  resetForm();
  updateCartBadge();
  const hashTab = location.hash.slice(1);
  const startTab = (!booted && $(`.menu-item[data-tab="${hashTab}"]`)) ? hashTab : (isCustomer() ? 'shops' : 'analytics');
  booted = true;
  showTab(startTab, false);
  history.replaceState({ tab: startTab }, '', '#' + startTab);
  render();
}
/* ==========================================================================
   ۸. فرآیند ورود و عضویت یکپارچه
   ========================================================================== */
function loginAs(u) {
  if (Object.keys(drafts).length && !confirm('تغییرات ثبت‌‌نشده لغو خواهد شد. ادامه می‌دهید؟')) return;
  Object.keys(drafts).forEach(id => delete drafts[id]);
  currentUser = u;
  $('#loginUser').value = '';
  $('#loginPass').value = '';
  $('#authModal').hidden = true;
  applyUserAuth();
  toast(`خوش آمدید ${u.name} عزیز ✅`);
  loginAlerts();
  if (u.pinDefault) setTimeout(changePin, 300);
}
function loginAlerts() {
  const msgs = [];
  if (isSeller() || isAdmin()) {
    const low = isSeller() ? visible().filter(isLow).length : 0;
    const fresh = orders.filter(o => o.status === 'pending' && (isAdmin() || o.storeId === currentUser.storeId)).length;
    if (low) msgs.push(`${fa(low)} کالا موجودی کم دارد`);
    if (fresh) msgs.push(`${fa(fresh)} سفارش جدید`);
  }
  if (isAdmin()) {
    const p = users.filter(u => u.role === 'seller' && u.status === 'pending').length;
    if (p) msgs.push(`${fa(p)} فروشنده در انتظار تأیید`);
  }
  if (msgs.length) setTimeout(() => toast('🔔 ' + msgs.join(' | '), 'var(--orange)'), 2500);
}
function changePin() {
  const u = currentUser;
  if (u.role !== 'admin' && u.role !== 'seller') return;
  const old = u.pinDefault ? '1234' : prompt('رمز فعلی:');
  if (old === null || hashPin(old) !== u.pinHash) return toast('رمز فعلی نادرست است', 'var(--danger)');
  const np = prompt('رمز جدید را وارد کنید (حداقل ۴ کاراکتر):');
  if (np === null) return;
  if (np.length < 4) return toast('رمز باید حداقل ۴ کاراکتر باشد', 'var(--danger)');
  u.pinHash = hashPin(np);
  delete u.pinDefault;
  persistState();
  toast('رمز عبور با موفقیت تغییر کرد 🔑');
}
$('#changePinBtn').onclick = changePin;
$('#tabBtnLogin').onclick = () => {
  $('#tabBtnLogin').classList.add('active');
  $('#tabBtnSignup').classList.remove('active');
  $('#loginSection').hidden = false;
  $('#signupSection').hidden = true;
};
$('#tabBtnSignup').onclick = () => {
  $('#tabBtnSignup').classList.add('active');
  $('#tabBtnLogin').classList.remove('active');
  $('#signupSection').hidden = false;
  $('#loginSection').hidden = true;
};
document.addEventListener('click', e => {
  const chip = e.target.closest('.demo-chip');
  if (!chip) return;
  $('#loginUser').value = chip.dataset.user;
  $('#loginPass').value = chip.dataset.pass;
  toast(`حساب ${chip.textContent.trim()} انتخاب شد ✍️`, 'var(--accent)');
});
document.addEventListener('click', e => {
  const btn = e.target.closest('.toggle-pass-btn');
  if (!btn) return;
  const targetInput = $('#' + btn.dataset.target);
  if (!targetInput) return;
  if (targetInput.type === 'password') {
    targetInput.type = 'text';
    btn.textContent = '🙈';
  } else {
    targetInput.type = 'password';
    btn.textContent = '👁️';
  }
});
let fails = 0, lockUntil = 0;
const guard = () => {
  if (Date.now() < lockUntil) {
    toast(`تلاش ناموفق زیاد؛ ${fa(Math.ceil((lockUntil - Date.now()) / 1000))} ثانیه صبر کنید`, 'var(--danger)');
    return false;
  }
  return true;
};
const failed = () => { if (++fails >= 5) { fails = 0; lockUntil = Date.now() + 60000; } };
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!guard()) return;
  const rawUser = $('#loginUser').value.trim();
  const inputUser = faDigits(rawUser).toLowerCase();
  const inputPass = $('#loginPass').value;
  if (!rawUser || !inputPass) {
    return toast('لطفاً نام کاربری و رمز عبور را وارد نمایید.', 'var(--danger)');
  }
  const u = users.find(x =>
    (x.username && faDigits(x.username).toLowerCase() === inputUser) ||
    (x.phone && faDigits(x.phone) === inputUser) ||
    (x.subscriptionNo && faDigits(x.subscriptionNo) === inputUser)
  );
  if (!u || hashPin(inputPass) !== u.pinHash) {
    failed();
    return toast('نام کاربری یا رمز عبور اشتباه است!', 'var(--danger)');
  }
  if (u.status === 'pending') {
    return toast('حساب کاربری فروشگاه شما در انتظار تأیید مدیر کل است 🕓', 'var(--danger)');
  }
  fails = 0;
  loginAs(u);
});
$('#customerLogoutBtn').onclick = () => {
  if (Object.keys(drafts).length && !confirm('تغییرات ثبت‌‌نشده لغو خواهد شد. خارج می‌شوید؟')) return;
  Object.keys(drafts).forEach(id => delete drafts[id]);
  currentUser = GUEST;
  persistState();
  applyUserAuth();
  toast('از حساب کاربری خارج شدید');
};
$('#openAuthModal').onclick = () => {
  $('#tabBtnLogin').click();
  $('#authModal').hidden = false;
};
$('#closeAuthModal').onclick = () => { $('#authModal').hidden = true; };
$('#regRole').onchange = e => {
  const isCust = e.target.value === 'customer';
  $('#regShop').style.display = isCust ? 'none' : 'block';
  $('#customerSignupFields').style.display = isCust ? 'flex' : 'none';
};
$('#signupForm').addEventListener('submit', e => {
  e.preventDefault();
  const first = $('#regFirst').value.trim(), last = $('#regLast').value.trim();
  const username = faDigits($('#regUsername').value.trim()).toLowerCase();
  const password = $('#regPassword').value;
  const role = $('#regRole').value, shopName = $('#regShop').value.trim();
  const phone = faDigits($('#regPhone').value.trim()), address = $('#regAddress').value.trim();
  if (!first || !last) return alert('نام و نام خانوادگی را وارد کنید.');
  if (!username || username.length < 3) return alert('نام کاربری باید حداقل ۳ کاراکتر باشد.');
  if (users.some(u => u.username && u.username.toLowerCase() === username)) {
    return alert('این نام کاربری قبلاً انتخاب شده است.');
  }
  if (!password || password.length < 4) return alert('رمز عبور باید حداقل ۴ رقم باشد.');
  let newStoreId = null;
  if (role === 'seller') {
    if (!shopName) return alert('نام فروشگاه را وارد کنید.');
    if (stores.some(s => s.name === shopName)) return alert('این نام فروشگاه قبلاً ثبت شده است.');
    newStoreId = uid('store');
    stores.push({ id: newStoreId, name: shopName });
  }
  if (role === 'customer') {
    if (!/^09\d{9}$/.test(phone)) return alert('شماره همراه نامعتبر است (مثال: 09123456789).');
    if (address.length < 10) return alert('لطفاً آدرس پستی را کامل وارد کنید.');
    if (users.some(u => u.role === 'customer' && faDigits(u.phone) === phone)) {
      return alert('با این شماره قبلاً ثبت‌نام شده است.');
    }
  }
  const newUser = {
    id: uid('u'),
    name: `${first} ${last}`,
    username,
    role,
    storeId: newStoreId,
    phone: role === 'customer' ? phone : '',
    address: role === 'customer' ? address : '',
    pinHash: hashPin(password)
  };
  if (role === 'customer') newUser.subscriptionNo = newSubscriptionNo();
  if (role === 'seller') newUser.status = 'pending';
  users.push(newUser);
  persistState();
  if (role === 'customer') {
    currentUser = newUser;
    log('register', `ثبت‌نام خریدار: "${newUser.name}" (@${username})`, '', { name: newUser.name, phone: newUser.phone, address: newUser.address });
    applyUserAuth();
    $('#smsText').textContent = `${first} عزیز، حساب شما فعال شد.\nنام کاربری: ${username}\nشماره اشتراک شما: ${faRaw(newUser.subscriptionNo)}\nرمز عبور: ${password}\nبرای خریدهای بعدی از این اطلاعات استفاده کنید.`;
    $('#smsModal').hidden = false;
  } else {
    log('register', `درخواست عضویت فروشنده: "${newUser.name}" (@${username}) برای "${shopName}"`, newStoreId);
    toast('اطلاعات فروشگاه ثبت شد؛ پس از تأیید مدیر کل فعال خواهد گردید 🕓');
    applyUserAuth();
  }
  $('#signupForm').reset();
  $('#authModal').hidden = true;
});
$('#smsOk').onclick = () => {
  $('#smsModal').hidden = true;
  $('#openCartBtn').click();
};
$('#pendingList').addEventListener('click', e => {
  const b = e.target.closest('[data-pact]');
  if (!b || !can('manageUsers')) return unauthorized();
  const u = users.find(x => x.id === b.dataset.uid);
  if (!u) return;
  if (b.dataset.pact === 'approve') {
    delete u.status;
    log('register', `فروشنده "${u.name}" (${storeName(u.storeId)}) توسط مدیر تأیید شد.`, u.storeId);
    toast('فروشنده تأیید شد ✅');
  } else {
    users = users.filter(x => x.id !== u.id);
    stores = stores.filter(s => s.id !== u.storeId);
    log('register', `درخواست فروشنده "${u.name}" رد شد.`);
    toast('درخواست رد شد', 'var(--danger)');
  }
  persistState(); render();
});
$('#userList').addEventListener('change', e => {
  if (!isAdmin()) return unauthorized();
  const sel = e.target.closest('.user-role-select');
  if (!sel) return;
  const u = users.find(x => x.id === sel.dataset.uid);
  if (!u) return;
  const oldRole = u.role;
  u.role = sel.value;
  if (u.role === 'seller' && !u.storeId) u.storeId = 'store1';
  log('edit', `تغییر نقش کاربر "${u.name}" از ${oldRole} به ${u.role}`);
  persistState(); render();
  toast(`نقش ${u.name} به روزرسانی شد ✅`);
});
/* ==========================================================================
   ۹. رویدادهای جدول، فرم‌ها و انبارداری
   ========================================================================== */
$('#statLowCard').onclick = () => setLowPanel($('#lowStockPanel').hidden);
$('#closeLowStockPanel').onclick = () => setLowPanel(false);
$('#lowStockPanelContent').addEventListener('click', e => {
  const b = e.target.closest('[data-restock]');
  if (!b) return;
  const p = find(Number(b.dataset.restock));
  if (!can('manageInventory') || !canAccessProduct(p)) return unauthorized();
  const inputVal = prompt(`تعداد افزایش موجودی «${p.name}» (موجودی فعلی: ${p.stock}):`, '10');
  if (inputVal === null) return;
  const n = Number(faDigits(inputVal));
  if (!Number.isFinite(n) || n <= 0) return toast('تعداد وارد شده نامعتبر است!', 'var(--danger)');
  p.stock += n;
  recordTransaction(p.id, p.storeId, 'in', n, 'شارژ سریع از پنل هشدار موجودی', n);
  log('edit', `شارژ موجودی «${p.name}»: ${fa(n)} عدد اضافه شد`, p.storeId);
  persistState(); render();
  toast(`موجودی «${p.name}» با موفقیت شارژ شد ✅`);
});
function initCategories() {
  const names = Object.keys(CATEGORIES);
  $('#fCategory').innerHTML = names.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('#filterCategory').innerHTML = '<option value="all">📂 همه دسته‌بندی‌ها</option>' + names.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  fillFormSubs();
}
function fillFormSubs(selected) {
  const subs = subsOf($('#fCategory').value);
  $('#fSubCategory').innerHTML = options(subs, selected ?? subs[0]);
}
$('#fCategory').onchange = () => fillFormSubs();
$('#search').oninput = debounce(render);
$('#logSearch').oninput = debounce(render);
$('#orderSearch').oninput = debounce(render);
$('#storeRankSort').onchange = render;
$('#filterCategory').onchange = e => {
  catFilter = e.target.value; subFilter = 'all';
  const sel = $('#filterSubCategory');
  sel.hidden = catFilter === 'all';
  sel.innerHTML = '<option value="all">📁 همه زیردسته‌ها</option>' + subsOf(catFilter).map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  render();
};
$('#filterSubCategory').onchange = e => { subFilter = e.target.value; render(); };
$('#filterStore').onchange = e => { storeFilter = e.target.value; render(); };
$$('#tab-inventory .filter').forEach(btn => btn.onclick = () => {
  stockFilter = btn.dataset.filter;
  $$('#tab-inventory .filter').forEach(b => b.classList.toggle('active', b === btn));
  render();
});
$('#shopGrid').addEventListener('click', e => {
  const c = e.target.closest('[data-storeid]');
  if (!c) return;
  storeFilter = c.dataset.storeid;
  showTab('inventory');
  render();
});
$('#backToShops').onclick = () => {
  storeFilter = 'all';
  showTab('shops');
  render();
};
$$('#historyToolbar .filter').forEach(btn => btn.onclick = () => {
  logFilter = btn.dataset.logfilter;
  $$('#historyToolbar .filter').forEach(b => b.classList.toggle('active', b === btn));
  render();
});
['#logRange', '#logFrom', '#logTo', '#logShopFilter'].forEach(s => $(s).onchange = render);
$('#logRange').addEventListener('change', () => {
  const c = $('#logRange').value === 'custom';
  $('#logFrom').hidden = !c; $('#logTo').hidden = !c;
});
$('#archiveLogs').onclick = () => {
  if (!can('backup')) return unauthorized();
  if (!logArchive.length) return toast('آرشیو در حال حاضر خالی است.');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([JSON.stringify(logArchive, null, 2)], { type: 'application/json' })),
    download: `log-archive-${new Date().toISOString().slice(0, 10)}.json`
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  logArchive = []; persistState(); render();
  toast('آرشیو دانلود شد و از حافظه سبک‌سازی گردید ✅');
};
$('#orderStatusFilter').onchange = render;
$('#orderList').addEventListener('click', e => {
  const b = e.target.closest('[data-oact]');
  if (!b) return;
  if (b.dataset.oact === 'invoice') printInvoice(b.dataset.ocode);
  else setOrderStatus(b.dataset.ocode, b.dataset.oact);
});
const list = $('#productList');
list.addEventListener('input', e => { if (e.target.matches('.stock input')) syncRow(e.target.closest('tr')); });
list.addEventListener('change', e => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  if (e.target.matches('.row-cat')) {
    tr.querySelector('.row-subcat').innerHTML = options(subsOf(e.target.value), subsOf(e.target.value)[0]);
  }
  if (e.target.matches('.row-cat, .row-subcat')) syncRow(tr);
});
list.addEventListener('keydown', e => {
  if (!e.target.matches('.stock input')) return;
  const id = Number(e.target.closest('tr').dataset.id);
  if (e.key === 'Enter') { e.preventDefault(); saveOne(id); }
  if (e.key === 'Escape') { delete drafts[id]; render(); }
});
list.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'need-login') { $('#authModal').hidden = false; return; }
  if (btn.dataset.act === 'add-to-cart' || btn.dataset.act === 'cart-inc') { addToCart(Number(btn.dataset.id)); return; }
  if (btn.dataset.act === 'cart-dec') { changeCartItemQty(Number(btn.dataset.id), -1); return; }
  const tr = btn.closest('tr'), id = Number(tr.dataset.id), p = find(id);
  if (!p) return;
  if (!canAccessProduct(p)) return unauthorized();
  switch (btn.dataset.act) {
    case 'inc':
    case 'dec': {
      if (!can('manageInventory')) return unauthorized();
      const input = tr.querySelector('.stock input');
      input.value = Math.max(0, (Number(input.value) || 0) + (btn.dataset.act === 'inc' ? 1 : -1));
      syncRow(tr);
      break;
    }
    case 'save': saveOne(id); break;
    case 'undo': delete drafts[id]; render(); break;
    case 'edit':
      if (!can('manageProducts')) return unauthorized();
      editId = id; delete drafts[id];
      $('#fName').value = p.name;
      $('#fCategory').value = p.category;
      fillFormSubs(p.subcategory);
      $('#fStore').value = p.storeId;
      $('#fPrice').value = p.price; $('#fStock').value = p.stock;
      $('#submitBtn').textContent = 'ثبت تغییرات'; $('#submitBtn').className = 'info';
      $('#cancelEdit').hidden = false;
      render();
      scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'del':
      if (!can('manageProducts')) return unauthorized();
      deleteId = id; $('#confirm').hidden = false; break;
  }
});
$('#yes').onclick = () => {
  const p = find(deleteId);
  if (p && canAccessProduct(p)) {
    products = products.filter(x => x.id !== deleteId);
    delete drafts[deleteId];
    recordTransaction(p.id, p.storeId, 'waste', -p.stock, 'حذف کامل کالا از انبار');
    log('delete', `کالای "${p.name}" از سیستم حذف شد`, p.storeId);
    if (editId === deleteId) resetForm();
    persistState(); render();
    toast(`کالای "${p.name}" حذف شد`);
  } else {
    unauthorized();
  }
  $('#no').click();
};
$('#no').onclick = () => { deleteId = null; $('#confirm').hidden = true; };
[$('#fPrice'), $('#fStock')].forEach(input => input.addEventListener('keydown', e => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  input.value = Math.max(0, (Number(input.value) || 0) + Number(input.dataset.step) * (e.key === 'ArrowUp' ? 1 : -1));
}));
function resetForm() {
  editId = null;
  $('#productForm').reset();
  fillFormSubs();
  $('#submitBtn').textContent = 'اضافه کن'; $('#submitBtn').className = 'ok';
  $('#cancelEdit').hidden = true;
}
$('#cancelEdit').onclick = resetForm;
$('#productForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!can('manageProducts')) return unauthorized();
  const name = $('#fName').value.trim(), category = $('#fCategory').value, subcategory = $('#fSubCategory').value;
  const storeId = isSeller() ? currentUser.storeId : $('#fStore').value;
  const priceStr = $('#fPrice').value.trim(), stockStr = $('#fStock').value.trim();
  if (!name || priceStr === '' || stockStr === '') return toast('خطا: همه فیلدها را وارد کنید!', 'var(--danger)');
  const price = Number(priceStr), stock = Number(stockStr);
  if (!Number.isFinite(price) || !Number.isFinite(stock) || price < 0 || stock < 0) return toast('قیمت و موجودی باید عدد معتبر و غیرمنفی باشند!', 'var(--danger)');
  if (products.some(p => p.id !== editId && p.storeId === storeId && p.name.toLowerCase() === name.toLowerCase())) {
    return toast('کالایی با این نام در این فروشگاه موجود است!', 'var(--danger)');
  }
  if (editId !== null) {
    const p = find(editId);
    if (!canAccessProduct(p)) return unauthorized();
    const oldStock = p.stock;
    Object.assign(p, { name, category, subcategory, storeId, price, stock });
    if (oldStock !== stock) recordTransaction(p.id, p.storeId, 'adjustment', stock - oldStock, 'ویرایش از طریق فرم کالا');
    log('edit', `مشخصات کالای "${name}" ویرایش شد`, storeId);
    toast('تغییرات با موفقیت ذخیره شد ✏️');
  } else {
    const newProd = { id: Date.now() + Math.floor(Math.random() * 1000), name, category, subcategory, storeId, price, stock };
    products.push(newProd);
    recordTransaction(newProd.id, storeId, 'in', stock, 'موجودی اولیه کالا');
    log('add', `کالای جدید "${name}" با موجودی ${stock} ثبت شد`, storeId);
    toast('کالا به انبار افزوده شد ✅');
  }
  persistState(); render(); resetForm();
});
/* ==========================================================================
   ۱۰. گزارش چاپی PDF و پشتیبان‌گیری
   ========================================================================== */
$('#clearLogs').onclick = () => {
  if (!isAdmin()) return unauthorized();
  if (!confirm('کل تاریخچه پاک شود؟')) return;
  logs = []; persistState(); render();
};
$('#pdfBtn').onclick = () => {
  if (!can('viewReports')) return unauthorized();
  if (!products.length) return alert('انبار در حال حاضر خالی است!');
  const win = window.open('', '_blank');
  if (!win) return alert('لطفاً اجازه باز شدن پنجره پاپ‌آپ را بدهید.');
  const vis = visible();
  const total = vis.reduce((s, p) => s + p.price * p.stock, 0);
  const cell = 'border:1px solid #cbd5e1;padding:8px;text-align:center';
  const rows = vis.map((p, i) => `
    <tr style="${isLow(p) ? 'background:#fff1f2' : ''}">
      <td style="${cell}">${fa(i + 1)}</td>
      <td style="${cell};text-align:right;font-weight:bold">${esc(p.name)}</td>
      <td style="${cell}">${esc(storeName(p.storeId))}</td>
      <td style="${cell}">${esc(p.category)} - ${esc(p.subcategory)}</td>
      <td style="${cell}">${fa(p.price)} تومان</td>
      <td style="${cell}">${fa(p.stock)}</td>
      <td style="${cell}">${fa(p.price * p.stock)} تومان</td>
      <td style="${cell};color:${isLow(p) ? '#e11d48' : '#166534'}">${isLow(p) ? 'موجودی اندک' : 'کافی'}</td>
    </tr>`).join('');
  const heads = ['ردیف', 'نام کالا', 'فروشگاه', 'دسته‌بندی', 'قیمت واحد', 'موجودی', 'ارزش کل', 'وضعیت']
    .map(h => `<th style="${cell};background:#f1f5f9">${h}</th>`).join('');
  win.document.title = 'گزارش موجودی انبار';
  win.document.documentElement.lang = 'fa';
  win.document.documentElement.dir = 'rtl';
  win.document.body.style.fontFamily = 'Tahoma,sans-serif';
  win.document.body.style.padding = '25px';
  win.document.body.style.color = '#0f172a';
  win.document.body.innerHTML = `
    <h2 style="text-align:center;border-bottom:2px solid #0284c7;padding-bottom:12px">گزارش جامع موجودی و ارزش مالی انبار</h2>
    <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;margin:15px 0">
      <span>تاریخ چاپ: ${new Date().toLocaleString('fa-IR')}</span>
      <span>گزارش‌گیرنده: ${esc(currentUser.name)}</span>
      <span>تعداد کل اقلام: ${fa(vis.length)} کالا</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:25px;border-top:2px dashed #94a3b8;padding-top:15px;display:flex;justify-content:space-between;font-weight:bold">
      <div>ارزش کل موجودی: ${fa(total)} تومان</div>
      <div>ارزش با ۱۰٪ تخفیف: ${fa(total * DISCOUNT)} تومان</div>
    </div>
  `;
  win.focus();
  setTimeout(() => win.print(), 350);
  log('system', 'گزارش PDF موجودی استخراج گردید');
  render();
};
$('#exportBtn').onclick = () => {
  if (!can('backup')) return unauthorized();
  const data = JSON.stringify({
    exportedAt: new Date().toISOString(),
    products, logs, logArchive, stores, users, customerCarts: carts, orders, sales, inventoryTransactions
  }, null, 2);
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([data], { type: 'application/json' })),
    download: `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  log('system', 'پشتیبان کامل سامانه دریافت شد');
  render();
};
function validateBackup(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.products)) return 'ساختار فایل پشتیبان معتبر نیست.';
  if (data.products.length > 10000) return 'تعداد کالاها در فایل غیرمجاز است.';
  return '';
}
$('#importBtn').onclick = () => {
  if (!can('backup')) return unauthorized();
  const file = $('#importFile').files[0];
  if (!file) return alert('یک فایل پشتیبان JSON انتخاب کنید.');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const validationError = validateBackup(data);
      if (validationError) return alert(validationError);
      const oldUserId = currentUser.id;
      if (Array.isArray(data.stores)) stores = data.stores.map(normalizeStore);
      if (Array.isArray(data.users)) users = data.users.map(normalizeUser);
      products = normalize(data.products);
      logs = Array.isArray(data.logs) ? data.logs.slice(0, 500) : [];
      logArchive = Array.isArray(data.logArchive) ? data.logArchive : [];
      orders = Array.isArray(data.orders) ? data.orders : [];
      sales = Array.isArray(data.sales) ? data.sales : [];
      inventoryTransactions = Array.isArray(data.inventoryTransactions) ? data.inventoryTransactions : [];
      ensureCredentials();
      carts = data.customerCarts && typeof data.customerCarts === 'object' ? data.customerCarts : {};
      Object.keys(drafts).forEach(id => delete drafts[id]);
      currentUser = users.find(u => u.id === oldUserId && u.status !== 'pending') || GUEST;
      persistState();
      log('system', 'داده‌ها از فایل پشتیبان بازگردانی شدند');
      applyUserAuth();
      $('#importFile').value = '';
      alert('اطلاعات با موفقیت بازگردانی شد ✅');
    } catch { alert('خطا در پردازش فایل!'); }
  };
  reader.readAsText(file);
};
$('#resetBtn').onclick = () => {
  if (!can('reset')) return unauthorized();
  if (!confirm('هشدار: تمام کالاها، سفارش‌ها، فروش‌ها، کاربران و تنظیمات فروشگاه برای همیشه پاک و به حالت اولیه بازگردانی می‌شوند. آیا اطمینان دارید؟')) return;
  stores = DEFAULT_STORES.map(normalizeStore);
  users = DEFAULT_USERS.map(normalizeUser);
  ensureCredentials();
  products = [];
  logs = [];
  logArchive = [];
  carts = {};
  cart = [];
  orders = [];
  sales = [];
  inventoryTransactions = [];
  Object.keys(drafts).forEach(id => delete drafts[id]);
  [
    'inventoryData', 'inventoryLogs', 'inventoryLogArchive',
    'customerCarts', 'inventoryOrders', 'inventorySales',
    'inventoryTransactions', 'inventoryStores', 'inventoryUsers'
  ].forEach(k => remove(k));
  currentUser = users.find(u => u.id === 'u_admin') || GUEST;
  setSession('sessionUser', currentUser.id);
  save('inventoryStores', stores);
  save('inventoryUsers', users);
  applyUserAuth();
  render();
  alert('سامانه با موفقیت به حالت اولیه بازگردانی شد.');
};
/* ==========================================================================
   ۱۱. ماشین‌‌حساب شناور و منوی کناری
   ========================================================================== */
function setTheme(dark) {
  document.body.classList.toggle('dark', dark);
  $('#themeToggle').textContent = dark ? '☀' : '🌙';
  save('theme', dark ? 'dark' : 'light');
}
let savedTheme = '';
savedTheme = getRaw('theme', '');
setTheme(savedTheme === 'dark');
$('#themeToggle').onclick = () => setTheme(!document.body.classList.contains('dark'));
const toggleMenu = open => { $('#sideMenu').classList.toggle('open', open); $('#overlay').hidden = !open; };
$('#menuToggle').onclick = () => toggleMenu(true);
$('#closeMenu').onclick = $('#overlay').onclick = () => toggleMenu(false);
function place(el, x, y) {
  x = clamp(x, 0, window.innerWidth - el.offsetWidth);
  y = clamp(y, 0, window.innerHeight - el.offsetHeight);
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
const posOf = el => ({ x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 });
const savedPos = key => {
  const p = load(key, null);
  return p && isFinite(p.x) && isFinite(p.y) ? p : null;
};
function makeDraggable(el, handle, storageKey, onTap) {
  let active = false, moved = false, startX = 0, startY = 0, origin = { x: 0, y: 0 };
  handle.addEventListener('pointerdown', e => {
    if (e.button || e.target.closest('[data-nodrag]')) return;
    active = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    origin = posOf(el);
    if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!active) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true;
    el.classList.add('dragging');
    place(el, origin.x + dx, origin.y + dy);
  });
  const finish = isTap => {
    if (!active) return;
    active = false;
    el.classList.remove('dragging');
    if (moved) save(storageKey, posOf(el));
    else if (isTap && onTap) onTap();
  };
  handle.addEventListener('pointerup', () => finish(true));
  handle.addEventListener('pointercancel', () => finish(false));
}
const fab = $('#calcFab'), calc = $('#calc');
const calcState = { cur: '0', prev: null, op: null, fresh: false, expr: '' };
const fmt = n => String(parseFloat(Number(n).toPrecision(12)));
function calcShow() {
  $('#calcVal').textContent = calcState.cur;
  $('#calcExpr').textContent = calcState.expr;
}
function calcReset() {
  Object.assign(calcState, { cur: '0', prev: null, op: null, fresh: false, expr: '' });
}
function calcError() {
  calcReset(); calcState.cur = 'خطا'; calcShow();
}
function calcOp(a, op, b) {
  a = Number(a); b = Number(b);
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? null : a / b;
  return b;
}
function calcKey(k) {
  const s = calcState;
  if (s.cur === 'خطا') calcReset();
  if (/^\d$/.test(k)) {
    if (s.fresh) { s.cur = k; s.fresh = false; if (!s.op) s.expr = ''; }
    else if (s.cur === '0') s.cur = k;
    else if (s.cur.length < 15) s.cur += k;
  } else if (k === '.') {
    if (s.fresh) { s.cur = '0.'; s.fresh = false; if (!s.op) s.expr = ''; }
    else if (!s.cur.includes('.')) s.cur += '.';
  } else if (k === '+' || k === '-' || k === '×' || k === '÷') {
    if (s.op && !s.fresh) {
      const r = calcOp(s.prev, s.op, s.cur);
      if (r === null) return calcError();
      s.cur = fmt(r);
    }
    s.prev = s.cur; s.op = k; s.fresh = true; s.expr = `${s.prev} ${k}`;
  } else if (k === '=') {
    if (!s.op) return;
    const r = calcOp(s.prev, s.op, s.cur);
    if (r === null) return calcError();
    s.expr = `${s.prev} ${s.op} ${s.cur} =`;
    s.cur = fmt(r); s.prev = null; s.op = null; s.fresh = true;
  } else if (k === 'C') calcReset();
  else if (k === '⌫') { if (!s.fresh) s.cur = s.cur.length > 1 && !(s.cur.length === 2 && s.cur[0] === '-') ? s.cur.slice(0, -1) : '0'; }
  else if (k === '%') s.cur = fmt(Number(s.cur) / 100);
  else if (k === '±') { if (s.cur !== '0') s.cur = s.cur[0] === '-' ? s.cur.slice(1) : '-' + s.cur; }
  calcShow();
}
$('#calcKeys').addEventListener('click', e => {
  const b = e.target.closest('[data-k]');
  if (b) calcKey(b.dataset.k);
});
function toggleCalc(open = calc.hidden) {
  calc.hidden = !open;
  if (!open) return;
  const sp = savedPos('calcPanelPos');
  if (sp) return place(calc, sp.x, sp.y);
  const f = posOf(fab), h = calc.offsetHeight;
  const below = f.y + 56 + h < window.innerHeight;
  place(calc, f.x + 46 - calc.offsetWidth, below ? f.y + 56 : f.y - h - 10);
}
makeDraggable(fab, fab, 'calcFabPos', () => toggleCalc());
makeDraggable(calc, $('#calcHead'), 'calcPanelPos');
$('#calcClose').onclick = () => toggleCalc(false);
fab.addEventListener('click', e => { if (e.detail === 0) toggleCalc(); });
document.addEventListener('keydown', e => {
  if (calc.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, select, textarea')) return;
  const map = { '*': '×', '/': '÷', Enter: '=', Backspace: '⌫', Delete: 'C', c: 'C', C: 'C' };
  const k = map[e.key] || e.key;
  if (e.key === 'Escape') return toggleCalc(false);
  if (/^[0-9.+\-=×÷%]$/.test(k) || k === 'C' || k === '⌫') { e.preventDefault(); calcKey(k); }
});
const fp = savedPos('calcFabPos') || { x: window.innerWidth - 70, y: window.innerHeight - 150 };
place(fab, fp.x, fp.y);
addEventListener('resize', () => {
  const f = posOf(fab); place(fab, f.x, f.y);
  if (!calc.hidden) { const c = posOf(calc); place(calc, c.x, c.y); }
});
/* ==========================================================================
   بهینه‌سازی UX: بستن مدال‌ها با کلیک روی پس‌زمینه و دکمه Escape
   ========================================================================== */
// ۱. بستن مدال با کلیک روی پس‌زمینه تار اطراف آن
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.hidden = true;
  }
});
// ۲. بستن مدال‌ها با فشردن کلید Escape کیبورد
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // بستن تمام مدال‌های باز
    $$('.modal-overlay').forEach(modal => {
      modal.hidden = true;
    });
  }
});
/* راه‌اندازی اولیه سامانه */
calcShow();
initCategories();
applyUserAuth();
