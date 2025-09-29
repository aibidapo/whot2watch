import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { JwtDependencies, JwtVerifyOptions, verifyJwtWithDeps } from './jwtCore';

export async function verifyJwt(
  token: string,
  opts: JwtVerifyOptions,
): Promise<Record<string, unknown>> {
  // Allow tests to override jsonwebtoken.verify via global stub
  const verifyFn = (jwt as any)?.verify as JwtDependencies['jwtVerify'];
  return verifyJwtWithDeps(token, opts, {
    jwksClientFactory: (jwksUri) => jwksClient({ jwksUri }),
    jwtVerify: verifyFn,
  });
}
