import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/* ───────────────────────── Types ───────────────────────── */

interface AnalyzeRequest {
  tickers: string[];
  horizon?: "6M" | "1Y" | "3Y";
  locale?: "en" | "it";
}

interface AssetMeta {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  currency: string;
}

interface AnalysisResult {
  tickers: string[];
  horizon: string;
  assets: AssetMeta[];
  volatilities: Record<string, number>;
  portfolioVolatility: number;
  avgCorrelation: number;
  correlationLabel: "Low" | "Moderate" | "High";
  diversificationRatio: number;
  hhiSector: number;
  hhiGeo: number;
  correlationMatrix: number[][];
  sectorExposure: { name: string; value: number }[];
  geoExposure: { name: string; value: number }[];
  cumulativeReturns: { date: string; portfolio: number; [key: string]: string | number }[];
  riskSummary: {
    level: "low" | "moderate" | "high";
    title: string;
    message: string;
  };
}

/* ───────────────────────── Math helpers ───────────────────────── */

function logReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    } else {
      returns.push(0);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return 0;
  return Math.max(-1, Math.min(1, num / den));
}

function alignSeries(
  seriesMap: Map<string, { date: string; close: number }[]>
): { dates: string[]; prices: Map<string, number[]> } {
  const tickers = Array.from(seriesMap.keys());
  if (tickers.length === 0) return { dates: [], prices: new Map() };

  // Intersect common trading dates
  let commonDates = new Set(seriesMap.get(tickers[0])!.map((d) => d.date));
  for (let i = 1; i < tickers.length; i++) {
    const dates = new Set(seriesMap.get(tickers[i])!.map((d) => d.date));
    commonDates = new Set(
      Array.from(commonDates).filter((d) => dates.has(d))
    );
  }

  const sortedDates = Array.from(commonDates).sort();
  const prices = new Map<string, number[]>();

  for (const ticker of tickers) {
    const lookup = new Map(
      seriesMap.get(ticker)!.map((d) => [d.date, d.close] as [string, number])
    );
    prices.set(
      ticker,
      sortedDates.map((d) => lookup.get(d)!)
    );
  }

  return { dates: sortedDates, prices };
}

function horizonToPeriod(horizon: string): { period1: Date; period2: Date } {
  const period2 = new Date();
  const period1 = new Date();
  switch (horizon) {
    case "6M":
      period1.setMonth(period1.getMonth() - 6);
      break;
    case "3Y":
      period1.setFullYear(period1.getFullYear() - 3);
      break;
    case "1Y":
    default:
      period1.setFullYear(period1.getFullYear() - 1);
      break;
  }
  return { period1, period2 };
}

function computeHHI(weights: number[]): number {
  return weights.reduce((s, w) => s + w * w, 0);
}

