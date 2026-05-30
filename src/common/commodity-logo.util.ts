import { initialsSvg, normalizeAssetLogoUrl } from "./asset-logo.util";

/** TradingView CDN logoids verified to return 200 for commodity-like assets */
const SYMBOL_LOGOID: Record<string, string> = {
  XAUUSD: "metal/gold",
  XAU: "metal/gold",
  GC: "metal/gold",
  GC1: "metal/gold",
  GOLD: "metal/gold",
  XAGUSD: "metal/silver",
  XAG: "metal/silver",
  SI: "metal/silver",
  SILVER: "metal/silver",
  HG: "metal/copper",
  HG1: "metal/copper",
  COPPER: "metal/copper",
  CL: "provider/ice",
  CL1: "provider/ice",
  XPT: "metal/platinum",
  XPTUSD: "metal/platinum",
  PL: "metal/platinum",
  PLATINUM: "metal/platinum",
  PA: "metal/palladium",
  PALLADIUM: "metal/palladium",
  ALI: "metal/aluminum",
  ALUMINUM: "metal/aluminum",
  ALUMINIUM: "metal/aluminum",
  ZN: "metal/zinc",
  ZINC: "metal/zinc",
  NI: "metal/nickel",
  NICKEL: "metal/nickel",
  PB: "metal/lead",
  LEAD: "metal/lead",
  LC: "commodity/lithium",
  LITHIUM: "commodity/lithium",
  MAGN: "commodity/lithium",
  ZW: "commodity/wheat",
  WHEAT: "commodity/wheat",
  BL1: "commodity/barley",
  BARLEY: "commodity/barley",
  ZC: "commodity/corn",
  CORN: "commodity/corn",
  ZS: "commodity/soybeans",
  SOYBEANS: "commodity/soybeans",
  KC: "commodity/coffee",
  COFFEE: "commodity/coffee",
  SB: "commodity/sugar",
  SUGAR: "commodity/sugar",
  CT: "commodity/cotton",
  COTTON: "commodity/cotton",
  PLO: "commodity/palm-oil",
  "PALM OIL": "commodity/palm-oil",
  RR: "commodity/rubber",
  RUBBER: "commodity/rubber",
  TEA: "commodity/tea",
  RICE: "commodity/rice",
  DXY: "indices/u-s-dollar-index",
  CRYTR: "indices/u-s-dollar-index",
  CRB: "indices/u-s-dollar-index",
  WCI: "indices/u-s-dollar-index",
  SSECC: "indices/u-s-dollar-index",
};

const GROUP_LOGOID: Record<string, string> = {
  metals: "metal/gold",
  metal: "metal/gold",
  agricultural: "commodity/wheat",
  agriculture: "commodity/wheat",
  agri: "commodity/wheat",
  energy: "provider/ice",
  energies: "provider/ice",
  industrial: "metal/copper",
  industry: "metal/copper",
  industrials: "metal/copper",
  index: "indices/u-s-dollar-index",
  indices: "indices/u-s-dollar-index",
};

function normalizeCommoditySymbol(symbol?: string): string {
  const raw = (symbol ?? "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.includes(":")) return raw.split(":")[0]?.trim() ?? raw;
  return raw;
}

function matchLogoidByName(name?: string): string | undefined {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return undefined;
  const rules: Array<[RegExp, string]> = [
    [/\bgold\b/, "metal/gold"],
    [/\bsilver\b/, "metal/silver"],
    [/\bcopper\b/, "metal/copper"],
    [/\bplatinum\b/, "metal/platinum"],
    [/\bpalladium\b/, "metal/palladium"],
    [/\balumin/i, "metal/aluminum"],
    [/\bzinc\b/, "metal/zinc"],
    [/\bnickel\b/, "metal/nickel"],
    [/\blead\b/, "metal/lead"],
    [/\blithium\b/, "commodity/lithium"],
    [/\bwheat\b/, "commodity/wheat"],
    [/\bbarley\b/, "commodity/barley"],
    [/\bcorn\b/, "commodity/corn"],
    [/\bsoybean|\bsoy\b/, "commodity/soybeans"],
    [/\bcoffee\b/, "commodity/coffee"],
    [/\bsugar\b/, "commodity/sugar"],
    [/\bcotton\b/, "commodity/cotton"],
    [/\bpalm oil\b/, "commodity/palm-oil"],
    [/\brubber\b/, "commodity/rubber"],
    [/\brice\b/, "commodity/rice"],
    [/\btea\b/, "commodity/tea"],
    [/\boil\b|\bcrude\b|\bbrent\b|\burals\b|\bnaphtha\b|\bmethanol\b/, "provider/ice"],
    [/\bgas\b|\blng\b|\bpropane\b|\bbutane\b/, "provider/ice"],
    [/\bindex\b|\bcrb\b|\bcontainer\b/, "indices/u-s-dollar-index"],
  ];
  for (const [pattern, logoid] of rules) {
    if (pattern.test(n)) return logoid;
  }
  return undefined;
}

export function resolveCommodityLogoid(input?: {
  symbol?: string;
  name?: string;
  group?: string;
}): string | undefined {
  const symbol = normalizeCommoditySymbol(input?.symbol);
  if (symbol && SYMBOL_LOGOID[symbol]) return SYMBOL_LOGOID[symbol];

  const byName = matchLogoidByName(input?.name);
  if (byName) return byName;

  const groupKey = (input?.group ?? "").trim().toLowerCase();
  if (groupKey && GROUP_LOGOID[groupKey]) return GROUP_LOGOID[groupKey];

  return undefined;
}

export function withCommodityLogo(input?: {
  logo?: string;
  symbol?: string;
  name?: string;
  group?: string;
}): string {
  const fromDoc = normalizeAssetLogoUrl(input?.logo, "big");
  if (fromDoc) return fromDoc;

  const logoid = resolveCommodityLogoid(input);
  if (logoid) {
    return `https://s3-symbol-logo.tradingview.com/${logoid}.svg`;
  }

  return initialsSvg(input?.symbol ?? "?", input?.name);
}
