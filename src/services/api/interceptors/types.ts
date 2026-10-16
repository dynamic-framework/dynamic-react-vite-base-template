import type { AxiosInstance } from 'axios';

/**
 * A pluggable interceptor: registers itself on the base axios instance.
 *
 * The point of the shape is that a widget composes behaviour onto one shared
 * client (`applyInterceptors(api, [...])`) instead of building a client of its
 * own per concern. Token, `Accept-Language` and payload encryption are all just
 * entries in that array.
 */
export type ApiInterceptor = (client: AxiosInstance) => void;
