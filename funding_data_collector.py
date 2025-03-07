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

def get_funding_for_time_range(coin, start_time_ms, end_time_ms):
    """
    Fetch funding data for a specific coin within a time range.
    
    Args:
        coin: The coin symbol
        start_time_ms: Start time in milliseconds (inclusive)
        end_time_ms: End time in milliseconds (exclusive)
        
    Returns:
        List of funding data entries within the specified time range
    """
    max_retries = 5
    retry_delay = 2  # Start with a 2-second delay

    for attempt in range(max_retries):
        try:
            response = requests.post(
                'https://api.hyperliquid.xyz/info',
                json={'type': 'fundingHistory', 'coin': coin, 'startTime': start_time_ms},
                headers={'Content-Type': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            # Filter to include only records within the specific time range
            data_in_range = [entry for entry in data if start_time_ms <= entry['time'] < end_time_ms]
            return data_in_range
        except HTTPError as http_err:
            if response.status_code == 429:
                print(f"Rate limit exceeded for {coin}. Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue
            else:
                print(f"HTTP error occurred for {coin}: {http_err}")
                return []
        except Exception as e:
            print(f"Error fetching funding data for {coin}: {e}")
            return []
    print(f"Failed to fetch funding data for {coin} after {max_retries} retries due to rate limiting.")
    return []

def get_latest_funding(coin):
    """
    Get the latest funding data for a coin.
    This is kept for backward compatibility.
    """
    current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    # Get data from the last 2 hours to ensure we capture the latest entry
    start_time_ms = current_time_ms - 2 * 60 * 60 * 1000  
    
    funding_data = get_funding_for_time_range(coin, start_time_ms, current_time_ms)
    if funding_data:
        return funding_data[-1]  # Return the latest entry
    return None

def check_missing_data_past_24h(existing_df, coins):
    """
    Check for missing data points in the past 24 hours and fetch them if needed.
    
    Args:
        existing_df: DataFrame containing existing funding data
        coins: List of coin symbols
        
    Returns:
        DataFrame with any missing data added, and a boolean indicating if latest hour data was collected
    """
    # Get current time and 24 hours ago
    now = datetime.now(timezone.utc)
    latest_completed_hour = now.replace(minute=0, second=0, microsecond=0)
    next_hour = latest_completed_hour + timedelta(hours=1)  # Important to include the latest hour in the range
    hours_24_ago = latest_completed_hour - timedelta(hours=24)
    
    # Convert to milliseconds for API and filtering
    next_hour_ms = int(next_hour.timestamp() * 1000)
    hours_24_ago_ms = int(hours_24_ago.timestamp() * 1000)
    
    # Generate expected hourly timestamps for the past 24 hours
    expected_hours = []
    for i in range(24, 0, -1):  # From 24 hours ago to 1 hour ago
        hour_timestamp = latest_completed_hour - timedelta(hours=i)
        expected_hours.append(hour_timestamp)
    # Add latest completed hour
    expected_hours.append(latest_completed_hour)
    
    # Flag to track if we need to collect latest hour data separately
    latest_hour_collected = False
    
    if existing_df.empty:
        print("No existing data found. Will fetch data for all coins for the past 24 hours.")
        # If no data exists, we'll fetch everything from the past 24 hours
        start_time_ms = hours_24_ago_ms
        end_time_ms = next_hour_ms
        missing_hours = expected_hours
        latest_hour_collected = True  # We'll collect latest hour data in this pass
    else:
        # Optimize CSV parsing by only looking at recent data
        # First, convert the 'time' column to numeric if it's not already
        if 'time' not in existing_df.columns:
            print("Warning: 'time' column not found in CSV. Using empty DataFrame.")
            existing_df = pd.DataFrame()
            start_time_ms = hours_24_ago_ms
            end_time_ms = next_hour_ms
            missing_hours = expected_hours
            latest_hour_collected = True  # We'll collect latest hour data in this pass
            return check_missing_data_past_24h(existing_df, coins)
        
        # Filter to only include data from the past 48 hours (to be safe)
        cutoff_time_ms = hours_24_ago_ms - 24 * 60 * 60 * 1000  # 48 hours ago
        recent_df = existing_df[existing_df['time'] >= cutoff_time_ms].copy()
        
        if recent_df.empty:
            print("No recent data found in the past 48 hours. Will fetch data for all coins for the past 24 hours.")
            start_time_ms = hours_24_ago_ms
            end_time_ms = next_hour_ms
            missing_hours = expected_hours
            latest_hour_collected = True  # We'll collect latest hour data in this pass
        else:
            # Convert time column to datetime
            recent_df['time_dt'] = pd.to_datetime(recent_df['time'], unit='ms', utc=True)
            
            # Round timestamps to the nearest hour to match expected hourly data points
            recent_df['hour'] = recent_df['time_dt'].dt.floor('H')
            
            # Get unique hours in the existing data for the past 24 hours
            existing_hours_df = recent_df[
                (recent_df['hour'] >= hours_24_ago) & 
                (recent_df['hour'] <= latest_completed_hour)
            ]
            
            # Get unique hours with data for each coin
            coin_hour_pairs = set(zip(existing_hours_df['coin'], existing_hours_df['hour']))
            
            # Find missing hours for each coin
            missing_coin_hours = []
            for coin in coins:
                for hour in expected_hours:
                    if (coin, hour) not in coin_hour_pairs:
                        missing_coin_hours.append((coin, hour))
            
            # Get unique missing hours
            missing_hours = sorted(set(hour for _, hour in missing_coin_hours))
            
            # Check if only the latest hour is missing
            if missing_hours == [latest_completed_hour]:
                print("Only latest hour data is missing, which will be collected in the next step.")
                return existing_df, False
            elif not missing_hours:
                print("No data missing in past 24h.")
                return None, None  # Signal to main() that we should exit
            
            # Find coins with missing data
            missing_coins = set(coin for coin, _ in missing_coin_hours)
            
            # Print missing hours
            missing_hours_str = ", ".join([hour.strftime('%Y-%m-%d %H:%M:%S UTC') for hour in missing_hours])
            print(f"Found missing data for hours: {missing_hours_str}")
            print(f"Missing data for {len(missing_coins)} coins.")
            
            # Check if latest hour is among the missing hours
            if latest_completed_hour in missing_hours:
                latest_hour_collected = True
                print("Latest hour data will be collected along with other missing data.")
            
            # Set time range to cover all missing hours plus latest hour if needed
            if missing_hours:
                start_time_ms = int(min(missing_hours).timestamp() * 1000)
                # If latest hour is not in missing hours, don't extend to next hour
                if latest_hour_collected:
                    end_time_ms = next_hour_ms  # Include the latest hour by extending to the next hour
                else:
                    # Find the latest missing hour that's not the latest completed hour
                    latest_missing = max(missing_hours)
                    if latest_missing < latest_completed_hour:
                        end_time_ms = int((latest_missing + timedelta(hours=1)).timestamp() * 1000)
                    else:
                        # This shouldn't happen given our checks, but just in case
                        end_time_ms = next_hour_ms
                        latest_hour_collected = True
    
    # Fetch all missing data in one go for each coin
    all_missing_data = []
    
    # Introduce delay to stay within rate limits
    max_requests_per_minute = 60
    delay_between_requests = 60 / max_requests_per_minute  # in seconds
    
    print(f"Fetching data from {datetime.fromtimestamp(start_time_ms/1000, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC to {datetime.fromtimestamp(end_time_ms/1000, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    
    for coin in coins:
        # Fetch data for the entire time range
        coin_data = get_funding_for_time_range(coin, start_time_ms, end_time_ms)
        if coin_data:
            all_missing_data.extend(coin_data)
            print(f"Collected data for {coin} ({len(coin_data)} entries)")
        else:
            print(f"No data available for {coin} in the specified time range")
        
        time.sleep(delay_between_requests)  # Pause to respect rate limits
    
    if all_missing_data:
        # Add the missing data to the existing DataFrame
        missing_df = pd.DataFrame(all_missing_data)
        combined_df = pd.concat([existing_df, missing_df], ignore_index=True)
        # Remove duplicates
        combined_df.drop_duplicates(subset=['coin', 'time'], inplace=True)
        print(f"Added {len(all_missing_data)} entries to fill missing data.")
        return combined_df, latest_hour_collected
    
    return existing_df, latest_hour_collected

def main():
    # Initialize an empty DataFrame or read existing data
    filename = 'funding_data_main.csv'
    try:
        existing_df = pd.read_csv(filename)
        print(f"Loaded existing data with {len(existing_df)} rows.")
    except FileNotFoundError:
        existing_df = pd.DataFrame()
        print("No existing data file found. Starting fresh.")

    print(f"Fetching data at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    coins = get_all_coins()
    print(f"Found {len(coins)} coins.")
    
    # Check for missing data from the past 24 hours
    result_df, latest_hour_collected = check_missing_data_past_24h(existing_df, coins)
    
    # Exit if no data is missing (None, None is returned)
    if result_df is None and latest_hour_collected is None:
        print("Exiting as no data collection is needed.")
        return
    
    # Only fetch latest hour's data if it wasn't already collected
    if not latest_hour_collected:
        print("Collecting latest hour's data...")
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
            combined_df = pd.concat([result_df, df_new], ignore_index=True)
            # Remove duplicates
            combined_df.drop_duplicates(subset=['coin', 'time'], inplace=True)
            result_df = combined_df
            print(f"Added {len(funding_data)} entries for latest hour.")

    # Keep only data from the past N days
    N = 90  # Number of days to keep
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=N)
    cutoff_time_ms = int(cutoff_time.timestamp() * 1000)
    result_df = result_df[result_df['time'] >= cutoff_time_ms]

    # Save to CSV
    result_df.to_csv(filename, index=False)
    print(f"Saved funding data to {filename} with {len(result_df)} rows.")

if __name__ == '__main__':
    main()
