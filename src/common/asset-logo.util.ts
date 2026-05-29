type TickerViewLike = {
  logo?: { logoid?: unknown };
  "base-currency-logoid"?: unknown;
};

function initialsSvg(symbol: string, name?: string): string {
  const textRaw = (symbol || name || "?").trim();
  const text = textRaw.slice(0, 3).toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='12' fill='#1f2937'/><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='20' fill='#f3f4f6'>${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function normalizeAssetLogoUrl(logo?: string, variant: "svg" | "big" = "big"): string | undefined {
  const trimmed = (logo ?? "").trim();
  if (!trimmed) return undefined;
  if (/^(https?:|data:)/i.test(trimmed) || trimmed.startsWith("//")) return trimmed;
  if (trimmed.startsWith("/")) {
    return `https://s3-symbol-logo.tradingview.com${trimmed}`;
  }
  const logoid = trimmed.replace(/^\/+/, "");
  const suffix = variant === "big" ? "--big.svg" : ".svg";
  return `https://s3-symbol-logo.tradingview.com/${logoid}${suffix}`;
}

export function extractCryptoLogoid(input?: {
  logo?: string;
  tickerView?: unknown;
  symbol?: string;
}): string | undefined {
  const fromDoc = normalizeAssetLogoUrl(input?.logo, "svg");
  if (fromDoc) return fromDoc;

  const tickerView = input?.tickerView;
  if (tickerView && typeof tickerView === "object") {
    const tv = tickerView as TickerViewLike;
    const logoObj = tv.logo;
    if (logoObj && typeof logoObj === "object" && typeof logoObj.logoid === "string" && logoObj.logoid.trim()) {
      return normalizeAssetLogoUrl(logoObj.logoid.trim(), "svg");
    }
    const baseLogoid = tv["base-currency-logoid"];
    if (typeof baseLogoid === "string" && baseLogoid.trim()) {
      return normalizeAssetLogoUrl(baseLogoid.trim(), "svg");
    }
  }

  const symbol = (input?.symbol ?? "").trim().toUpperCase().replace(/USD$/i, "");
  if (symbol) {
    return `https://s3-symbol-logo.tradingview.com/crypto/XTVC${symbol}.svg`;
  }

  return undefined;
}

export function withStockLikeLogo(logo: string | undefined, symbol: string, name?: string): string {
  return normalizeAssetLogoUrl(logo, "big") ?? initialsSvg(symbol, name);
}

export function withCryptoLogo(input?: {
  logo?: string;
  tickerView?: unknown;
  symbol?: string;
  name?: string;
}): string {
  return extractCryptoLogoid(input) ?? initialsSvg(input?.symbol ?? "?", input?.name);
}
