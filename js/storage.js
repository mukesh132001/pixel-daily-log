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

// Runs are saved under a profile id (older ones under a GitHub username).
export const runsKey = owner => "pdl:runs:" + owner.toLowerCase();
// Only read now, to move pre-profile players over.
export const LAST_USER = "pdl:lastUser";
