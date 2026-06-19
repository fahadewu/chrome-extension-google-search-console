// OAuth via chrome.identity, routed through the background service worker.
// Why through the background: a popup closes when Google's consent window takes
// focus, which can abort an in-popup getAuthToken. The service worker never
// closes, so interactive sign-in completes reliably and Chrome caches the token
// — the user signs in once and silent refresh handles everything after.

export function getToken({ interactive }) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "auth:getToken", interactive }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!res || !res.token) {
        reject(new Error(res?.error || "Not signed in"));
        return;
      }
      resolve(res.token);
    });
  });
}

// Drop a token Chrome has cached (e.g. after a 401) so the next request
// fetches a fresh one.
export function removeCachedToken(token) {
  return new Promise((resolve) => {
    if (!token) return resolve();
    chrome.runtime.sendMessage({ type: "auth:removeToken", token }, () => resolve());
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
