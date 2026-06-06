/** Rate-limit: tek eşzamanlılık, istek-arası gecikme+jitter, 429 backoff, günlük bütçe. */
import { HttpError } from "./providers/types";

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Taban gecikmeye %30'a kadar rastgele jitter ekler (eşzamanlı desen kırma). */
export const jitter = (baseMs: number): number => baseMs + Math.floor(Math.random() * baseMs * 0.3);

export class BudgetExceededError extends Error {
  constructor(budget: number) {
    super(`Günlük istek bütçesi aşıldı (${budget}).`);
    this.name = "BudgetExceededError";
  }
}

export class RateLimiter {
  private used = 0;
  private retried429 = 0;
  private retried5xx = 0;
  constructor(private readonly budget: number) {}
  get usedCount(): number {
    return this.used;
  }
  /** Backoff'a yol açan HTTP 429 sayısı (health dashboard için). */
  get count429(): number {
    return this.retried429;
  }
  /** Backoff'a yol açan HTTP 5xx sayısı. */
  get count5xx(): number {
    return this.retried5xx;
  }
  note429(): void {
    this.retried429++;
  }
  note5xx(): void {
    this.retried5xx++;
  }
  spend(): void {
    if (this.used >= this.budget) throw new BudgetExceededError(this.budget);
    this.used++;
  }
}

/**
 * Bir Steam isteğini rate-limit + retry ile sarar:
 * - her denemeden önce bütçe harca + gecikme(+jitter)
 * - 429 / 5xx → exponential backoff (≥60s, max 5dk) ile yeniden dene
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: { limiter: RateLimiter; delayMs: number; maxRetries?: number },
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 5;
  for (let attempt = 0; ; attempt++) {
    opts.limiter.spend();
    await sleep(jitter(opts.delayMs));
    try {
      return await fn();
    } catch (err) {
      const retriable = err instanceof HttpError && (err.status === 429 || err.status >= 500);
      if (retriable && attempt < maxRetries) {
        if ((err as HttpError).status === 429) opts.limiter.note429();
        else opts.limiter.note5xx();
        const backoff = Math.min(60_000 * 2 ** attempt, 300_000);
        console.warn(
          `  [rate] HTTP ${(err as HttpError).status} → ${Math.round(backoff / 1000)}s backoff (deneme ${attempt + 1}/${maxRetries})`,
        );
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}
