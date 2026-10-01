# Portfolio Risk & Diversification Engine

Motore quantitativo di analisi del rischio di portafoglio basato sulla **Modern Portfolio Theory** (Markowitz), correlazione di Pearson, Diversification Ratio e indice di concentrazione Herfindahl-Hirschman (HHI).

Progettato come progetto portfolio per curriculum in Finanza / Economia — deploy-ready su **Vercel** (Next.js 14 App Router).

## Metriche implementate

| Metrica | Formula | Descrizione |
|---------|---------|-------------|
| Rendimenti logaritmici | `r_t = ln(P_t / P_{t-1})` | Serie giornaliere |
| Correlazione di Pearson | Matrice `ρ_ij` | Dipendenza lineare inter-asset |
| Covarianza annualizzata | `Σ = σ_i σ_j ρ_ij` (fattore 252) | Input MPT |
| Volatilita di portafoglio | `σ_p = √(w' Σ w)` | Pesi equi `1/N` |
| Diversification Ratio | `DR = Σ(w_i σ_i) / σ_p` | Beneficio da covarianza |
| HHI Settoriale / Geografico | `HHI = Σ(w_k²)` | Concentrazione |

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** — UI dark FinTech
- **Recharts** — heatmap, donut, line chart
- **Lucide React** — icone
- **yahoo-finance2** v4 — storico prezzi (chart) e metadati (settore/paese)

## Avvio locale

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Deploy su Vercel

1. Push del repository su GitHub
2. Import su [vercel.com](https://vercel.com) → Framework Preset: Next.js
3. Deploy automatico ad ogni push su `main`

## Preset di esempio

- **Global Diversified** — AAPL, ASML, ENI.MI, RELIANCE.NS, BABA
- **US Tech Concentrated** — AAPL, MSFT, NVDA, GOOGL, META
- **Defensive Mix** — JNJ, PG, KO, XOM

## Licenza

Progetto educativo / portfolio personale.
