// Global variable to track display mode
let displayMode = 'apr'; // Default to APR view

// Global variable to remember chart type selection
let selectedChartType = 'line'; // Default to line chart

// Global variable to remember chart range selection
let selectedChartRange = '1d'; // Default to 1 day

// Global variables for chart data and options
let chartData = null;
let chartOptions = null;

// Global variable to track mouse position for hover effects
let mouseX = 0;
let mouseY = 0;

// Format funding rate for display
function formatRate(rate, mode = displayMode) {
    if (rate === null || rate === undefined) {
        return '<span class="no-data">Not enough data</span>';
    }
    
    let formattedRate;
    if (mode === 'apr') {
        // APR mode - annualized
        formattedRate = rate.toFixed(2) + '%';
    } else {
        // Hourly mode - convert from annualized back to hourly
        const hourlyRate = rate / (24 * 365);
        formattedRate = hourlyRate.toFixed(6) + '%';
    }
    
    // Add appropriate class based on value
    if (rate < 0) {
        return '<span class="negative-rate">' + formattedRate + '</span>';
    } else if (rate > 0) {
        return '<span class="positive-rate">' + formattedRate + '</span>';
    } else {
        return formattedRate;
    }
}

// Format coin name with hyperlink to Hyperliquid trading page
function formatCoinName(coin, isNew = false) {
    const url = `https://app.hyperliquid.xyz/trade/${coin}`;
    const newCoinClass = isNew ? 'new-coin' : '';
    return `<div class="coin-container">
              <button class="coin-info-button" data-coin="${coin}" title="Coin Info"></button>
              <a href="${url}" target="_blank" class="coin-link ${newCoinClass}"><strong>${coin}</strong></a>
            </div>`;
}

// Combine all data into a single dataset with one row per coin
function combineData(data) {
    // Get all unique coins from all datasets
    const allCoins = new Set();
    
    // Add coins from current data
    if (data.positive_current) {
        data.positive_current.forEach(item => allCoins.add(item.coin));
    }
    if (data.negative_current) {
        data.negative_current.forEach(item => allCoins.add(item.coin));
    }
    
    // Add coins from average data
    ['1d', '3d', '5d'].forEach(period => {
        if (data[`positive_${period}`]) {
            data[`positive_${period}`].forEach(item => allCoins.add(item.coin));
        }
        if (data[`negative_${period}`]) {
            data[`negative_${period}`].forEach(item => allCoins.add(item.coin));
        }
    });
    
    // Create a map for quick lookups
    const currentRates = {};
    
    // Combine positive and negative current rates
    if (data.positive_current) {
        data.positive_current.forEach(item => {
            currentRates[item.coin] = item.fundingRate_annualized;
        });
    }
    if (data.negative_current) {
        data.negative_current.forEach(item => {
            currentRates[item.coin] = item.fundingRate_annualized;
        });
    }
    
    // Create maps for average rates
    const avgRates = {
        '1d': {},
        '3d': {},
        '5d': {}
    };
    
    // Populate average rate maps
    ['1d', '3d', '5d'].forEach(period => {
        if (data[`positive_${period}`]) {
            data[`positive_${period}`].forEach(item => {
                avgRates[period][item.coin] = item[`fundingRate_avg_${period}`];
            });
        }
        if (data[`negative_${period}`]) {
            data[`negative_${period}`].forEach(item => {
                avgRates[period][item.coin] = item[`fundingRate_avg_${period}`];
            });
        }
    });
    
    // Create the combined dataset
    const combinedData = [];
    
    // Create data rows
    allCoins.forEach(coin => {
        // Determine if this is a new coin (less than 5 days old)
        // A coin is considered new if it doesn't have 5-day average data
        const isNewCoin = avgRates['5d'][coin] === undefined || avgRates['5d'][coin] === null;
        
        combinedData.push({
            coin: coin,
            isNew: isNewCoin,
            latestRate: currentRates[coin] || null,
            avg1d: avgRates['1d'][coin] || null,
            avg3d: avgRates['3d'][coin] || null,
            avg5d: avgRates['5d'][coin] || null
        });
    });
    
    return combinedData;
}

