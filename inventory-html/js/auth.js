/* ==========================================================================
   Authentication and authorization boundary
   ========================================================================== */

const ACTIONS = ['manageProducts', 'manageInventory', 'manageUsers', 'manageStores', 'viewReports', 'viewLogs', 'backup', 'reset', 'viewOrders', 'manageOrders'];
const grant = (...on) => Object.fromEntries(ACTIONS.map(a => [a, on.includes(a)]));
const permissions = {
  admin: grant(...ACTIONS),
  seller: grant('manageProducts', 'manageInventory', 'viewReports', 'viewLogs', 'viewOrders', 'manageOrders'),
  customer: grant('viewOrders'),
  guest: grant()
};

const isAdmin = () => currentUser.role === 'admin';
const isSeller = () => currentUser.role === 'seller';
const isMember = () => currentUser.role === 'customer';
const isGuest = () => currentUser.role === 'guest';
const isCustomer = () => isMember() || isGuest();

function can(action) {
  const rolePerms = permissions[currentUser.role];
  return !!(rolePerms && rolePerms[action]);
}

function canAccessProduct(p) {
  if (!p) return false;
  if (isAdmin()) return true;
  if (isSeller()) return p.storeId === currentUser.storeId;
  return false;
}

function unauthorized(msg = 'شما دسترسی لازم برای انجام این عملیات را ندارید!') {
  toast(msg, 'var(--danger)');
  return false;
}

const hashPin = s => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const str = 'wh:' + faDigits(String(s || '').trim());
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return String(4294967296 * (2097151 & h2) + (h1 >>> 0));
};

function newSubscriptionNo() {
  let n;
  do { n = String(10000 + Math.floor(Math.random() * 90000)); } while (users.some(u => u.subscriptionNo === n));
  return n;
}

function ensureCredentials() {
  const admin = users.find(u => u.role === 'admin' || u.id === 'u_admin');
  if (admin) {
    admin.username = admin.username || 'admin';
    if (!admin.pinHash) admin.pinHash = hashPin('admin123');
    delete admin.status;
  }
  const s1 = users.find(u => u.id === 'u_s1' || u.username === 'seller1');
  if (s1) {
    s1.username = s1.username || 'seller1';
    if (!s1.pinHash) s1.pinHash = hashPin('1234');
    s1.storeId = s1.storeId || 'store1';
    delete s1.status;
  }
  const s2 = users.find(u => u.id === 'u_s2' || u.username === 'seller2');
  if (s2) {
    s2.username = s2.username || 'seller2';
    if (!s2.pinHash) s2.pinHash = hashPin('1234');
    s2.storeId = s2.storeId || 'store2';
    delete s2.status;
  }
  const c1 = users.find(u => u.id === 'u_c1' || u.username === 'sara');
  if (c1) {
    c1.username = c1.username || 'sara';
    c1.phone = c1.phone || '09351234567';
    if (!c1.pinHash) c1.pinHash = hashPin('1234');
    c1.subscriptionNo = c1.subscriptionNo || '12345';
  }
  users.forEach(u => {
    if (u.role === 'customer' && !u.subscriptionNo) u.subscriptionNo = newSubscriptionNo();
    if (!u.username) u.username = u.phone ? faDigits(u.phone) : u.id.replace('u_', '');
    if (!u.pinHash) u.pinHash = hashPin(u.role === 'admin' ? 'admin123' : '1234');
  });
}

ensureCredentials();
