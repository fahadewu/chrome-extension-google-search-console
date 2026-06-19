// OAuth via chrome.identity. Chrome caches and refreshes the token for us,
// so we just ask for it (non-interactively first, interactively on demand).

export function getToken({ interactive }) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "Not signed in"));
        return;
      }
      resolve(token);
    });
  });
}

// Drop a token Chrome has cached (e.g. after a 401) so the next request
// fetches a fresh one.
export function removeCachedToken(token) {
  return new Promise((resolve) => {
    if (!token) return resolve();
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

// Full sign-out: revoke the grant with Google and clear the local cache.
export async function signOut() {
  let token;
  try {
    token = await getToken({ interactive: false });
  } catch {
    return; // already signed out
  }
  try {
    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
  } catch {
    // best-effort revoke
  }
  await removeCachedToken(token);
}
