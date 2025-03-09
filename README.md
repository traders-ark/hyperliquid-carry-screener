# hyperliquid-carry-screener
Funding rates are payments between traders to keep perpetual futures prices aligned with the spot prices. Positive rates mean longs pay shorts, negative rates mean shorts pay longs.

Although plenty of historical funding rate monitoring tools already exist, none typically offer t-N funding rate averages, especially with a clear dashboard and without skewing the averages for newly released tickers.

That's what this screener is for —— monitor / manually run carry strategies on Hyperliquid exchange (might add more in the future). 

It's particularly useful for cross-sectional carry. Unlike regular carry with one spot leg & one futures leg, xs-carry eliminates the spot leg comletely by being long/short the extremes for top N negative/positive funding rates.