// Initialize and populate the main table
function initializeTable(data) {
    const combinedData = combineData(data);
    let table;
    
    // Initialize DataTable
    table = $('#fundingTable').DataTable({
        data: combinedData,
        columns: [
            { 
                data: 'coin',
                title: 'Coin',
                render: function(data, type, row) {
                    return formatCoinName(data, row.isNew);
                }
            },
            { 
                data: 'latestRate', 
                title: 'Latest Funding',
                render: function(data) {
                    return formatRate(data, displayMode);
                }
            },
            { 
                data: 'avg1d', 
                title: '1-Day Carry',
                render: function(data) {
                    return formatRate(data, displayMode);
                }
            },
            { 
                data: 'avg3d', 
                title: '3-Day Carry',
                render: function(data) {
                    return formatRate(data, displayMode);
                }
            },
            { 
                data: 'avg5d', 
                title: '5-Day Carry',
                render: function(data) {
                    return formatRate(data, displayMode);
                }
            }
        ],
        order: [[1, 'desc']], // Sort by latest funding rate by default
        responsive: true,
        paging: false,
        scrolling: false,
        info: true,
        searching: true, // Enable searching
        language: {
            info: "Showing _TOTAL_ coins",
            infoEmpty: "No coins found",
            infoFiltered: "(filtered from _MAX_ total coins)"
        }
    });
    
    // Connect custom search box to DataTable search
    $('#coinSearch').on('keyup', function() {
        table.search(this.value).draw();
    });
    
    // Handle display mode change
    $('#displayMode').on('change', function() {
        displayMode = $(this).val();
        updateTableTitle();
        
        // Force redraw of the table with the new display mode
        table.rows().invalidate('data').draw();
        
        // Update chart if it exists
        if (window.fundingChart) {
            window.fundingChart.update();
        }
    });
    
    // Add event listener for coin info buttons
    $('#fundingTable').on('click', '.coin-info-button', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const coin = $(this).data('coin');
        showCoinInfoPopup(coin);
    });
    
    // Initial table title update
    updateTableTitle();
    
    return table;
}

// Update the table title based on display mode
function updateTableTitle() {
    const titleSuffix = displayMode === 'apr' ? '(Annualized %)' : '(Hourly %)';
    $('h2').text(`Funding Rates Overview ${titleSuffix}`);
}

