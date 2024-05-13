import { HttpServer } from '@effect/platform';
import { unixEpochStartDate } from './time';

const DELETED_COOKIE_VALUE = 'DELETED';

type CookieOptions = NonNullable<HttpServer.cookies.Cookie['options']>;
type CookieOptionsWithoutExpires = CookieOptions extends undefined
  ? never
  : Omit<CookieOptions, 'expires'>;

export const deleteCookie = (name: string, opts: CookieOptionsWithoutExpires) =>
  HttpServer.response.setCookie(name, DELETED_COOKIE_VALUE, {
    expires: unixEpochStartDate,
    ...opts,
  });

export const deleteCookies = (
  cookies: [string, CookieOptionsWithoutExpires][],
) =>
  HttpServer.response.setCookies(
    cookies.map((rawCookie) => {
      const [name, opts] = rawCookie;
      return [
        name,
        DELETED_COOKIE_VALUE,
        { expires: unixEpochStartDate, ...opts },
      ];
    }),
  );

export const statusCodes = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;
