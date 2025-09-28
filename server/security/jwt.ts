import jwksClient from 'jwks-rsa';
import jwt, { JwtHeader } from 'jsonwebtoken';
import { JwtDependencies, JwtVerifyOptions, verifyJwtWithDeps } from './jwtCore';

export async function verifyJwt(
  token: string,
  opts: JwtVerifyOptions,
): Promise<Record<string, unknown>> {
  return verifyJwtWithDeps(token, opts, {
    jwksClientFactory: (jwksUri) => jwksClient({ jwksUri }),
    jwtVerify: jwt.verify as unknown as JwtDependencies['jwtVerify'],
  });
}
