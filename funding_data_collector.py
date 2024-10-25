import requests
import pandas as pd
import time
from datetime import datetime, timezone, timedelta
from requests.exceptions import HTTPError

def get_all_coins():
    response = requests.post('https://api.hyperliquid.xyz/info', json={'type':'meta'}, headers={'Content-Type': 'application/json'})
    response.raise_for_status()
    data = response.json()
    coins = [item['name'] for item in data.get('universe', [])]
    return coins

def get_latest_funding(coin):
    current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    startTime = current_time_ms - 2 * 60 * 60 * 1000  # 2 hours ago in milliseconds
    max_retries = 5
    retry_delay = 2  # Start with a 2-second delay

    for attempt in range(max_retries):
        try:
            response = requests.post(
                'https://api.hyperliquid.xyz/info',
                json={'type':'fundingHistory', 'coin':coin, 'startTime':startTime},
                headers={'Content-Type': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            if data:
                latest_entry = data[-1]
                return latest_entry
            else:
                return None
        except HTTPError as http_err:
            if response.status_code == 429:
                print(f"Rate limit exceeded for {coin}. Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue
            else:
                print(f"HTTP error occurred for {coin}: {http_err}")
                return None
        except Exception as e:
            print(f"Error fetching funding data for {coin}: {e}")
            return None
    print(f"Failed to fetch funding data for {coin} after {max_retries} retries due to rate limiting.")
    return None

def main():
    # Initialize an empty DataFrame or read existing data
    filename = 'funding_data_all_coins.csv'
    try:
        existing_df = pd.read_csv(filename)
    except FileNotFoundError:
        existing_df = pd.DataFrame()

    print(f"Fetching data at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    coins = get_all_coins()
    print(f"Found {len(coins)} coins.")
    funding_data = []

    # Introduce delay to stay within rate limits
    max_requests_per_minute = 60
    delay_between_requests = 60 / max_requests_per_minute  # in seconds

    for coin in coins:
        latest_funding = get_latest_funding(coin)
        if latest_funding:
            funding_data.append(latest_funding)
            print(f"Collected funding data for {coin}")
        else:
            print(f"Could not collect funding data for {coin}")
        time.sleep(delay_between_requests)  # Pause to respect rate limits

    if funding_data:
        df_new = pd.DataFrame(funding_data)
        # Combine with existing data
        combined_df = pd.concat([existing_df, df_new], ignore_index=True)
        # Remove duplicates
        combined_df.drop_duplicates(subset=['coin', 'time'], inplace=True)

        # Keep only data from the past N days
        N = 90  # Number of days to keep
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=N)
        cutoff_time_ms = int(cutoff_time.timestamp() * 1000)
        combined_df = combined_df[combined_df['time'] >= cutoff_time_ms]

        # Save to CSV
        combined_df.to_csv(filename, index=False)
        print(f"Saved funding data to {filename}")
    else:
        print("No funding data collected.")

if __name__ == '__main__':
    main()
