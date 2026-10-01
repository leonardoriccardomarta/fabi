"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Globe2,
  Info,
  Layers,
  Loader2,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

type Horizon = "6M" | "1Y" | "3Y";

interface AnalysisResult {
  tickers: string[];
  horizon: string;
  assets: {
    ticker: string;
    name: string;
    sector: string;
    country: string;
    currency: string;
  }[];
  volatilities: Record<string, number>;
  portfolioVolatility: number;
  avgCorrelation: number;
  correlationLabel: "Bassa" | "Moderata" | "Critica";
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
  warnings?: string[];
}

const PRESETS: Record<string, { label: string; tickers: string[] }> = {
  global: {
    label: "Global Diversified",
    tickers: ["AAPL", "ASML", "ENI.MI", "RELIANCE.NS", "BABA"],
  },
  tech: {
    label: "US Tech Concentrated",
    tickers: ["AAPL", "MSFT", "NVDA", "GOOGL", "META"],
  },
  defensive: {
    label: "Defensive Mix",
    tickers: ["JNJ", "PG", "KO", "XOM"],
  },
};

const PIE_COLORS = [
  "#10b981",
  "#6366f1",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
  "#ef4444",
  "#84cc16",
  "#06b6d4",
];

function corrColor(v: number): string {
  // -1 → indigo, 0 → slate, +1 → emerald-red scale (red = high corr = risk)
  if (v >= 0.7) return "bg-rose-500/90 text-white";
  if (v >= 0.4) return "bg-amber-500/80 text-slate-950";
  if (v >= 0.15) return "bg-emerald-600/70 text-white";
  if (v >= -0.15) return "bg-slate-700 text-slate-200";
  if (v >= -0.4) return "bg-indigo-600/70 text-white";
  return "bg-indigo-400/90 text-slate-950";
}

function corrLabelColor(label: string): string {
  if (label === "Bassa") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (label === "Moderata") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-rose-500/15 text-rose-400 border-rose-500/30";
}

interface SearchHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  sector?: string;
}