function generateRiskSummary(
  portfolioVol: number,
  avgCorr: number,
  dr: number,
  hhiSector: number,
  hhiGeo: number,
  locale: "en" | "it" = "en"
): AnalysisResult["riskSummary"] {
  let score = 0;
  if (portfolioVol > 0.25) score += 2;
  else if (portfolioVol > 0.18) score += 1;
  if (avgCorr > 0.7) score += 2;
  else if (avgCorr > 0.45) score += 1;
  if (dr < 1.15) score += 2;
  else if (dr < 1.35) score += 1;
  if (hhiSector > 0.45) score += 2;
  else if (hhiSector > 0.3) score += 1;
  if (hhiGeo > 0.55) score += 1;

  const volPct = (portfolioVol * 100).toFixed(1);
  const corr = avgCorr.toFixed(2);
  const drStr = dr.toFixed(2);
  const hs = hhiSector.toFixed(2);
  const hg = hhiGeo.toFixed(2);

  if (score <= 2) {
    if (locale === "it") {
      return {
        level: "low",
        title: "Portafoglio resiliente: diversificazione efficace",
        message:
          `La volatilità annualizzata si attesta al ${volPct}%, con correlazione media inter-asset pari a ${corr}. ` +
          `Il Diversification Ratio (${drStr}) conferma un beneficio concreto dalla bassa covarianza tra i titoli. ` +
          `Gli indici HHI di settore (${hs}) e geografici (${hg}) indicano una concentrazione contenuta. ` +
          `Il profilo è coerente con i principi della Modern Portfolio Theory.`,
      };
    }
    return {
      level: "low",
      title: "Resilient portfolio: effective diversification",
      message:
        `Annualized volatility stands at ${volPct}%, with average inter-asset correlation of ${corr}. ` +
        `The Diversification Ratio (${drStr}) confirms a tangible benefit from low covariance among holdings. ` +
        `Sector HHI (${hs}) and geographic HHI (${hg}) indicate contained concentration. ` +
        `The profile is consistent with the principles of Modern Portfolio Theory.`,
    };
  }

  if (score <= 5) {
    if (locale === "it") {
      return {
        level: "moderate",
        title: "Diversificazione parziale: margini di miglioramento",
        message:
          `Volatilità annualizzata al ${volPct}% e correlazione media ${corr}. ` +
          `Il Diversification Ratio (${drStr}) segnala un beneficio di diversificazione ancora incompleto. ` +
          `HHI settoriale ${hs} e geografico ${hg} suggeriscono possibili aree di concentrazione. ` +
          `Si raccomanda di valutare asset con correlazione inferiore alla media corrente.`,
      };
    }
    return {
      level: "moderate",
      title: "Partial diversification: room for improvement",
      message:
        `Annualized volatility at ${volPct}% and average correlation ${corr}. ` +
        `The Diversification Ratio (${drStr}) indicates an incomplete diversification benefit. ` +
        `Sector HHI ${hs} and geographic HHI ${hg} suggest possible concentration areas. ` +
        `Consider adding assets with below-average pairwise correlation.`,
    };
  }

  if (locale === "it") {
    return {
      level: "high",
      title: "Alert: rischio di concentrazione elevato",
      message:
        `Volatilità annualizzata elevata (${volPct}%) e correlazione media critica (${corr}). ` +
        `Il Diversification Ratio (${drStr}) indica un beneficio da covarianza insufficiente. ` +
        `HHI settoriale ${hs} e geografico ${hg} evidenziano concentrazione marcata: ` +
        `in uno scenario di stress di mercato le perdite potrebbero amplificarsi. ` +
        `Si raccomanda una maggiore esposizione a settori e aree geografiche decorrelati.`,
    };
  }

  return {
    level: "high",
    title: "Alert: elevated concentration risk",
    message:
      `Elevated annualized volatility (${volPct}%) and critical average correlation (${corr}). ` +
      `The Diversification Ratio (${drStr}) indicates an insufficient covariance benefit. ` +
      `Sector HHI ${hs} and geographic HHI ${hg} show marked concentration: ` +
      `in a market stress scenario, losses may amplify. ` +
      `Greater exposure to decorrelated sectors and geographies is recommended.`,
  };
}

/* ───────────────────────── Data fetch ───────────────────────── */