// Modal functionality
function setupModal() {
    const modal = document.getElementById('helpModal');
    const btn = document.getElementById('helpBtn');
    const span = document.getElementsByClassName('close')[0];
    
    // Open modal when help button is clicked
    btn.onclick = function() {
        modal.style.display = 'block';
    }
    
    // Close modal when X is clicked
    span.onclick = function() {
        modal.style.display = 'none';
    }
    
    // Close modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
    
    // Close modal when ESC key is pressed
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

// Function to show coin info popup with funding history chart
function showCoinInfoPopup(coin) {
    // Create popup element if it doesn't exist
    if (!$('#coinInfoPopup').length) {
        $('body').append(`
            <div id="coinInfoPopup" class="coin-info-popup">
                <div class="coin-info-popup-content">
                    <span class="coin-info-popup-close">&times;</span>
                    <div class="popup-header">
                        <div class="chart-type-container">
                            <select id="chartTypeSelect" class="chart-type-select">
                                <option value="line">Line Chart</option>
                                <option value="bar">Column Chart</option>
                            </select>
                        </div>
                        <h3 id="coinInfoPopupTitle"></h3>
                        <div class="chart-range-container">
                            <select id="chartRangeSelect" class="chart-type-select">
                                <option value="1d" selected>1d</option>
                                <option value="1w">1w</option>
                                <option value="2w">2w</option>
                                <option value="1m">1m</option>
                                <option value="2m">2m</option>
                                <option value="3m">3m</option>
                            </select>
                        </div>
                    </div>
                    <div id="coinInfoPopupContent">
                        <div class="chart-container">
                            <canvas id="fundingHistoryChart"></canvas>
                        </div>
                        <div id="chartLoading" class="chart-loading">Loading funding data...</div>
                    </div>
                </div>
            </div>
        `);
        
        // Add close button functionality
        $(document).on('click', '.coin-info-popup-close', function() {
            $('#coinInfoPopup').hide();
            // Remove active class from all buttons when popup is closed
            $('.coin-info-button').removeClass('active');
        });
        
        // Close popup when clicking outside
        $(document).on('click', function(e) {
            if ($(e.target).closest('.coin-info-popup-content').length === 0 && 
                !$(e.target).hasClass('coin-info-button')) {
                $('#coinInfoPopup').hide();
                // Remove active class from all buttons when popup is closed
                $('.coin-info-button').removeClass('active');
            }
        });
    }
    
    // Set the chart type select to match the global selection
    $('#chartTypeSelect').val(selectedChartType);
    
    // Set the chart range select to match the global selection
    $('#chartRangeSelect').val(selectedChartRange);
    
    // Set popup title
    $('#coinInfoPopupTitle').text(`${coin} Funding History`);
    
    // Show loading indicator
    $('#chartLoading').show();
    
    // Remove active class from all buttons first
    $('.coin-info-button').removeClass('active');
    
    // Add active class to the clicked button
    $(`.coin-info-button[data-coin="${coin}"]`).addClass('active');
    
    // Show popup
    $('#coinInfoPopup').show();
    
    // Load chart data with the selected range
    loadChartData(coin, selectedChartRange);
    
    // Add event listener for chart type selection
    $('#chartTypeSelect').off('change').on('change', function() {
        currentChartType = $(this).val();
        selectedChartType = currentChartType; // Update the global variable
        createChart(currentChartType);
    });
    
    // Add event listener for chart range selection
    $('#chartRangeSelect').off('change').on('change', function() {
        const rangeValue = $(this).val();
        console.log(`Range selected: ${rangeValue}`);
        selectedChartRange = rangeValue; // Update the global variable
        
        // Reload the chart data with the new range
        loadChartData(coin, selectedChartRange);
    });
}

// Function to load chart data based on the selected range
function loadChartData(coin, range) {
    // Show loading indicator
    $('#chartLoading').show();
    
    // Update popup title with the range
    $('#coinInfoPopupTitle').text(`${coin} Funding History (${range.toUpperCase()})`);
    
    // Calculate the time range based on the selected range
    const now = Date.now();
    let startTime;
    
    switch (range) {
        case '1d':
            startTime = now - (24 * 60 * 60 * 1000); // 1 day in milliseconds
            break;
        case '1w':
            startTime = now - (7 * 24 * 60 * 60 * 1000); // 1 week in milliseconds
            break;
        case '2w':
            startTime = now - (14 * 24 * 60 * 60 * 1000); // 2 weeks in milliseconds
            break;
        case '1m':
            startTime = now - (30 * 24 * 60 * 60 * 1000); // 1 month (approx) in milliseconds
            break;
        case '2m':
            startTime = now - (60 * 24 * 60 * 60 * 1000); // 2 months (approx) in milliseconds
            break;
        case '3m':
            startTime = now - (90 * 24 * 60 * 60 * 1000); // 3 months (approx) in milliseconds
            break;
        default:
            startTime = now - (24 * 60 * 60 * 1000); // Default to 1 day
    }
    
    // Fetch the JSON data for current rates and averages
    $.getJSON('funding_data.json', function(jsonData) {
        console.log("JSON data loaded successfully");
        
        // Get current funding rate
        let currentRate = null;
        if (jsonData.positive_current) {
            const entry = jsonData.positive_current.find(item => item.coin === coin);
            if (entry) currentRate = entry.fundingRate_annualized;
        }
        if (currentRate === null && jsonData.negative_current) {
            const entry = jsonData.negative_current.find(item => item.coin === coin);
            if (entry) currentRate = entry.fundingRate_annualized;
        }
        
        // Get historical averages
        const oneDay = jsonData.positive_1d?.find(item => item.coin === coin)?.fundingRate_avg_1d || 
                      jsonData.negative_1d?.find(item => item.coin === coin)?.fundingRate_avg_1d;
        
        const threeDay = jsonData.positive_3d?.find(item => item.coin === coin)?.fundingRate_avg_3d || 
                        jsonData.negative_3d?.find(item => item.coin === coin)?.fundingRate_avg_3d;
        
        const fiveDay = jsonData.positive_5d?.find(item => item.coin === coin)?.fundingRate_avg_5d || 
                       jsonData.negative_5d?.find(item => item.coin === coin)?.fundingRate_avg_5d;
        
        console.log(`${coin} rates - Current: ${currentRate}, 1d: ${oneDay}, 3d: ${threeDay}, 5d: ${fiveDay}`);
        
        // Now fetch the CSV file to get hourly data
        $.ajax({
            url: '../funding_data_all_coins.csv', // Try to access the file in the root directory
            dataType: 'text',
            success: function(csvData) {
                console.log("CSV data loaded successfully");
                
                // Parse CSV data
                const rows = csvData.split('\n');
                console.log(`CSV has ${rows.length} rows`);
                
                // Try to detect CSV format
                const firstRow = rows[0].split(',');
                console.log(`CSV columns: ${firstRow.join(', ')}`);
                
                // Find column indices
                const coinIndex = firstRow.indexOf('coin');
                const rateIndex = firstRow.indexOf('fundingRate');
                const timeIndex = firstRow.indexOf('time');
                
                if (coinIndex >= 0 && rateIndex >= 0 && timeIndex >= 0) {
                    // Filter data for the selected coin and time range
                    const coinData = [];
                    const timeLabels = [];
                    const timestamps = [];
                    
                    // Process each row
                    for (let i = 1; i < rows.length; i++) {
                        if (!rows[i].trim()) continue; // Skip empty rows
                        
                        const columns = rows[i].split(',');
                        if (columns.length <= Math.max(coinIndex, rateIndex, timeIndex)) continue;
                        
                        const rowCoin = columns[coinIndex];
                        const fundingRate = parseFloat(columns[rateIndex]);
                        const timestamp = parseInt(columns[timeIndex]);
                        
                        if (rowCoin === coin && timestamp >= startTime && !isNaN(fundingRate) && !isNaN(timestamp)) {
                            // Convert funding rate to percentage and annualize it
                            // Hourly funding rate * 24 * 365 = APR
                            const fundingRateAPR = fundingRate * 24 * 365 * 100;
                            
                            // Format time as hour
                            // Shift time back by 1 hour to show the start of the collection period
                            const date = new Date(timestamp);
                            date.setHours(date.getHours() - 1);
                            const timeLabel = date.toLocaleString([], {
                                hour: '2-digit',
                                hour12: true,
                                day: '2-digit',
                                month: '2-digit'
                            });
                            
                            coinData.push(fundingRateAPR);
                            timeLabels.push(timeLabel);
                            timestamps.push(timestamp);
                        }
                    }
                    
                    // Hide loading indicator
                    $('#chartLoading').hide();
                    
                    if (coinData.length === 0) {
                        // No data found for this coin in the selected range
                        $('#coinInfoPopupContent').html(`<p class="error-message">No funding data available for ${coin} in the selected range (${range}).</p>`);
                        return;
                    }
                    
                    console.log(`Found ${coinData.length} data points for ${coin} in range ${range}`);
                    
                    // Sort data by timestamp (oldest first)
                    const sortedData = [];
                    const sortedLabels = [];
                    const sortedTimestamps = [];
                    
                    // Create pairs of [timestamp, timeLabel, rate] for sorting
                    const pairs = timestamps.map((ts, index) => [ts, timeLabels[index], coinData[index]]);
                    
                    // Sort by timestamp
                    pairs.sort((a, b) => a[0] - b[0]);
                    
                    // Extract sorted data
                    pairs.forEach(pair => {
                        sortedTimestamps.push(pair[0]);
                        sortedLabels.push(pair[1]);
                        sortedData.push(pair[2]);
                    });
                    
                    // Start from the selected range start time, rounded to the nearest hour
                    const rangeStartTime = new Date(startTime);
                    rangeStartTime.setMinutes(0, 0, 0);
                    
                    // Get current time for comparison
                    const currentTime = new Date();
                    currentTime.setMinutes(0, 0, 0);
                    
                    // Find the latest timestamp in the data
                    let latestDataTime;
                    if (sortedTimestamps.length > 0) {
                        const latestTimestamp = Math.max(...sortedTimestamps);
                        console.log(`Latest timestamp in data: ${new Date(latestTimestamp).toLocaleString()}`);
                        
                        // Get the latest data point hour
                        latestDataTime = new Date(latestTimestamp);
                        latestDataTime.setMinutes(0, 0, 0);
                    } else {
                        // If no data, use range start time as fallback
                        latestDataTime = new Date(rangeStartTime);
                        console.log(`No data found, using range start time as latest data time: ${latestDataTime.toLocaleString()}`);
                    }
                    
                    // Always use current time as end time to show missing data between latest data point and now
                    const endTime = new Date(currentTime);
                    console.log(`Chart end time: ${endTime.toLocaleString()}`);
                    console.log(`Latest data time: ${latestDataTime.toLocaleString()}`);
                    
                    // Generate the complete time range including missing hours
                    const completeTimeLabels = [];
                    const completeData = [];
                    
                    // Create an array of all hours in the range
                    let hourCount = 0;
                    for (let time = new Date(rangeStartTime); time <= endTime; time.setHours(time.getHours() + 1)) {
                        hourCount++;
                        // Create a display time that's shifted back by 1 hour to show the start of the collection period
                        const displayTime = new Date(time);
                        displayTime.setHours(displayTime.getHours() - 1);
                        
                        const timeLabel = displayTime.toLocaleString([], {
                            hour: '2-digit',
                            hour12: true,
                            day: '2-digit',
                            month: '2-digit'
                        });
                        completeTimeLabels.push(timeLabel);
                        
                        // Find if we have data for this hour
                        const matchingDataIndex = sortedTimestamps.findIndex(ts => {
                            const dataTime = new Date(ts);
                            return dataTime.getHours() === time.getHours() && 
                                   dataTime.getDate() === time.getDate() && 
                                   dataTime.getMonth() === time.getMonth() &&
                                   dataTime.getFullYear() === time.getFullYear();
                        });
                        
                        // If we have data for this hour, use it; otherwise, use null to create a gap
                        if (matchingDataIndex !== -1) {
                            completeData.push(sortedData[matchingDataIndex]);
                        } else {
                            // Only mark as null if we're within the range where we expect data
                            // This helps avoid false "missing data" indicators
                            if (coinData.length > 0) {
                                // For hours between the latest data point and current time, mark as null to show missing data
                                if (time > latestDataTime && time <= endTime) {
                                    completeData.push(null); // Missing data after latest data point
                                    console.log(`Marking missing data for time after latest data: ${time.toLocaleString()}`);
                                }
                                // For recent data (last 24 hours from the latest data point), mark missing data as null
                                else {
                                    const recentTimeThreshold = new Date(latestDataTime);
                                    recentTimeThreshold.setHours(recentTimeThreshold.getHours() - 24);
                                    
                                    if (time >= recentTimeThreshold && time <= latestDataTime) {
                                        completeData.push(null); // Recent missing data point
                                    } else if (time >= new Date(Math.min(...sortedTimestamps)) && 
                                        time <= latestDataTime) {
                                        completeData.push(null); // Truly missing data point within historical range
                                    } else {
                                        completeData.push(undefined); // Outside data range, don't show indicator
                                    }
                                }
                            } else {
                                completeData.push(undefined); // No data at all for this coin
                            }
                        }
                    }
                    
                    console.log(`Complete time range has ${completeTimeLabels.length} hours, with ${completeData.filter(d => d !== null && d !== undefined).length} data points and ${completeData.filter(d => d === null).length} missing points`);
                    
                    // Debug: Log the last few data points to check for missing data at the end
                    const lastFewHours = 5;
                    console.log(`Last ${lastFewHours} hours of data:`);
                    for (let i = Math.max(0, completeData.length - lastFewHours); i < completeData.length; i++) {
                        console.log(`Hour ${completeTimeLabels[i]}: ${completeData[i] === null ? 'MISSING' : completeData[i] === undefined ? 'UNDEFINED' : completeData[i].toFixed(2)}`);
                    }
                    
                    // Store chart data and options for reuse when switching chart types
                    chartData = {
                        labels: completeTimeLabels,
                        datasets: [{
                            label: 'Funding Rate (%)',
                            data: completeData,
                            borderColor: function(context) {
                                const index = context.dataIndex;
                                const value = context.dataset.data[index];
                                return value >= 0 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
                            },
                            backgroundColor: 'transparent', // No fill from Chart.js (we'll use our plugin)
                            borderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            tension: 0.1,
                            spanGaps: false
                        }]
                    };
                    
                    chartOptions = {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            duration: 400 // Set a short animation duration for a subtle effect
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const value = context.raw;
                                        if (value === null) {
                                            return 'No data available';
                                        }
                                        return `Funding Rate: ${formatChartValue(value)}`;
                                    }
                                }
                            },
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: '#cccccc',
                                    maxRotation: 45,
                                    minRotation: 45,
                                    // Limit the number of x-axis labels for readability
                                    callback: function(val, index) {
                                        // For longer ranges, show fewer labels
                                        const labelInterval = range === '1d' ? 1 : 
                                                            range === '1w' ? 6 : 
                                                            range === '2w' ? 12 : 
                                                            range === '1m' ? 24 : 
                                                            range === '2m' ? 48 :
                                                            72; // For '3m', show every 72 hours
                                        return index % labelInterval === 0 ? this.getLabelForValue(val) : '';
                                    }
                                }
                            },
                            y: {
                                grid: {
                                    color: function(context) {
                                        if (context.tick.value === 0) {
                                            return 'rgba(255, 255, 255, 0.5)'; // Highlight zero line
                                        }
                                        return 'rgba(255, 255, 255, 0.1)';
                                    }
                                },
                                ticks: {
                                    color: '#cccccc',
                                    callback: function(value) {
                                        return formatChartValue(value);
                                    }
                                }
                            }
                        }
                    };
                    
                    // Create the chart with the current chart type
                    createChart(selectedChartType);
                } else {
                    // CSV format not recognized
                    $('#chartLoading').hide();
                    $('#coinInfoPopupContent').html('<p class="error-message">Could not parse funding data format.</p>');
                }
            },
            error: function(xhr, status, error) {
                console.error("Error loading CSV:", error);
                console.log("Status:", status);
                console.log("XHR:", xhr);
                
                // If CSV fetch fails, use the averages
                $('#chartLoading').hide();
                
                if (currentRate === null && oneDay === undefined && threeDay === undefined && fiveDay === undefined) {
                    $('#coinInfoPopupContent').html('<p class="error-message">No funding data available for this coin.</p>');
                    return;
                }
                
                // Create a simple chart with the available averages
                const labels = [];
                const data = [];
                
                if (fiveDay !== undefined) {
                    labels.push('5-Day Avg');
                    data.push(fiveDay);
                }
                
                if (threeDay !== undefined) {
                    labels.push('3-Day Avg');
                    data.push(threeDay);
                }
                
                if (oneDay !== undefined) {
                    labels.push('1-Day Avg');
                    data.push(oneDay);
                }
                
                if (currentRate !== null) {
                    labels.push('Current');
                    data.push(currentRate);
                }
                
                // Store chart data and options for reuse when switching chart types
                chartData = {
                    labels: labels,
                    datasets: [{
                        label: 'Funding Rate (%)',
                        data: data,
                        backgroundColor: function(context) {
                            const value = context.raw;
                            return value >= 0 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
                        },
                        borderColor: function(context) {
                            const value = context.raw;
                            return value >= 0 ? 'rgba(0, 255, 0, 1.0)' : 'rgba(255, 0, 0, 1.0)';
                        },
                        borderWidth: 1
                    }]
                };
                
                chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 400 // Set a short animation duration for a subtle effect
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Funding Rate: ${formatChartValue(context.raw)}`;
                                }
                            }
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#cccccc'
                            }
                        },
                        y: {
                            grid: {
                                color: function(context) {
                                    if (context.tick.value === 0) {
                                        return 'rgba(255, 255, 255, 0.5)'; // Highlight zero line
                                    }
                                    return 'rgba(255, 255, 255, 0.1)';
                                }
                            },
                            ticks: {
                                color: '#cccccc',
                                callback: function(value) {
                                    return formatChartValue(value);
                                }
                            }
                        }
                    }
                };
                
                // Create the chart with the current chart type
                createChart('bar'); // Always use bar for averages
                
                // Update title to reflect we're showing averages
                $('#coinInfoPopupTitle').text(`${coin} Funding Rate Averages`);
                
                // Disable chart type selector for averages
                $('#chartTypeSelect').prop('disabled', true);
            }
        });
    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.error("Error loading JSON:", errorThrown);
        console.log("Status:", textStatus);
        console.log("jqXHR:", jqXHR);
        
        // If JSON fetch fails, show error message
        $('#chartLoading').hide();
        $('#coinInfoPopupContent').html('<p class="error-message">Failed to load funding data.</p>');
    });
}

// Function to format chart value based on display mode
function formatChartValue(value, mode = displayMode) {
    if (value === null || value === undefined) {
        return 'No data';
    }
    
    if (mode === 'apr') {
        // Already in APR format
        return value.toFixed(2) + '%';
    } else {
        // Convert from APR to hourly
        const hourlyRate = value / (24 * 365);
        return hourlyRate.toFixed(6) + '%';
    }
}

// Function to create or update the chart with the specified type
function createChart(type) {
    if (!chartData || !chartOptions) return;
    
    const ctx = document.getElementById('fundingHistoryChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.fundingChart) {
        window.fundingChart.destroy();
    }
    
    // Create a deep copy of the chart data to avoid modifying the original
    const chartDataCopy = JSON.parse(JSON.stringify(chartData));
    
    // Create a deep copy of the chart options
    const chartOptionsCopy = JSON.parse(JSON.stringify(chartOptions));
    
    // Disable animations for all chart types to make them appear instantly
    chartOptionsCopy.animation = {
        duration: 400 // Set a short animation duration for a subtle effect
    };
    
    // Configure dataset based on chart type
    if (type === 'line') {
        // For line chart, use a single dataset with no fill
        const originalData = chartData.datasets[0].data;
        
        chartDataCopy.datasets = [{
            label: 'Funding Rate (%)',
            data: originalData,
            borderColor: function(context) {
                const index = context.dataIndex;
                const value = context.dataset.data[index];
                return value >= 0 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
            },
            backgroundColor: 'transparent', // No fill from Chart.js (we'll use our plugin)
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.1,
            spanGaps: false,
            segment: {
                borderColor: function(context) {
                    // Get the current and previous data points
                    const currentValue = context.p1.parsed.y;
                    const previousValue = context.p0.parsed.y;
                    
                    // If crossing zero (one positive, one negative)
                    if ((previousValue >= 0 && currentValue < 0) || (previousValue < 0 && currentValue >= 0)) {
                        // Use the color of the previous point
                        return previousValue >= 0 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
                    }
                    
                    // Otherwise use the appropriate color based on the values
                    return currentValue >= 0 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
                }
            }
        }];
        
    } else if (type === 'bar') {
        // For bar chart, use a single dataset with color function
        chartDataCopy.datasets[0].backgroundColor = function(context) {
            const value = context.raw;
            if (value === null || value === undefined) return 'rgba(0, 0, 0, 0)'; // Transparent for missing data
            return value >= 0 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
        };
        
        chartDataCopy.datasets[0].borderColor = function(context) {
            const value = context.raw;
            if (value === null || value === undefined) return 'rgba(0, 0, 0, 0)'; // Transparent for missing data
            return value >= 0 ? 'rgba(0, 255, 0, 1.0)' : 'rgba(255, 0, 0, 1.0)';
        };
    }
    
    // Update tooltip and axis formatting based on display mode
    if (chartOptionsCopy.plugins && chartOptionsCopy.plugins.tooltip) {
        chartOptionsCopy.plugins.tooltip.callbacks.label = function(context) {
            const value = context.raw;
            if (value === null) {
                return 'No data available';
            }
            return `Funding Rate: ${formatChartValue(value)}`;
        };
    }
    
    if (chartOptionsCopy.scales && chartOptionsCopy.scales.y && chartOptionsCopy.scales.y.ticks) {
        chartOptionsCopy.scales.y.ticks.callback = function(value) {
            return formatChartValue(value);
        };
    }
    
    // Update chart options for performance with large datasets
    const range = selectedChartRange; // Use the global variable
    if (range === '3m' || range === '5m' || range === 'all') {
        // For larger datasets, add decimation to improve performance
        if (!chartOptionsCopy.plugins) chartOptionsCopy.plugins = {};
        chartOptionsCopy.plugins.decimation = {
            enabled: true,
            algorithm: 'min-max'
        };
        
        // Reduce animation duration for larger datasets
        chartOptionsCopy.animation.duration = 200;
        
        // Reduce point radius for larger datasets to avoid overcrowding
        if (type === 'line') {
            chartDataCopy.datasets[0].pointRadius = 2;
            chartDataCopy.datasets[0].pointHoverRadius = 4;
        }
    }
    
    // Define the area fill plugin
    const areaFillPlugin = {
        id: 'areaFill',
        beforeDraw: function(chart) {
            if (type !== 'line') return;
            
            const ctx = chart.ctx;
            const dataset = chart.data.datasets[0];
            const yAxis = chart.scales.y;
            const xAxis = chart.scales.x;
            const zeroY = yAxis.getPixelForValue(0);
            
            // Find the first and last non-null, non-undefined data points
            let firstDataIndex = -1;
            let lastDataIndex = -1;
            
            for (let i = 0; i < dataset.data.length; i++) {
                if (dataset.data[i] !== null && dataset.data[i] !== undefined) {
                    if (firstDataIndex === -1) firstDataIndex = i;
                    lastDataIndex = i;
                }
            }
            
            // Get all points
            const points = [];
            for (let i = 0; i < dataset.data.length; i++) {
                const x = xAxis.getPixelForValue(i);
                const value = dataset.data[i];
                
                // If data is missing (null, not undefined), draw a vertical yellow line
                if (value === null && i > 0 && i < dataset.data.length) {
                    // Additional check: only draw if between first and last actual data points
                    // or if after the last data point (for recent missing data)
                    if ((i > firstDataIndex && i < lastDataIndex) || 
                        (i > lastDataIndex)) { // Show missing data after the last data point
                        
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(x, yAxis.top);
                        ctx.lineTo(x, yAxis.bottom);
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)'; // Semi-transparent yellow
                        ctx.stroke();
                        ctx.restore();
                    }
                    continue;
                }
                
                // Skip undefined values (outside data range)
                if (value === undefined) continue;
                
                const y = yAxis.getPixelForValue(value);
                points.push({ x, y, value });
            }
            
            if (points.length === 0) return;
            
            // Draw fill for each segment
            for (let i = 0; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];
                
                // Skip if there's a gap or if we're at the last data point
                if (next.x - current.x > xAxis.width / (dataset.data.length - 1) * 1.5) continue;
                
                ctx.save();
                
                // Draw the filled area
                ctx.beginPath();
                ctx.moveTo(current.x, current.y);
                ctx.lineTo(next.x, next.y);
                ctx.lineTo(next.x, zeroY);
                ctx.lineTo(current.x, zeroY);
                ctx.closePath();
                
                // Fill based on whether the segment is above or below zero
                if (current.value >= 0 && next.value >= 0) {
                    // Both points above zero - fill green
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.15)'; // Reduced opacity
                } else if (current.value < 0 && next.value < 0) {
                    // Both points below zero - fill red
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'; // Reduced opacity
                } else if (current.value >= 0 && next.value < 0) {
                    // Crossing from above to below - use the color of the starting point
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.15)'; // Reduced opacity
                } else {
                    // Crossing from below to above - use the color of the starting point
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'; // Reduced opacity
                }
                
                ctx.fill();
                ctx.restore();
            }
        }
    };
    
    // Define the missing data indicator plugin for bar charts
    const missingDataPlugin = {
        id: 'missingData',
        beforeDraw: function(chart) {
            if (type !== 'bar') return;
            
            const ctx = chart.ctx;
            const dataset = chart.data.datasets[0];
            const yAxis = chart.scales.y;
            const xAxis = chart.scales.x;
            
            // Find the first and last non-null, non-undefined data points
            let firstDataIndex = -1;
            let lastDataIndex = -1;
            
            for (let i = 0; i < dataset.data.length; i++) {
                if (dataset.data[i] !== null && dataset.data[i] !== undefined) {
                    if (firstDataIndex === -1) firstDataIndex = i;
                    lastDataIndex = i;
                }
            }
            
            // Draw yellow indicators for missing data
            for (let i = 0; i < dataset.data.length; i++) {
                // Only draw for null values (missing data), not undefined (outside range)
                // Also skip the very first position to avoid edge artifacts
                if (dataset.data[i] === null && i > 0 && i < dataset.data.length) {
                    // Additional check: only draw if between first and last actual data points
                    // or if after the last data point (for recent missing data)
                    if ((i > firstDataIndex && i < lastDataIndex) || 
                        (i > lastDataIndex)) { // Show missing data after the last data point
                        
                        const x = xAxis.getPixelForValue(i);
                        
                        // Draw a vertical yellow line
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(x, yAxis.top);
                        ctx.lineTo(x, yAxis.bottom);
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)'; // Semi-transparent yellow
                        ctx.stroke();
                        
                        // Draw a small yellow indicator at the zero line
                        const zeroY = yAxis.getPixelForValue(0);
                        ctx.beginPath();
                        ctx.arc(x, zeroY, 3, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                        ctx.fill();
                        
                        ctx.restore();
                    }
                }
            }
        }
    };
    
    // Define the missing data tooltip plugin
    const missingDataTooltipPlugin = {
        id: 'missingDataTooltip',
        afterDraw: function(chart) {
            const ctx = chart.ctx;
            const dataset = chart.data.datasets[0];
            const yAxis = chart.scales.y;
            const xAxis = chart.scales.x;
            
            // Find the first and last non-null, non-undefined data points
            let firstDataIndex = -1;
            let lastDataIndex = -1;
            
            for (let i = 0; i < dataset.data.length; i++) {
                if (dataset.data[i] !== null && dataset.data[i] !== undefined) {
                    if (firstDataIndex === -1) firstDataIndex = i;
                    lastDataIndex = i;
                }
            }
            
            // Check for hover over missing data points
            for (let i = 0; i < dataset.data.length; i++) {
                if (dataset.data[i] === null && i > 0 && i < dataset.data.length) {
                    // Additional check: only consider if between first and last actual data points
                    // or if after the last data point (for recent missing data)
                    if ((i > firstDataIndex && i < lastDataIndex) || 
                        (i > lastDataIndex)) { // Show missing data after the last data point
                        
                        const x = xAxis.getPixelForValue(i);
                        
                        // Check if mouse is near this x position (proximity detection)
                        const proximityThreshold = 5; // pixels
                        if (Math.abs(mouseX - x) <= proximityThreshold) {
                            // Mouse is hovering near a missing data point, show tooltip
                            ctx.save();
                            
                            // Get the time label for this data point
                            const timeLabel = chart.data.labels[i];
                            
                            // Draw tooltip background
                            const tooltipText = `Missing data at ${timeLabel}`;
                            const tooltipWidth = ctx.measureText(tooltipText).width + 16;
                            const tooltipHeight = 24;
                            const tooltipX = x - tooltipWidth / 2;
                            const tooltipY = mouseY - tooltipHeight - 10;
                            
                            // Draw tooltip background
                            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                            ctx.beginPath();
                            // Use a compatible approach for rounded rectangle
                            const radius = 4;
                            ctx.moveTo(tooltipX + radius, tooltipY);
                            ctx.lineTo(tooltipX + tooltipWidth - radius, tooltipY);
                            ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY, tooltipX + tooltipWidth, tooltipY + radius);
                            ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - radius);
                            ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight, tooltipX + tooltipWidth - radius, tooltipY + tooltipHeight);
                            ctx.lineTo(tooltipX + radius, tooltipY + tooltipHeight);
                            ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipHeight, tooltipX, tooltipY + tooltipHeight - radius);
                            ctx.lineTo(tooltipX, tooltipY + radius);
                            ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + radius, tooltipY);
                            ctx.closePath();
                            ctx.fill();
                            
                            // Draw tooltip text
                            ctx.fillStyle = '#ffffff';
                            ctx.font = '12px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(tooltipText, tooltipX + tooltipWidth / 2, tooltipY + tooltipHeight / 2);
                            
                            // Draw a more prominent yellow indicator
                            ctx.beginPath();
                            ctx.arc(x, mouseY, 4, 0, Math.PI * 2);
                            ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
                            ctx.fill();
                            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                            
                            ctx.restore();
                            break; // Only show one tooltip at a time
                        }
                    }
                }
            }
        }
    };
    
    // Create the chart with the specified type and plugins
    window.fundingChart = new Chart(ctx, {
        type: type,
        data: chartDataCopy,
        options: chartOptionsCopy,
        plugins: type === 'line' ? [areaFillPlugin, missingDataTooltipPlugin] : [missingDataPlugin, missingDataTooltipPlugin]
    });
    
    // Add mouse move event listener to the chart canvas
    document.getElementById('fundingHistoryChart').addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        
        // Request animation frame to redraw the chart
        if (window.fundingChart) {
            window.fundingChart.render();
        }
    });
}

$(document).ready(function() {
    $.getJSON('funding_data.json', function(data) {
        // Update the data timestamp (from exchange)
        $('#timestamp').text(data.timestamp);

        // Update the generated_at timestamp (when the script finished executing)
        $('#generated_at').text(data.generated_at);

        // Initialize the main table
        initializeTable(data);
        
        // Setup modal functionality
        setupModal();
    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.error("Failed to load data: " + textStatus + ", " + errorThrown);
        $('body').prepend('<div class="error-message">Failed to load funding data. Please try refreshing the page.</div>');
    });
});
