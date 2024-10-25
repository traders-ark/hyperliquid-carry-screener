import requests
import pandas as pd
import time
from datetime import datetime

def get_all_coins():
    response = requests.post('https://api.hyperliquid.xyz/info', json={'type':'meta'}, headers={'Content-Type': 'application/json'})
    response.raise_for_status()
    data = response.json()
    coins = [item['name'] for item in data.get('universe', [])]
    return coins

def get_latest_funding(coin):
    # Use a startTime that is recent to get the latest funding rate
    current_time_ms = int(datetime.utcnow().timestamp() * 1000)
    # Set startTime to current time minus a small delta (e.g., 10 minutes)
    startTime = current_time_ms - 10 * 60 * 1000
    response = requests.post(
        'https://api.hyperliquid.xyz/info',
        json={'type':'fundingHistory', 'coin':coin, 'startTime':startTime},
        headers={'Content-Type': 'application/json'}
    )
    response.raise_for_status()
    data = response.json()
    if data:
        # Get the most recent funding rate
        latest_entry = data[-1]
        return latest_entry
    else:
        return None

def main():
    # Initialize an empty DataFrame or read existing data
    filename = 'funding_data_all_coins.csv'
    try:
        existing_df = pd.read_csv(filename)
    except FileNotFoundError:
        existing_df = pd.DataFrame()

    while True:
        print(f"Fetching data at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        coins = get_all_coins()
        print(f"Found {len(coins)} coins.")
        funding_data = []

        for coin in coins:
            try:
                latest_funding = get_latest_funding(coin)
                if latest_funding:
                    funding_data.append(latest_funding)
                    print(f"Collected funding data for {coin}")
                else:
                    print(f"No recent funding data for {coin}")
            except Exception as e:
                print(f"Error fetching funding data for {coin}: {e}")

        if funding_data:
            df_new = pd.DataFrame(funding_data)
            # Combine with existing data
            combined_df = pd.concat([existing_df, df_new], ignore_index=True)
            # Remove duplicates
            combined_df.drop_duplicates(subset=['coin', 'time'], inplace=True)
            # Save to CSV
            combined_df.to_csv(filename, index=False)
            print(f"Saved funding data to {filename}")
            # Update existing_df for the next iteration
            existing_df = combined_df
        else:
            print("No funding data collected this cycle.")

        # Sleep for one hour
        print("Sleeping for one hour...")
        time.sleep(3600)

if __name__ == '__main__':
    main()
