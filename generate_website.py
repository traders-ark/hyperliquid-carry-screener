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

    # Check if there's enough data
    not_enough_data = False
    if df_past_N_days.empty or df_past_N_days['time'].min() > start_time_avg:
        # Not enough data to calculate averages
        not_enough_data = True

    data = {
        'timestamp': latest_time.strftime('%Y-%m-%d %H:%M:%S UTC'),
        'not_enough_data': not_enough_data,
    }

    if not not_enough_data:
        # Group by 'coin' and calculate the average funding rate
        df_avg = df_past_N_days.groupby('coin').agg(
            fundingRate_percent_avg=('fundingRate', lambda x: x.mean() * 100)
        ).reset_index()

        # Separate positive and negative average funding rates
        df_positive_avg = df_avg[df_avg['fundingRate_percent_avg'] > 0]
        df_negative_avg = df_avg[df_avg['fundingRate_percent_avg'] < 0]

        # Sort the tables
        df_positive_avg = df_positive_avg.sort_values(by='fundingRate_percent_avg', ascending=False)
        df_negative_avg = df_negative_avg.sort_values(by='fundingRate_percent_avg', ascending=True)

        # Prepare data for JSON output
        data.update({
            'positive_avg': df_positive_avg[['coin', 'fundingRate_percent_avg']].to_dict(orient='records'),
            'negative_avg': df_negative_avg[['coin', 'fundingRate_percent_avg']].to_dict(orient='records'),
        })
    else:
        data.update({
            'positive_avg': [],
            'negative_avg': [],
        })

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