export default function HomePage() {
  const [tickers, setTickers] = useState<string[]>(["AAPL", "MSFT", "ASML", "ENI.MI"]);
  const [input, setInput] = useState("");
  const [horizon, setHorizon] = useState<Horizon>("1Y");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showDrTip, setShowDrTip] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addTicker = useCallback(
    (raw: string) => {
      const t = raw.trim().toUpperCase();
      if (!t) return;
      if (tickers.includes(t)) {
        setInput("");
        setSearchHits([]);
        setSearchOpen(false);
        return;
      }
      if (tickers.length >= 12) {
        setError("Massimo 12 ticker per analisi.");
        return;
      }
      setTickers((prev) => [...prev, t]);
      setInput("");
      setSearchHits([]);
      setSearchOpen(false);
      setError(null);
    },
    [tickers]
  );

  const runCompanySearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 1) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchHits((data.results as SearchHit[]) ?? []);
      setActiveIdx(0);
    } catch {
      setSearchHits([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const scheduleSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runCompanySearch(query), 280);
    },
    [runCompanySearch]
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const openSearchPanel = () => {
    setSearchOpen(true);
    inputRef.current?.focus();
    if (input.trim()) scheduleSearch(input);
  };

  const removeTicker = (t: string) => {
    setTickers((prev) => prev.filter((x) => x !== t));
  };

  const applyPreset = (key: string) => {
    setTickers([...PRESETS[key].tickers]);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchOpen && searchHits.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, searchHits.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        addTicker(searchHits[activeIdx]?.symbol ?? input);
        return;
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        return;
      }
    }
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTicker(input.replace(/,/g, ""));
    }
    if (e.key === "Backspace" && !input && tickers.length > 0) {
      removeTicker(tickers[tickers.length - 1]);
    }
  };

  const runAnalysis = async () => {
    if (tickers.length < 2) {
      setError("Inserire almeno 2 ticker per l'analisi di portafoglio.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers, horizon }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante l'analisi.");
        return;
      }
      setResult(data as AnalysisResult);
    } catch {
      setError(
        "Impossibile contattare il motore di analisi. Verificare la connessione e riprovare."
      );
    } finally {
      setLoading(false);
    }
  };

  const riskIcon = useMemo(() => {
    if (!result) return null;
    if (result.riskSummary.level === "low")
      return <ShieldCheck className="h-5 w-5 text-emerald-400" />;
    if (result.riskSummary.level === "moderate")
      return <Shield className="h-5 w-5 text-amber-400" />;
    return <ShieldAlert className="h-5 w-5 text-rose-400" />;
  }, [result]);

  const riskBoxStyle = useMemo(() => {
    if (!result) return "";
    if (result.riskSummary.level === "low")
      return "border-emerald-500/30 bg-emerald-500/5";
    if (result.riskSummary.level === "moderate")
      return "border-amber-500/30 bg-amber-500/5";
    return "border-rose-500/30 bg-rose-500/5";
  }, [result]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ───── Header ───── */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 shadow-glow">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-slate-100 truncate">
              Portfolio Risk &amp; Diversification Engine
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-indigo-300 tracking-wide uppercase">
                <Sparkles className="h-3 w-3" />
                Quantitative Risk Engine
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* ───── Input Section ───── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 shadow-glow-indigo/50">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-400" />
                Costruzione Portafoglio
              </h2>
          <p className="text-sm text-slate-400 mt-1">
                Cerca per nome azienda o ticker (es. Apple, ENI, Reliance). Pesi equi 1/N.
              </p>
            </div>
          </div>

          {/* Chip input + company search */}
          <div ref={searchBoxRef} className="relative">
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 focus-within:border-emerald-500/50 transition-colors min-h-[52px]"
              onClick={() => {
                inputRef.current?.focus();
                setSearchOpen(true);
              }}
            >
              {tickers.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 pl-2.5 pr-1.5 py-1 text-sm font-mono text-emerald-300"
                >
                  {t}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTicker(t);
                    }}
                    className="rounded-md p-0.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                    aria-label={`Rimuovi ${t}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <div className="flex flex-1 items-center gap-2 min-w-[140px]">
                <Search className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                <input
                  id="ticker-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInput(v);
                    setSearchOpen(true);
                    scheduleSearch(v);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    tickers.length === 0
                      ? "Cerca azienda o ticker…"
                      : "Aggiungi azienda…"
                  }
                  className="flex-1 bg-transparent outline-none text-sm text-slate-200 placeholder:text-slate-600 py-1"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={searchOpen}
                  aria-controls="company-search-list"
                  aria-autocomplete="list"
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openSearchPanel();
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                aria-label="Apri ricerca aziende"
                title="Cerca azienda"
              >
                <Plus className="h-4 w-4" />
              </button>
              {tickers.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTickers([]);
                  }}
                  className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  aria-label="Svuota portafoglio"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search dropdown */}
            {searchOpen && (
              <div
                id="company-search-list"
                role="listbox"
                className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-xl shadow-black/40"
              >
                {input.trim().length === 0 && !searchLoading && (
                  <div className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-600" />
                    Digita il nome azienda o il ticker (es. Apple, Eni, ASML)…
                  </div>
                )}
                {searchLoading && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    Ricerca in corso…
                  </div>
                )}
                {!searchLoading && searchHits.length === 0 && input.trim().length > 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    Nessun risultato per &ldquo;{input.trim()}&rdquo;. Prova il ticker esatto e premi Enter.
                  </div>
                )}
                {!searchLoading &&
                  searchHits.map((hit, idx) => {
                    const already = tickers.includes(hit.symbol);
                    return (
                      <button
                        key={`${hit.symbol}-${hit.exchange}`}
                        type="button"
                        role="option"
                        aria-selected={idx === activeIdx}
                        disabled={already}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onMouseDown={(e) => {
                          // prevent input blur before click
                          e.preventDefault();
                          if (!already) addTicker(hit.symbol);
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          idx === activeIdx
                            ? "bg-slate-800/90"
                            : "hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
                          <Building2 className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-emerald-300">
                              {hit.symbol}
                            </span>
                            <span className="truncate text-sm text-slate-200">
                              {hit.name}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">
                            <span>{hit.type}</span>
                            {hit.exchange && <span>· {hit.exchange}</span>}
                            {hit.sector && <span>· {hit.sector}</span>}
                            {already && (
                              <span className="text-amber-500">già nel portafoglio</span>
                            )}
                          </div>
                        </div>
                        {!already && (
                          <Plus className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Presets */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 self-center mr-1">Preset:</span>
            {Object.entries(PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="rounded-lg border border-slate-700 bg-slate-850/50 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Horizon + Analyze */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Orizzonte</span>
              <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/50 p-0.5">
                {(["6M", "1Y", "3Y"] as Horizon[]).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorizon(h)}
                    className={`px-3.5 py-1.5 text-sm rounded-md font-medium transition-all ${
                      horizon === h
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading || tickers.length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisi in corso…
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  Analizza Portafoglio
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 animate-fade-in">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* ───── Loading skeletons ───── */}
        {loading && (
          <section className="space-y-6 animate-pulse-slow">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl border border-slate-800 bg-slate-900/50"
                />
              ))}
            </div>
            <div className="h-72 rounded-2xl border border-slate-800 bg-slate-900/50" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-64 rounded-2xl border border-slate-800 bg-slate-900/50" />
              <div className="h-64 rounded-2xl border border-slate-800 bg-slate-900/50" />
            </div>
          </section>
        )}

        {/* ───── Results Dashboard ───── */}
        {result && !loading && (
          <div className="space-y-6 animate-slide-up">
            {result.warnings && result.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <strong className="font-medium">Avvisi:</strong>{" "}
                {result.warnings.join(" · ")}
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                label="Volatilità Portafoglio"
                value={`${(result.portfolioVolatility * 100).toFixed(2)}%`}
                sub="Annualizzata (σ√252)"
              />
              <KpiCard
                icon={<Activity className="h-4 w-4 text-indigo-400" />}
                label="Correlazione Media"
                value={result.avgCorrelation.toFixed(3)}
                sub={
                  <span
                    className={`inline-flex mt-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${corrLabelColor(result.correlationLabel)}`}
                  >
                    {result.correlationLabel}
                  </span>
                }
              />
              <div className="relative rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    Diversification Ratio
                  </div>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-300"
                    onMouseEnter={() => setShowDrTip(true)}
                    onMouseLeave={() => setShowDrTip(false)}
                    onClick={() => setShowDrTip((v) => !v)}
                    aria-label="Tooltip Diversification Ratio"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-2xl sm:text-3xl font-semibold font-mono text-slate-50">
                  {result.diversificationRatio.toFixed(3)}
                </p>
                <p className="text-xs text-slate-500 mt-1">DR = Σ(wᵢσᵢ) / σₚ</p>
                {showDrTip && (
                  <div className="absolute z-20 right-3 top-12 max-w-[220px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 shadow-xl">
                    Beneficio da covarianza: valori &gt; 1 indicano riduzione del rischio
                    grazie alla decorrelazione tra asset.
                  </div>
                )}
              </div>
              <KpiCard
                icon={<Globe2 className="h-4 w-4 text-amber-400" />}
                label="Indice HHI"
                value={
                  <span className="text-lg sm:text-xl">
                    S {(result.hhiSector * 100).toFixed(1)}
                    <span className="text-slate-500 font-normal text-sm"> · </span>
                    G {(result.hhiGeo * 100).toFixed(1)}
                  </span>
                }
                sub="Settoriale · Geografico (×100)"
              />
            </div>

            {/* Correlation Heatmap */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 overflow-x-auto">
              <h3 className="text-base font-semibold text-slate-100 mb-1">
                Matrice di Correlazione di Pearson
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Ogni cella misura quanto due titoli si muovono insieme (−1 opposti, 0 indipendenti, +1 identici).
                Diagonale = 1.00 (un titolo con se stesso). Scala: indigo (negativa) → slate (neutra) → amber/rose (positiva elevata).
              </p>
              <div className="overflow-x-auto">
                <div
                  className="inline-grid gap-1 mx-auto"
                  style={{
                    gridTemplateColumns: `minmax(4.5rem, auto) repeat(${result.tickers.length}, 3.25rem)`,
                  }}
                >
                  {/* corner */}
                  <div />
                  {result.tickers.map((t) => (
                    <div
                      key={`h-${t}`}
                      className="flex items-end justify-center pb-1 text-[9px] sm:text-[10px] font-mono text-slate-400 font-medium text-center leading-tight break-all px-0.5"
                      title={t}
                    >
                      {t}
                    </div>
                  ))}
                  {result.correlationMatrix.map((row, i) => (
                    <div key={`r-${result.tickers[i]}`} className="contents">
                      <div className="flex items-center justify-end pr-2 text-[9px] sm:text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {result.tickers[i]}
                      </div>
                      {row.map((v, j) => (
                        <div
                          key={`${i}-${j}`}
                          className={`flex h-11 w-[3.25rem] items-center justify-center rounded-md text-[10px] sm:text-xs font-mono font-medium ${corrColor(v)}`}
                          title={`${result.tickers[i]} ↔ ${result.tickers[j]}: ${v.toFixed(3)}`}
                        >
                          {v.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Donut charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ExposureChart
                title="Esposizione Geografica"
                data={result.geoExposure}
              />
              <ExposureChart
                title="Esposizione Settoriale"
                data={result.sectorExposure}
              />
            </div>

            {/* Cumulative returns */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
              <h3 className="text-base font-semibold text-slate-100 mb-1">
                Andamento Cumulativo dei Rendimenti
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Base 100 — portafoglio equi-pesato (linea evidenziata)
              </p>
              <div className="h-72 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.cumulativeReturns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      tickFormatter={(d: string) => d.slice(5)}
                      minTickGap={40}
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      domain={["auto", "auto"]}
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="portfolio"
                      name="Portafoglio"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    {result.tickers.map((t, idx) => (
                      <Line
                        key={t}
                        type="monotone"
                        dataKey={t}
                        name={t}
                        stroke={PIE_COLORS[(idx + 1) % PIE_COLORS.length]}
                        strokeWidth={1}
                        strokeOpacity={0.45}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Asset detail table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 overflow-x-auto">
              <h3 className="text-base font-semibold text-slate-100 mb-4">
                Dettaglio Asset &amp; Volatilità Individuali
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="pb-3 pr-4 font-medium">Ticker</th>
                    <th className="pb-3 pr-4 font-medium">Nome</th>
                    <th className="pb-3 pr-4 font-medium">Settore</th>
                    <th className="pb-3 pr-4 font-medium">Paese</th>
                    <th className="pb-3 font-medium text-right">σ Ann.</th>
                  </tr>
                </thead>
                <tbody>
                  {result.assets.map((a) => (
                    <tr
                      key={a.ticker}
                      className="border-b border-slate-800/60 text-slate-300"
                    >
                      <td className="py-2.5 pr-4 font-mono text-emerald-400">
                        {a.ticker}
                      </td>
                      <td className="py-2.5 pr-4 max-w-[160px] truncate">
                        {a.name}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400">{a.sector}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{a.country}</td>
                      <td className="py-2.5 text-right font-mono">
                        {((result.volatilities[a.ticker] ?? 0) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Executive Risk Summary */}
            <section
              className={`rounded-2xl border p-4 sm:p-6 ${riskBoxStyle}`}
            >
              <div className="flex items-center gap-2 mb-3">
                {riskIcon}
                <h3 className="text-base font-semibold text-slate-100">
                  Executive Risk Summary &amp; Stress Alert
                </h3>
              </div>
              <p className="text-sm font-medium text-slate-200 mb-2">
                {result.riskSummary.title}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                {result.riskSummary.message}
              </p>
            </section>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <section className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-6 py-16 text-center">
            <BarChart3 className="h-10 w-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Seleziona un preset o inserisci i ticker, scegli l&apos;orizzonte temporale
              e avvia l&apos;analisi per visualizzare correlazioni, HHI, Diversification Ratio
              e stress alert secondo la Modern Portfolio Theory.
            </p>
          </section>
        )}
      </main>

      {/* ───── Footer ───── */}
      <footer className="border-t border-slate-800/80 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-center sm:text-left">
          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            Ideato e sviluppato per analisi quantitativa di portafoglio secondo la{" "}
            <span className="text-slate-400">Modern Portfolio Theory</span>.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────── Subcomponents ─────────────────── */

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-3">
        {icon}
        {label}
      </div>
      <p className="text-2xl sm:text-3xl font-semibold font-mono text-slate-50">
        {value}
      </p>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function ExposureChart({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
      <h3 className="text-base font-semibold text-slate-100 mb-4">{title}</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value}%`, "Peso"]}
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => (
                <span className="text-slate-400">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
