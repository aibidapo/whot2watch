import jwksClient from 'jwks-rsa'
import jwt, { JwtHeader } from 'jsonwebtoken'

export interface JwtVerifyOptions {
  issuer: string
  audience: string
  jwksUri: string
}

export async function verifyJwt(token: string, opts: JwtVerifyOptions): Promise<Record<string, unknown>> {
  const client = jwksClient({ jwksUri: opts.jwksUri })
  function getKey(header: JwtHeader, cb: (err: Error | null, key?: string) => void) {
    if (!header.kid) return cb(new Error('Missing kid'))
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return cb(err)
      cb(null, key?.getPublicKey())
    })
  }
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { issuer: opts.issuer, audience: opts.audience }, (err, decoded) => {
      if (err || !decoded) return reject(err || new Error('Invalid token'))
      resolve(decoded as any)
    })
  })
}


