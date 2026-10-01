import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface SearchHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  sector?: string;
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (q.length < 1) {
      return NextResponse.json({ results: [] as SearchHit[] });
    }

    if (q.length > 40) {
      return NextResponse.json(
        { error: "Query troppo lunga." },
        { status: 400 }
      );
    }

    const data = await yahooFinance.search(q, {
      quotesCount: 8,
      newsCount: 0,
    });

    const allowed = new Set(["EQUITY", "ETF"]);

    const results: SearchHit[] = (data.quotes ?? [])
      .filter((quote) => {
        const symbol =
          "symbol" in quote && typeof quote.symbol === "string"
            ? quote.symbol
            : "";
        if (!symbol) return false;
        if ("quoteType" in quote && quote.quoteType) {
          return allowed.has(String(quote.quoteType));
        }
        return /^[A-Z0-9.^=-]{1,15}$/i.test(symbol);
      })
      .map((quote) => {
        const q = quote as {
          symbol: string;
          shortname?: string;
          longname?: string;
          exchDisp?: string;
          exchange?: string;
          quoteType?: string;
          typeDisp?: string;
          sector?: string;
        };
        return {
          symbol: String(q.symbol).toUpperCase(),
          name: q.longname || q.shortname || String(q.symbol),
          exchange: q.exchDisp || q.exchange || "",
          type: q.typeDisp || q.quoteType || "Equity",
          sector: q.sector,
        };
      })
      .filter(
        (hit, idx, arr) =>
          arr.findIndex((x) => x.symbol === hit.symbol) === idx
      )
      .slice(0, 8);

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore ricerca.";
    console.error("[/api/search]", err);
    return NextResponse.json(
      { error: `Ricerca non disponibile: ${message}`, results: [] },
      { status: 500 }
    );
  }
}
