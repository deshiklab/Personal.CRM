/* X3 — biometric unlock (fingerprint / face) alongside the pincode.
 * WebAuthn platform authenticator: works for the Android app (system
 * WebView is Chrome-based), the installed PWA, and desktop Touch ID /
 * Windows Hello. PIN always remains the fallback. */
const B64U = {
  to: buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  from: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
}

export async function biometricAvailable() {
  try {
    const P = typeof window !== 'undefined' && window.PublicKeyCredential
    if (!P || !navigator.credentials) return false
    if (typeof P.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await P.isUserVerifyingPlatformAuthenticatorAvailable()
    }
    return false
  } catch { return false }
}

/* enroll the platform authenticator → returns a credential id to store */
export async function registerBiometric(label = 'Personal CRM') {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Personal CRM', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label, displayName: label },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })
  return B64U.to(cred.rawId)
}

/* verify against previously enrolled credential ids */
export async function verifyBiometric(credentialIds = []) {
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: credentialIds.map(id => ({ type: 'public-key', id: B64U.from(id) })),
      userVerification: 'required',
      timeout: 60000,
    },
  })
  return !!cred
}

export const B64U_TEST = B64U
