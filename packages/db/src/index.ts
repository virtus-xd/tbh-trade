/**
 * db — Drizzle client + şema barrel.
 * Frontend bu paketi yalnız server tarafında (RSC / route handler) kullanır;
 * Steam'e asla dokunmaz (Değişmez kural #1).
 */
export { getDb, getQueryClient } from "./client";
export * as schema from "./schema/index";
