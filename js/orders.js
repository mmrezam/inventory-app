/* ==========================================================================
   Orders, invoice, cart and sales domain
   ========================================================================== */

/* ==========================================================================
   ۳. سفارشات، فاکتورها و تسویه
   ========================================================================== */
const STATUS = {
  pending:   { t: 'ثبت‌شده',   c: 'var(--warn)' },
  confirmed: { t: 'تأییدشده',  c: 'var(--accent)' },
  shipped:   { t: 'ارسال‌شده', c: '#8b5cf6' },
  delivered: { t: 'تحویل‌شده', c: 'var(--ok)' },
  cancelled: { t: 'لغوشده',    c: 'var(--danger)' }
};
const NEXT = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };
function newOrderCode() {
  let c;
  do { c = String(100000 + Math.floor(Math.random() * 900000)); } while (orders.some(o => o.code === c));
  return c;
}
const canManageOrder = o => isAdmin() || (isSeller() && o.storeId === currentUser.storeId);
function setOrderStatus(code, status) {
  const o = orders.find(x => x.code === code);
  if (!o || o.status === 'delivered' || o.status === 'cancelled') return;
  const canManageThis = canManageOrder(o);
  if (status === 'cancelled') {
    if (!canManageThis || o.status === 'shipped') {
      return unauthorized('امکان لغو این سفارش وجود ندارد!');
    }
    if (!confirm('آیا از لغو این سفارش و بازگرداندن اقلام به انبار اطمینان دارید؟')) return;
    o.items.forEach(it => {
      const p = find(it.id);
      if (p) {
        p.stock += it.qty;
        recordTransaction(p.id, p.storeId, 'return', it.qty, `لغو سفارش کد ${o.code}`, it.qty);
      }
    });
  } else if (!canManageThis || NEXT[o.status] !== status) {
    return unauthorized();
  }
  o.status = status;
  if (status === 'delivered') {
    o.deliveredAt = nowISO();
    sales.unshift({
      id: 'sale_' + o.code,
      storeId: o.storeId,
      sellerId: currentUser.id,
      customerId: o.uid,
      items: o.items,
      total: o.total,
      createdAt: o.deliveredAt
    });
  }
  o.history.push({ status, time: new Date().toLocaleString('fa-IR'), by: currentUser.name });
  log('sale', `تغییر وضعیت سفارش ${faRaw(o.code)} به ${STATUS[status].t}`, o.storeId, o.buyer);
  persistState(); render();
  toast(`وضعیت سفارش ${faRaw(o.code)}: ${STATUS[status].t}`);
}
function renderOrders() {
  const sel = $('#orderStatusFilter');
  if (!sel.options.length) {
    sel.innerHTML = '<option value="all">📂 همه وضعیت‌ها</option>' + Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v.t}</option>`).join('');
  }
  const q = faDigits($('#orderSearch').value.trim()).toLowerCase(), st = sel.value;
  const rows = orders.filter(o => {
    const scopeMatch = canManageOrder(o) || (isMember() && o.uid === currentUser.id);
    const statusMatch = st === 'all' || o.status === st;
    const textMatch = !q || o.code.includes(q) || (o.buyer && (o.buyer.name.toLowerCase().includes(q) || o.buyer.phone.includes(q)));
    return scopeMatch && statusMatch && textMatch;
  });
  $('#ordersTitle').textContent = isMember() ? '📦 سفارش‌های من' : '🧾 سفارش‌ها و فروش';
  $('#orderList').innerHTML = rows.length ? rows.map(o => {
    const s = STATUS[o.status], last = o.history[o.history.length - 1];
    const buyer = isMember() ? '' : `<div class="order-meta" style="color:var(--accent)">👤 ${esc(o.buyer.name)} | 📞 ${esc(o.buyer.phone)}<br>🏠 ${esc(o.buyer.address)}</div>`;
    const btn = (to, cls, label) => `<button class="${cls}" data-ocode="${o.code}" data-oact="${to}">${label}</button>`;
    const acts = [];
    acts.push(btn('invoice', 'info', '🧾 فاکتور'));
    const canManageThis = canManageOrder(o);
    if (canManageThis && NEXT[o.status]) acts.push(btn(NEXT[o.status], 'ok', STATUS[NEXT[o.status]].t));
    const open = o.status !== 'delivered' && o.status !== 'cancelled';
    if (open && canManageThis && o.status !== 'shipped') {
      acts.push(btn('cancelled', 'danger', 'لغو سفارش'));
    }
    return `<tr>
      <td><b>${faRaw(o.code)}</b><div class="order-meta">${esc(o.created)}</div></td>
      <td><b style="color:var(--accent)">${esc(storeName(o.storeId))}</b></td>
      <td style="text-align:right">${o.items.map(it => `${esc(it.name)} × ${fa(it.qty)}`).join('<br>')}${buyer}</td>
      <td>${fa(o.total)} تومان</td>
      <td><b style="color:${s.c}">${s.t}</b><div class="order-meta">${esc(last.time)}</div></td>
      <td><div class="btn-row">${acts.join('') || '—'}</div>${isMember() && open ? '<div class="order-meta">لغو فقط با هماهنگی فروشنده</div>' : ''}</td>
    </tr>`;
  }).join('') : emptyStateHTML(6, '🧾', 'هیچ سفارشی پیدا نشد', 'در حال حاضر سفارشی با این مشخصات در سیستم وجود ندارد.');
}
function printInvoice(code) {
  const o = orders.find(x => x.code === code);
  if (!o) return;
  const allowed = isAdmin() || (isSeller() && o.storeId === currentUser.storeId) || (isMember() && o.uid === currentUser.id);
  if (!allowed) return unauthorized('شما به این سفارش دسترسی ندارید.');
  const win = window.open('', '_blank');
  if (!win) return alert('لطفاً اجازه باز شدن پنجره پاپ‌آپ را بدهید.');
  const cell = 'border:1px solid #cbd5e1;padding:8px;text-align:center';
  const rows = o.items.map((it, i) => `<tr><td style="${cell}">${fa(i + 1)}</td><td style="${cell};text-align:right">${esc(it.name)}</td><td style="${cell}">${fa(it.qty)}</td><td style="${cell}">${fa(it.price)} تومان</td><td style="${cell}">${fa(it.price * it.qty)} تومان</td></tr>`).join('');
  const heads = ['ردیف', 'کالا', 'تعداد', 'قیمت واحد', 'جمع'].map(h => `<th style="${cell};background:#f1f5f9">${h}</th>`).join('');
  win.document.title = 'فاکتور ' + faRaw(o.code);
  win.document.documentElement.lang = 'fa';
  win.document.documentElement.dir = 'rtl';
  win.document.body.style.fontFamily = 'Tahoma,sans-serif';
  win.document.body.style.padding = '25px';
  win.document.body.style.color = '#0f172a';
  win.document.body.innerHTML = `
    <h2 style="text-align:center;border-bottom:2px solid #0284c7;padding-bottom:12px">فاکتور فروش — ${esc(storeName(o.storeId))}</h2>
    <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;margin:15px 0">
      <span>کد پیگیری: <b>${faRaw(o.code)}</b></span><span>تاریخ سفارش: ${esc(o.created)}</span><span>وضعیت: ${STATUS[o.status].t}</span>
    </div>
    <div style="font-size:13px;line-height:2;margin-bottom:14px">
      👤 ${esc(o.buyer.name)} | 📞 ${esc(o.buyer.phone)}<br>🏠 ${esc(o.buyer.address)}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:20px;border-top:2px dashed #94a3b8;padding-top:12px;font-weight:bold;text-align:left">مبلغ کل فاکتور: ${fa(o.total)} تومان</div>
  `;
  win.focus();
  setTimeout(() => win.print(), 350);
}
/* ==========================================================================
   ۴. سبد خرید و کاتالوگ فروشگاهی خریدار
   ========================================================================== */
const cartQty = id => (cart.find(x => x.id === id) || {}).qty || 0;
function cartCell(p) {
  if (p.stock <= 0) return '<button class="ok" disabled style="opacity:.45;cursor:not-allowed">🔴 ناموجود</button>';
  if (isGuest()) return '<button class="info" data-act="need-login">🔑 ورود برای خرید</button>';
  const q = cartQty(p.id);
  return q
    ? `<div class="stock"><button type="button" class="qty" data-act="cart-dec" data-id="${p.id}">-</button><b style="min-width:26px;display:inline-block;text-align:center">${fa(q)}</b><button type="button" class="qty" data-act="cart-inc" data-id="${p.id}">+</button></div>`
    : `<button class="ok" data-act="add-to-cart" data-id="${p.id}">🛒 افزودن</button>`;
}
function updateCartBadge() {
  cart = cart.filter(i => find(i.id));
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  $('#cartCount').textContent = fa(totalCount);
}
function addToCart(productId) {
  if (!isMember()) { $('#authModal').hidden = false; return; }
  const product = find(productId);
  if (!product || product.stock <= 0) return toast('این کالا ناموجود است!', 'var(--danger)');
  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    if (existingItem.qty >= product.stock) return toast(`حداکثر موجودی این کالا (${fa(product.stock)} عدد) است!`, 'var(--danger)');
    existingItem.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, storeId: product.storeId, qty: 1 });
  }
  persistState(); updateCartBadge();
  if (!existingItem) toast(`کالای "${product.name}" به سبد اضافه شد 🛒`);
  render();
}
function changeCartItemQty(id, delta) {
  const item = cart.find(x => x.id === id);
  const product = find(id);
  if (!item || !product) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) { removeCartItem(id); return; }
  if (newQty > product.stock) return toast(`سقف موجودی کالا (${fa(product.stock)} عدد) است!`, 'var(--danger)');
  item.qty = newQty;
  persistState(); updateCartBadge(); renderCartModal(); render();
}
function removeCartItem(id) {
  cart = cart.filter(x => x.id !== id);
  persistState(); updateCartBadge(); renderCartModal(); render();
}
function renderCartModal() {
  cart = cart.filter(i => find(i.id));
  const listEl = $('#cartItemsList');
  if (!cart.length) {
    listEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px 0;">سبد خرید شما در حال حاضر خالی است.</div>';
    $('#cartTotalPrice').textContent = '۰ تومان';
    return;
  }
  let grandTotal = 0;
  listEl.innerHTML = cart.map(item => {
    const cur = find(item.id), price = cur ? cur.price : item.price, itemSubtotal = price * item.qty;
    grandTotal += itemSubtotal;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);gap:10px">
        <div style="flex:1">
          <div style="font-weight:bold;font-size:13px">${esc(item.name)}</div>
          <div style="font-size:11.5px;color:var(--muted)">${esc(storeName(item.storeId))} | فی: ${fa(price)} ت</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" class="qty" data-cact="dec" data-cid="${item.id}">-</button>
          <span style="min-width:24px;text-align:center;font-weight:bold;font-size:13px">${fa(item.qty)}</span>
          <button type="button" class="qty" data-cact="inc" data-cid="${item.id}">+</button>
          <button type="button" class="danger" style="padding:4px 8px;font-size:12px;margin-right:2px" data-cact="del" data-cid="${item.id}">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  $('#cartTotalPrice').textContent = `${fa(grandTotal)} تومان`;
}
$('#cartItemsList').addEventListener('click', e => {
  const b = e.target.closest('[data-cact]');
  if (!b) return;
  const id = Number(b.dataset.cid);
  if (b.dataset.cact === 'del') removeCartItem(id);
  else changeCartItemQty(id, b.dataset.cact === 'inc' ? 1 : -1);
});
$('#openCartBtn').onclick = () => {
  renderCartModal();
  $('#orderBuyerName').value = currentUser.name || '';
  $('#orderBuyerPhone').value = currentUser.phone || '';
  $('#orderBuyerAddress').value = currentUser.address || '';
  $('#cartModal').hidden = false;
};
$('#closeCartModal').onclick = () => { $('#cartModal').hidden = true; };
$('#clearCartBtn').onclick = () => {
  if (!cart.length || !confirm('کل سبد خرید خالی شود؟')) return;
  cart = []; persistState(); updateCartBadge(); renderCartModal(); render();
};
$('#checkoutBtn').onclick = () => {
  cart = cart.filter(i => find(i.id));
  if (!cart.length) return toast('سبد خرید شما خالی است!', 'var(--danger)');
  const buyerName = $('#orderBuyerName').value.trim();
  const buyerPhone = $('#orderBuyerPhone').value.trim();
  const buyerAddress = $('#orderBuyerAddress').value.trim();
  if (!buyerName || !buyerPhone || !buyerAddress) {
    return alert('لطفاً مشخصات تحویل (نام، شماره تماس و آدرس پستی) را وارد کنید.');
  }
  currentUser.phone = buyerPhone;
  currentUser.address = buyerAddress;
  for (const item of cart) {
    const prod = find(item.id);
    if (!prod || prod.stock < item.qty) return alert(`موجودی کالای "${item.name}" کافی نیست!`);
  }
  const byStore = {};
  cart.forEach(item => {
    const prod = find(item.id);
    prod.stock -= item.qty;
    recordTransaction(prod.id, prod.storeId, 'sale', item.qty, `ثبت سفارش آنلاین توسط ${buyerName}`, -item.qty);
    (byStore[prod.storeId] = byStore[prod.storeId] || []).push({ id: prod.id, name: prod.name, price: prod.price, qty: item.qty });
  });
  const buyerInfo = { name: buyerName, phone: buyerPhone, address: buyerAddress };
  const codes = [];
  Object.entries(byStore).forEach(([sId, items]) => {
    const now = new Date().toLocaleString('fa-IR');
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const order = {
      code: newOrderCode(),
      uid: currentUser.id,
      buyer: buyerInfo,
      storeId: sId,
      items,
      total,
      status: 'pending',
      created: now,
      createdAt: nowISO(),
      history: [{ status: 'pending', time: now, by: currentUser.name }]
    };
    orders.unshift(order);
    codes.push(faRaw(order.code));
    log('sale', `ثبت سفارش جدید ${faRaw(order.code)}: ${items.map(it => `${it.name} × ${fa(it.qty)}`).join('، ')} (${fa(total)} تومان)`, sId, buyerInfo);
  });
  cart = []; persistState(); updateCartBadge(); $('#cartModal').hidden = true; render();
  showTab('orders');
  toast(`سفارش با موفقیت ثبت شد 🎉 کد پیگیری: ${codes.join('، ')}`);
};
