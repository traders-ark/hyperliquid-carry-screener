# hyperliquid-carry-screener
Funding rates are payments between traders to keep perpetual contract prices aligned with the spot price. Positive rates mean longs pay shorts, negative rates mean shorts pay longs.

Although there's already a vast number of apps which help you monitor and analyse historical funding data, they typically don't offer funding rate average calculations over past N days (without skewing the data for newly released coins)

That's what this screener is meant for. It is used to monitor / manually run cross-sectional carry strategies on Hyperliquid exchange (might add more in the future). Unlike regular carry where you have one spot leg and one futures leg in a trade, xs-carry drops the spot leg comletely by being long/short the extremes for top N negative/positive funding rates. 
