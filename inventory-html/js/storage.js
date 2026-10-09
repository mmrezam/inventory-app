/* ==========================================================================
   Storage abstraction
   ========================================================================== */

function load(key, fallback, storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value, storage = localStorage) {
  try {
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key, storage = localStorage) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getRaw(key, fallback = '', storage = localStorage) {
  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function getSession(key, fallback = null) {
  return getRaw(key, fallback, sessionStorage);
}

function setSession(key, value) {
  return save(key, String(value ?? ''), sessionStorage);
}
