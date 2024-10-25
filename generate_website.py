import pandas as pd
import json
from datetime import datetime, timezone, timedelta

def generate_website():
    # Load the data
    df = pd.read_csv('funding_data_all_coins.csv')

    # Ensure 'fundingRate' is numeric
    df['fundingRate'] = pd.to_numeric(df['fundingRate'], errors='coerce')

    # Convert 'time' to datetime, ensuring it's timezone-aware
    df['time'] = pd.to_datetime(df['time'], unit='ms', utc=True)

    # Get the latest timestamp
    latest_time = df['time'].max()

    # Filter data for the latest time
    df_latest = df[df['time'] == latest_time].copy()

    # Calculate funding rate percentage
    df_latest['fundingRate_percent'] = df_latest['fundingRate'] * 100

    # Calculate average funding rates over N days
    N_avg = 3  # Number of days for average calculation
    start_time_avg = latest_time - timedelta(days=N_avg)
    df_past_N_days = df[df['time'] >= start_time_avg]

    # Get list of all coins
    all_coins = df_latest['coin'].unique()

    # Prepare average funding rates per coin
    avg_funding_rates = []

    for coin in all_coins:
        df_coin = df_past_N_days[df_past_N_days['coin'] == coin]
        if df_coin.empty or df_coin['time'].min() > start_time_avg:
            # Not enough data for this coin
            avg_rate = None
        else:
            avg_rate = df_coin['fundingRate'].mean() * 100  # Convert to percentage
        avg_funding_rates.append({'coin': coin, 'fundingRate_percent_avg': avg_rate})

    df_avg = pd.DataFrame(avg_funding_rates)

    # Prepare data for JSON output
    data = {
        'timestamp': latest_time.strftime('%Y-%m-%d %H:%M:%S UTC'),
        'avg_funding_rates': df_avg.to_dict(orient='records'),
    }

    # Separate positive and negative funding rates for current data
    df_positive_current = df_latest[df_latest['fundingRate_percent'] > 0]
    df_negative_current = df_latest[df_latest['fundingRate_percent'] < 0]

    # Sort the tables
    df_positive_current = df_positive_current.sort_values(by='fundingRate_percent', ascending=False)
    df_negative_current = df_negative_current.sort_values(by='fundingRate_percent', ascending=True)

    # Prepare data for JSON output
    data.update({
        'positive_current': df_positive_current[['coin', 'fundingRate_percent']].to_dict(orient='records'),
        'negative_current': df_negative_current[['coin', 'fundingRate_percent']].to_dict(orient='records'),
    })

    # Save the data to a JSON file
    with open('docs/funding_data.json', 'w') as f:
        json.dump(data, f)

    # Copy the funding_data_all_coins.csv to docs (optional)
    df.to_csv('docs/funding_data_all_coins.csv', index=False)

    print("Website data generated successfully.")

if __name__ == '__main__':
    generate_website()
