import { JwtHeader } from 'jsonwebtoken'

export interface JwtVerifyOptions {
  issuer: string
  audience: string
  jwksUri: string
}

export interface JwtDependencies {
  jwksClientFactory: (jwksUri: string) => {
    getSigningKey: (
      kid: string,
      cb: (err: Error | null, key?: { getPublicKey: () => string }) => void,
    ) => void
  }
  jwtVerify: (
    token: string,
    getKey: (header: JwtHeader, cb: (err: Error | null, key?: string) => void) => void,
    options: { issuer: string; audience: string },
    cb: (err: Error | null, decoded?: unknown) => void,
  ) => void
}

export async function verifyJwtWithDeps(
  token: string,
  opts: JwtVerifyOptions,
  deps: JwtDependencies,
): Promise<Record<string, unknown>> {
  const client = deps.jwksClientFactory(opts.jwksUri)
  function getKey(header: JwtHeader, cb: (err: Error | null, key?: string) => void) {
    if (!header?.kid) return cb(new Error('Missing kid'))
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return cb(err)
      cb(null, key?.getPublicKey())
    })
  }
  return new Promise((resolve, reject) => {
    deps.jwtVerify(token, getKey, { issuer: opts.issuer, audience: opts.audience }, (err, decoded) => {
      if (err || !decoded) return reject(err || new Error('Invalid token'))
      resolve(decoded as Record<string, unknown>)
    })
  })
}


