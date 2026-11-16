import { auth } from './firebase';

export async function getOptionalFirebaseAuthHeaders(
  extraHeaders?: HeadersInit
): Promise<Headers> {
  const headers = new Headers(extraHeaders);
  const current = auth.currentUser;
  if (current) {
    try {
      const token = await current.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {
      // Non-blocking fallback for guest / offline state
    }
  }
  return headers;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = await getOptionalFirebaseAuthHeaders(init.headers);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    headers,
  });
}
