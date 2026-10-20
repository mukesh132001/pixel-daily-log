// Small wrapper around localStorage that never throws (private mode, full storage, etc.).

export const store = {
  get(k, fallback) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
};

export const runsKey = user => "pdl:runs:" + user.toLowerCase();
export const LAST_USER = "pdl:lastUser";
