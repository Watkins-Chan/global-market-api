import { CommodityInsightItem, CommodityMarketDriverItem } from "./commodities.types";

export const COMMODITY_MARKET_DRIVERS_MOCK: CommodityMarketDriverItem[] = [
  {
    id: "usd-strength",
    icon: "dollar-sign",
    title: "US Dollar Strength",
    description:
      "The dollar index (DXY) remains elevated at 104.5, putting downward pressure on dollar-denominated commodities like gold and oil.",
    impact: "Bearish for metals",
    sentiment: "bearish",
  },
  {
    id: "opec-cuts",
    icon: "fuel",
    title: "OPEC+ Production Cuts",
    description:
      "Extended voluntary production cuts of 2.2M bpd through Q2 2026 continue to tighten global oil supply balances.",
    impact: "Bullish for energy",
    sentiment: "bullish",
  },
  {
    id: "inflation-rates",
    icon: "bar-chart-3",
    title: "Inflation & Rate Expectations",
    description:
      "Persistent core inflation above 3% is driving safe-haven demand for gold while keeping real yields volatile.",
    impact: "Bullish for gold",
    sentiment: "bullish",
  },
  {
    id: "china-demand",
    icon: "factory",
    title: "China Industrial Demand",
    description:
      "China's manufacturing PMI at 50.8 signals modest expansion, supporting demand for copper, aluminum, and nickel.",
    impact: "Bullish for industrials",
    sentiment: "bullish",
  },
  {
    id: "crop-outlook",
    icon: "wheat",
    title: "Global Crop Outlook",
    description:
      "Favorable weather conditions in major producing regions are weighing on grain prices despite geopolitical risks.",
    impact: "Bearish for agriculture",
    sentiment: "bearish",
  },
  {
    id: "green-energy",
    icon: "gem",
    title: "Green Energy Transition",
    description:
      "Solar panel and EV battery production continues to drive structural demand growth for silver, copper, and lithium.",
    impact: "Bullish for metals",
    sentiment: "bullish",
  },
];

export const COMMODITY_INSIGHTS_MOCK: CommodityInsightItem[] = [
  {
    id: "gold-inflation-hedge",
    category: "Macro Insight",
    title: "Inflation hedging demand drives gold to new highs",
    summary:
      "Central bank purchases and geopolitical risk are supporting gold prices at record levels.",
  },
  {
    id: "opec-oil-tightening",
    category: "Energy Watch",
    title: "Oil markets tighten as OPEC+ extends production cuts",
    summary:
      "Supply discipline from major producers is keeping crude oil prices elevated despite demand uncertainty.",
  },
  {
    id: "silver-solar-demand",
    category: "Commodity Analysis",
    title: "Silver demand surges on solar panel manufacturing boom",
    summary:
      "Industrial demand from the green energy transition is creating a structural supply deficit for silver.",
  },
];