async function fetchAssetData(
  ticker: string,
  period1: Date,
  period2: Date
): Promise<{
  meta: AssetMeta;
  series: { date: string; close: number }[];
}> {
  let name = ticker.toUpperCase();
  let sector = "Unclassified";
  let country = "Unclassified";
  let currency = "USD";

  try {
    const quoteSummary = await yahooFinance.quoteSummary(ticker, {
      modules: ["price", "summaryProfile"],
    });
    const price = quoteSummary.price;
    const profile = quoteSummary.summaryProfile;
    name = price?.longName || price?.shortName || name;
    sector = profile?.sector || sector;
    country = profile?.country || country;
    currency = price?.currency || currency;
  } catch {
    // Metadata is optional — continue with chart prices
  }

  const chart = await yahooFinance.chart(
    ticker,
    {
      period1,
      period2,
      interval: "1d",
    },
    { validateResult: false }
  );

  const quotes =
    (chart as { quotes?: Array<{ date: Date; close: number | null }> })
      ?.quotes ?? [];

  const series = quotes
    .filter((h) => h.close != null && h.close > 0 && h.date != null)
    .map((h) => ({
      date: new Date(h.date).toISOString().slice(0, 10),
      close: h.close as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (series.length < 20) {
    throw new Error(
      `Dati storici insufficienti per ${ticker} (richiesti almeno 20 sedute, trovate ${series.length}).`
    );
  }

  // Prefer currency from chart meta if available
  const chartMeta = (chart as { meta?: { currency?: string; longName?: string; shortName?: string } })
    ?.meta;
  if (chartMeta?.currency) currency = chartMeta.currency;
  if (chartMeta?.longName || chartMeta?.shortName) {
    name = chartMeta.longName || chartMeta.shortName || name;
  }

  const meta: AssetMeta = {
    ticker: ticker.toUpperCase(),
    name,
    sector,
    country,
    currency,
  };

  return { meta, series };
}

/* ───────────────────────── Handler ───────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequest;
    const rawTickers = body.tickers ?? [];
    const horizon = body.horizon ?? "1Y";
    const locale = body.locale === "it" ? "it" : "en";

    if (!Array.isArray(rawTickers) || rawTickers.length < 2) {
      return NextResponse.json(
        {
          error:
            locale === "it"
              ? "Inserire almeno 2 ticker azionari validi per eseguire l'analisi di portafoglio."
              : "Enter at least 2 valid equity tickers to run the portfolio analysis.",
        },
        { status: 400 }
      );
    }

    if (rawTickers.length > 12) {
      return NextResponse.json(
        {
          error:
            locale === "it"
              ? "Massimo 12 ticker per analisi (limite serverless)."
              : "Maximum 12 tickers per analysis (serverless limit).",
        },
        { status: 400 }
      );
    }

    const tickers = Array.from(
      new Set(
        rawTickers
          .map((t) => String(t).trim().toUpperCase())
          .filter((t) => t.length > 0 && t.length <= 15)
      )
    );

    if (tickers.length < 2) {
      return NextResponse.json(
        { error: "Dopo la normalizzazione restano meno di 2 ticker validi." },
        { status: 400 }
      );
    }

    const { period1, period2 } = horizonToPeriod(horizon);

    // Fetch all assets; collect per-ticker errors
    const results: Awaited<ReturnType<typeof fetchAssetData>>[] = [];
    const failed: string[] = [];

    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const data = await fetchAssetData(ticker, period1, period2);
          results.push(data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failed.push(`${ticker}: ${msg}`);
        }
      })
    );

    if (results.length < 2) {
      return NextResponse.json(
        {
          error: `Impossibile recuperare dati sufficienti. Dettagli: ${failed.join(" | ") || "ticker non trovati su Yahoo Finance."}`,
        },
        { status: 422 }
      );
    }

    // Keep only successfully fetched tickers
    const validTickers = results.map((r) => r.meta.ticker);
    const seriesMap = new Map(
      results.map((r) => [r.meta.ticker, r.series])
    );
    const assets = results.map((r) => r.meta);

    const { dates, prices } = alignSeries(seriesMap);

    if (dates.length < 20) {
      return NextResponse.json(
        {
          error:
            "Le serie storiche allineate presentano meno di 20 sedute comuni. Provare un orizzonte più lungo o ticker con liquidità simile.",
        },
        { status: 422 }
      );
    }

    // Log returns per asset
    const returnsMap = new Map<string, number[]>();
    for (const t of validTickers) {
      returnsMap.set(t, logReturns(prices.get(t)!));
    }

    const n = validTickers.length;
    const weight = 1 / n;

    // Annualized volatilities (252 trading days)
    const volatilities: Record<string, number> = {};
    for (const t of validTickers) {
      volatilities[t] = std(returnsMap.get(t)!) * Math.sqrt(252);
    }

    // Correlation & Covariance matrices
    const correlationMatrix: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0)
    );
    const covMatrix: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0)
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const ri = returnsMap.get(validTickers[i])!;
        const rj = returnsMap.get(validTickers[j])!;
        const corr = i === j ? 1 : pearson(ri, rj);
        correlationMatrix[i][j] = corr;
        // Annualized covariance: σ_i * σ_j * ρ_ij
        covMatrix[i][j] =
          volatilities[validTickers[i]] * volatilities[validTickers[j]] * corr;
      }
    }

    // Portfolio variance: w' Σ w (equal weights)
    let portVar = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        portVar += weight * weight * covMatrix[i][j];
      }
    }
    const portfolioVolatility = Math.sqrt(Math.max(portVar, 0));

    // Average pairwise correlation (off-diagonal)
    let corrSum = 0;
    let corrCount = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        corrSum += correlationMatrix[i][j];
        corrCount++;
      }
    }
    const avgCorrelation = corrCount > 0 ? corrSum / corrCount : 0;
    const correlationLabel: AnalysisResult["correlationLabel"] =
      avgCorrelation < 0.35
        ? "Low"
        : avgCorrelation < 0.65
          ? "Moderate"
          : "High";

    // Diversification Ratio = Σ(w_i σ_i) / σ_p
    const weightedVolSum = validTickers.reduce(
      (s, t) => s + weight * volatilities[t],
      0
    );
    const diversificationRatio =
      portfolioVolatility > 0 ? weightedVolSum / portfolioVolatility : 1;

    // Sector & Geo exposure (equal weight)
    const sectorMap = new Map<string, number>();
    const geoMap = new Map<string, number>();
    for (const a of assets) {
      sectorMap.set(a.sector, (sectorMap.get(a.sector) || 0) + weight);
      geoMap.set(a.country, (geoMap.get(a.country) || 0) + weight);
    }

    const sectorExposure = [...sectorMap.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value * 10000) / 100 }))
      .sort((a, b) => b.value - a.value);

    const geoExposure = [...geoMap.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value * 10000) / 100 }))
      .sort((a, b) => b.value - a.value);

    const hhiSector = computeHHI([...sectorMap.values()]);
    const hhiGeo = computeHHI([...geoMap.values()]);

    // Cumulative returns base 100 (portfolio equal-weight + individual)
    const retLen = returnsMap.get(validTickers[0])!.length;
    const cumulativeReturns: AnalysisResult["cumulativeReturns"] = [];
    const cumAssets: Record<string, number> = {};
    let cumPort = 100;
    for (const t of validTickers) cumAssets[t] = 100;

    // First point at base 100
    cumulativeReturns.push({
      date: dates[0],
      portfolio: 100,
      ...Object.fromEntries(validTickers.map((t) => [t, 100])),
    });

    for (let i = 0; i < retLen; i++) {
      let portRet = 0;
      for (const t of validTickers) {
        const r = returnsMap.get(t)![i];
        cumAssets[t] *= Math.exp(r);
        portRet += weight * r;
      }
      cumPort *= Math.exp(portRet);
      cumulativeReturns.push({
        date: dates[i + 1],
        portfolio: Math.round(cumPort * 100) / 100,
        ...Object.fromEntries(
          validTickers.map((t) => [t, Math.round(cumAssets[t] * 100) / 100])
        ),
      });
    }

    // Downsample if too many points (keep ~120 for chart)
    let chartData = cumulativeReturns;
    if (chartData.length > 130) {
      const step = Math.ceil(chartData.length / 120);
      chartData = chartData.filter((_, idx) => idx % step === 0 || idx === chartData.length - 1);
    }

    const riskSummary = generateRiskSummary(
      portfolioVolatility,
      avgCorrelation,
      diversificationRatio,
      hhiSector,
      hhiGeo,
      locale
    );

    const payload: AnalysisResult & { warnings?: string[] } = {
      tickers: validTickers,
      horizon,
      assets,
      volatilities: Object.fromEntries(
        Object.entries(volatilities).map(([k, v]) => [
          k,
          Math.round(v * 10000) / 10000,
        ])
      ),
      portfolioVolatility: Math.round(portfolioVolatility * 10000) / 10000,
      avgCorrelation: Math.round(avgCorrelation * 10000) / 10000,
      correlationLabel,
      diversificationRatio: Math.round(diversificationRatio * 1000) / 1000,
      hhiSector: Math.round(hhiSector * 10000) / 10000,
      hhiGeo: Math.round(hhiGeo * 10000) / 10000,
      correlationMatrix: correlationMatrix.map((row) =>
        row.map((v) => Math.round(v * 1000) / 1000)
      ),
      sectorExposure,
      geoExposure,
      cumulativeReturns: chartData,
      riskSummary,
    };

    if (failed.length > 0) {
      payload.warnings = failed;
    }

    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Errore interno del server.";
    console.error("[/api/analyze]", err);
    return NextResponse.json(
      {
        error: `Analisi interrotta: ${message}. Verificare i ticker e riprovare.`,
      },
      { status: 500 }
    );
  }
}
