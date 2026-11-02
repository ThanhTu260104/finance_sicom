const TOKEN_KEY = 'finance-auth-token';

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAuthToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}
