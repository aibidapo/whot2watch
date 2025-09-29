declare module 'jsonwebtoken' {
  // minimal typing for verify
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function verify(token: string, getKey: any, options: any, cb: any): void;
  const jsonwebtoken: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verify: (token: string, getKey: any, options: any, cb: any) => void;
  };
  export default jsonwebtoken;
}
