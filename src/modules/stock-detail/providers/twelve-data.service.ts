import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";

export type TwelveDataInterval =
  | "1min"
  | "5min"
  | "15min"
  | "30min"
  | "45min"
  | "1h"
  | "2h"
  | "4h"
  | "1day"
  | "1week"
  | "1month";

export interface TwelveDataSeriesValue {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TwelveDataSeriesMeta {
  symbol: string;
  interval: TwelveDataInterval;
  currency: string;
  exchange: string;
  exchangeTimezone: string;
  type: string;
}

export interface TwelveDataSeries {
  meta: TwelveDataSeriesMeta;
  values: TwelveDataSeriesValue[];
}

interface CacheEntry {
  expiresAt: number;
  series: TwelveDataSeries;
}

@Injectable()
export class TwelveDataService {
  private readonly logger = new Logger(TwelveDataService.name);
  private readonly baseUrl = "https://api.twelvedata.com";
  private readonly cache = new Map<string, CacheEntry>();
  /**
   * Free tier of Twelve Data is limited to 8 req/min and 800/day, so we cache aggressively.
   * Different timeframes get different TTLs (intraday refreshes faster than weekly/monthly).
   */
  private readonly ttlByInterval: Record<TwelveDataInterval, number> = {
    "1min": 60 * 1000,
    "5min": 5 * 60 * 1000,
    "15min": 10 * 60 * 1000,
    "30min": 15 * 60 * 1000,
    "45min": 15 * 60 * 1000,
    "1h": 30 * 60 * 1000,
    "2h": 60 * 60 * 1000,
    "4h": 2 * 60 * 60 * 1000,
    "1day": 6 * 60 * 60 * 1000,
    "1week": 24 * 60 * 60 * 1000,
    "1month": 7 * 24 * 60 * 60 * 1000,
  };

  private getApiKey(): string {
    const key = process.env.TWELVEDATA_API_KEY?.trim();
    if (!key) {
      throw new HttpException(
        "TWELVEDATA_API_KEY is not configured on the API server.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return key;
  }

  private cacheKey(symbol: string, interval: TwelveDataInterval, outputsize: number, exchange?: string): string {
    return `${symbol}|${interval}|${outputsize}|${exchange ?? ""}`;
  }

  async getTimeSeries(
    symbol: string,
    interval: TwelveDataInterval,
    outputsize: number,
    options?: { exchange?: string; timeoutMs?: number },
  ): Promise<TwelveDataSeries> {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      throw new HttpException("Symbol is required for Twelve Data lookup.", HttpStatus.BAD_REQUEST);
    }
    const key = this.cacheKey(cleanSymbol, interval, outputsize, options?.exchange);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.series;
    }

    const apiKey = this.getApiKey();
    const url = new URL(`${this.baseUrl}/time_series`);
    url.searchParams.set("symbol", cleanSymbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", String(outputsize));
    url.searchParams.set("format", "JSON");
    url.searchParams.set("apikey", apiKey);
    if (options?.exchange) url.searchParams.set("exchange", options.exchange);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? 8000);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        throw new HttpException(`Twelve Data HTTP ${res.status}`, HttpStatus.BAD_GATEWAY);
      }
      const json = (await res.json()) as Record<string, unknown>;
      const status = typeof json.status === "string" ? json.status : undefined;
      if (status && status !== "ok") {
        const message = typeof json.message === "string" ? json.message : "Twelve Data error";
        const code = typeof json.code === "number" ? json.code : 502;
        throw new HttpException(
          `Twelve Data error: ${message}`,
          code === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
        );
      }
      const series = this.parseSeries(json, interval);
      this.cache.set(key, {
        series,
        expiresAt: Date.now() + (this.ttlByInterval[interval] ?? 60_000),
      });
      return series;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.logger.warn(`Twelve Data request failed for ${cleanSymbol} ${interval}: ${String(error)}`);
      throw new HttpException("Failed to fetch chart data from Twelve Data.", HttpStatus.BAD_GATEWAY);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseSeries(json: Record<string, unknown>, fallbackInterval: TwelveDataInterval): TwelveDataSeries {
    const metaRaw = (json.meta ?? {}) as Record<string, unknown>;
    const valuesRaw = Array.isArray(json.values) ? (json.values as Array<Record<string, unknown>>) : [];

    const meta: TwelveDataSeriesMeta = {
      symbol: String(metaRaw.symbol ?? ""),
      interval: (String(metaRaw.interval ?? fallbackInterval) as TwelveDataInterval) ?? fallbackInterval,
      currency: String(metaRaw.currency ?? "USD"),
      exchange: String(metaRaw.exchange ?? ""),
      exchangeTimezone: String(metaRaw.exchange_timezone ?? ""),
      type: String(metaRaw.type ?? ""),
    };

    const values: TwelveDataSeriesValue[] = valuesRaw
      .map((row) => ({
        datetime: String(row.datetime ?? ""),
        open: Number(row.open ?? 0),
        high: Number(row.high ?? 0),
        low: Number(row.low ?? 0),
        close: Number(row.close ?? 0),
        volume: Number(row.volume ?? 0),
      }))
      .filter((row) => Number.isFinite(row.close) && row.close > 0)
      .reverse(); // Twelve Data returns newest-first; reverse to chronological order

    return { meta, values };
  }
}
