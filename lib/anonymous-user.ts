export const anonymousUserStorageKey = "boardgame-card-studio-user-id";

export function getOrCreateAnonymousUserId() {
  const existingUserId = window.localStorage.getItem(anonymousUserStorageKey);

  if (existingUserId) return existingUserId;

  const userId = window.crypto.randomUUID();
  window.localStorage.setItem(anonymousUserStorageKey, userId);
  return userId;
}
