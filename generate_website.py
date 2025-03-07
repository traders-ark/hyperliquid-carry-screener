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

    # Get the latest timestamp from the data (exchange's timestamp)
    latest_time = df['time'].max()

    # Get the current time (when the script finishes executing)
    current_time = datetime.now(timezone.utc)

    # Filter data for the latest time
    df_latest = df[df['time'] == latest_time].copy()

    # Calculate annualized funding rate percentage (hourly_funding*24*365*100)
    annualization_factor = 24 * 365 * 100  # Convert to percentage and annualize
    df_latest['fundingRate_annualized'] = df_latest['fundingRate'] * annualization_factor

    # Calculate average funding rates over different time periods
    time_periods = {
        '1d': {'days': 1, 'required_points': 24},
        '3d': {'days': 3, 'required_points': 72},
        '5d': {'days': 5, 'required_points': 120}
    }

    # Get list of all coins
    all_coins = df_latest['coin'].unique()

    # Prepare average funding rates per coin for each time period
    avg_funding_rates = []

    for coin in all_coins:
        coin_data = {'coin': coin}
        
        # Calculate averages for each time period
        for period, config in time_periods.items():
            start_time = latest_time - timedelta(days=config['days'])
            df_period = df[(df['time'] >= start_time) & (df['coin'] == coin)]
            
            if len(df_period) >= config['required_points']:
                # Calculate annualized average
                avg_rate = df_period['fundingRate'].mean() * annualization_factor
                coin_data[f'fundingRate_avg_{period}'] = avg_rate
            else:
                # Not enough data for this coin in this period
                coin_data[f'fundingRate_avg_{period}'] = None
        
        avg_funding_rates.append(coin_data)

    df_avg = pd.DataFrame(avg_funding_rates)

    # Create separate DataFrames for each time period
    avg_dfs = {}
    for period in time_periods.keys():
        # Create column name for this period
        col_name = f'fundingRate_avg_{period}'
        
        # Filter for coins with data for this period
        df_period = df_avg[df_avg[col_name].notnull()].copy()
        
        # Separate positive and negative average funding rates
        positive_df = df_period[df_period[col_name] > 0].sort_values(by=col_name, ascending=False)
        negative_df = df_period[df_period[col_name] < 0].sort_values(by=col_name, ascending=True)
        
        avg_dfs[f'positive_{period}'] = positive_df[['coin', col_name]]
        avg_dfs[f'negative_{period}'] = negative_df[['coin', col_name]]

    # Separate positive and negative funding rates for current data
    df_positive_current = df_latest[df_latest['fundingRate_annualized'] > 0]
    df_negative_current = df_latest[df_latest['fundingRate_annualized'] < 0]

    # Sort the current funding rate tables
    df_positive_current = df_positive_current.sort_values(by='fundingRate_annualized', ascending=False)
    df_negative_current = df_negative_current.sort_values(by='fundingRate_annualized', ascending=True)

    # Prepare data for JSON output
    data = {
        'timestamp': latest_time.strftime('%Y-%m-%d %H:%M:%S UTC'),
        'generated_at': current_time.strftime('%Y-%m-%d %H:%M:%S UTC'),
        'positive_current': df_positive_current[['coin', 'fundingRate_annualized']].to_dict(orient='records'),
        'negative_current': df_negative_current[['coin', 'fundingRate_annualized']].to_dict(orient='records'),
    }
    
    # Add average data for each time period
    for key, df in avg_dfs.items():
        data[key] = df.to_dict(orient='records')

    # Save the data to a JSON file
    with open('docs/funding_data.json', 'w') as f:
        json.dump(data, f)

    # Copy the funding_data_all_coins.csv to docs (optional)
    df.to_csv('docs/funding_data_all_coins.csv', index=False)

    print("Website data generated successfully.")

if __name__ == '__main__':
    generate_website()
