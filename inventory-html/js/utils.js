/* ==========================================================================
   Generic reusable utilities
   ========================================================================== */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fa = n => Number(n).toLocaleString('fa-IR');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Empty Stateهای استاندارد برای جدول و بلوک‌های معمولی
const emptyStateHTML = (colSpan, icon, title, desc) => `
  <tr>
    <td colspan="${colSpan}" class="empty-state-cell">
      <div class="empty-box" role="status" aria-live="polite">
        <div class="empty-icon" aria-hidden="true">${icon}</div>
        <div class="empty-title">${esc(title)}</div>
        <div class="empty-desc">${esc(desc)}</div>
      </div>
    </td>
  </tr>`;

const emptyBlockHTML = (icon, title, desc) => `
  <div class="empty-block" role="status" aria-live="polite">
    <div class="empty-box">
      <div class="empty-icon" aria-hidden="true">${icon}</div>
      <div class="empty-title">${esc(title)}</div>
      <div class="empty-desc">${esc(desc)}</div>
    </div>
  </div>`;

const options = (list, selected) => (list.includes(selected) ? list : [...list, selected])
  .map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');

const faDigits = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const faRaw = s => String(s || '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const nowISO = () => new Date().toISOString();

const localDateKey = d => {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, '0'), day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const finiteNonNegative = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const debounce = (fn, ms = 120) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
