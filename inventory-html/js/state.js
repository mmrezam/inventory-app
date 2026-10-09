/* ==========================================================================
   Application state, defaults, normalization and persistence
   ========================================================================== */

const UNCAT = 'بدون دسته';
const CATEGORIES = {
  'مواد غذایی و خوراکی': ['لبنیات و تخم‌مرغ', 'خواربار و اساسی', 'فرآورده‌های پروتئینی', 'نوشیدنی‌ها', 'تنقلات و شیرینی‌جات',
    'صبحانه و نوشیدنی‌های گرم', 'کنسرو و غذاهای آماده', 'سس و چاشنی‌ها', 'نان و فرآورده‌های آردی'],
  'آرایشی، بهداشتی و سلولزی': ['محصولات سلولزی', 'بهداشت فردی و حمام', 'بهداشت دهان و دندان', 'مراقبت از پوست و مو'],
  'شوینده و نظافت منزل': ['شستشوی ظروف', 'شستشوی البسه', 'سطوح و ضدعفونی‌کننده‌ها', 'ملزومات مصرفی خانه'],
  'دخانیات و ملزومات وابسته': ['سیگار', 'تنباکو و معسل', 'زغال و وسایل مشتعل‌کننده', 'ویپ، پاد و اکسسوری', 'کاغذ و پیپ'],
  'ملزومات روزمره و ابزارک‌ها': ['وسایل الکتریکی مصرفی', 'پلاستیک و یکبارمصرف'],
  [UNCAT]: ['متفرقه']
};

const DEFAULT_STORES = [
  { id: 'store1', name: 'سوپرمارکت ۱' },
  { id: 'store2', name: 'سوپرمارکت ۲' }
];

const DEFAULT_USERS = [
  { id: 'u_admin', name: 'مدیر ارشد سیستم', username: 'admin', role: 'admin', storeId: null, phone: '0218888888', address: 'دفتر مرکزی' },
  { id: 'u_s1', name: 'علی رضایی (فروشنده ۱)', username: 'seller1', role: 'seller', storeId: 'store1', phone: '09121111111', address: 'تهران، سوپرمارکت ۱' },
  { id: 'u_s2', name: 'رضا حسینی (فروشنده ۲)', username: 'seller2', role: 'seller', storeId: 'store2', phone: '09122222222', address: 'تهران، سوپرمارکت ۲' },
  { id: 'u_c1', name: 'سارا محمدی', username: 'sara', role: 'customer', storeId: null, phone: '09351234567', address: 'تهران، سعادت‌آباد، پلاک ۱۲', subscriptionNo: '12345' }
];

const GUEST = { id: 'guest', name: 'کاربر مهمان', role: 'guest', storeId: null };
const LOW_STOCK = 5, DISCOUNT = 0.9;

const normalizeStore = s => ({
  id: String(s?.id || uid('store')),
  name: String(s?.name || 'فروشگاه بدون نام').trim() || 'فروشگاه بدون نام'
});

const normalizeUser = u => ({
  ...u,
  id: String(u?.id || uid('u')),
  name: String(u?.name || 'کاربر').trim() || 'کاربر',
  username: String(u?.username || u?.phone || u?.id).trim().toLowerCase(),
  role: ['admin','seller','customer'].includes(u?.role) ? u.role : 'customer',
  storeId: u?.storeId || null,
  phone: String(u?.phone || ''),
  address: String(u?.address || '')
});

const subsOf = cat => CATEGORIES[cat] || [];

let stores = (Array.isArray(load('inventoryStores', DEFAULT_STORES)) ? load('inventoryStores', DEFAULT_STORES) : DEFAULT_STORES).map(normalizeStore);
let users = (Array.isArray(load('inventoryUsers', DEFAULT_USERS)) ? load('inventoryUsers', DEFAULT_USERS) : DEFAULT_USERS).map(normalizeUser);

let savedId = getSession('sessionUser', null);
let currentUser = users.find(u => u.id === savedId) || GUEST;

const normalize = list => (Array.isArray(list) ? list : []).map((p, i) => {
  let sId = p?.storeId || p?.shop;
  if (sId === 'سوپرمارکت ۱' || sId === 's1') sId = 'store1';
  if (sId === 'سوپرمارکت ۲' || sId === 's2') sId = 'store2';
  if (!sId || !stores.some(st => st.id === sId)) sId = stores[0]?.id || 'store1';
  const category = CATEGORIES[p?.category] ? p.category : UNCAT;
  const subs = subsOf(category);
  const subcategory = subs.includes(p?.subcategory) ? p.subcategory : (subs[0] || 'متفرقه');
  const rawId = Number(p?.id);
  return {
    id: Number.isFinite(rawId) ? rawId : Date.now() + i,
    name: String(p?.name || 'کالای بدون نام').trim(),
    category,
    subcategory,
    price: finiteNonNegative(p?.price),
    stock: finiteNonNegative(p?.stock),
    storeId: sId
  };
});

let products = normalize(load('inventoryData', []));
let logs = load('inventoryLogs', []);
let logArchive = load('inventoryLogArchive', []);
let orders = load('inventoryOrders', []);
let sales = load('inventorySales', []);
let inventoryTransactions = load('inventoryTransactions', []);
let carts = load('customerCarts', {});
let cart = (currentUser.role === 'customer') ? (carts[currentUser.id] || []) : [];

let editId = null, deleteId = null, stockFilter = 'all', catFilter = 'all', subFilter = 'all', storeFilter = 'all';
let logFilter = 'all';
const drafts = {};
