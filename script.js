(function() {
    try {
        const uaString = navigator.userAgent || "";
        const parser = new UAParser(uaString);
        const browserInfo = parser.getBrowser();
        const browserName = browserInfo.name ? browserInfo.name.toLowerCase() : "";

        const isChromiumBased = 
            browserName.includes('chrome') || 
            browserName.includes('chromium') ||
            browserName.includes('edge') ||    // Chromium Edge
            browserName.includes('opera') ||   // Opera (Blink engine)
            browserName.includes('brave') ||
            browserName.includes('vivaldi') ||
            browserName.includes('crios') ||   // Chrome on iOS (WebKit, but for detection purposes)
            browserName.includes('edgios');    // Edge on iOS (WebKit)
            // Note: Safari and Firefox are intentionally excluded.

        if (isChromiumBased && (browserName.includes('safari') && !isChromiumBased) ) {
             // Catch cases where UA might include "Safari" but is actually Chromium based.
             // This check is a bit redundant if the list is good.
        } else if (browserName.includes('safari') || browserName.includes('firefox') || browserName.includes('fxios')) {
            const mainContainer = document.getElementById('mainInfoContainer');
            if (mainContainer) {
                mainContainer.style.display = 'none';
            }
            const messageDiv = document.getElementById('browserCompatibilityMessage');
            if (messageDiv) {
                messageDiv.style.display = 'block';
                messageDiv.innerHTML = `
                    <h1>Compatibility Notice</h1>
                    <p>This page is optimized for modern Chromium-based browsers (such as Google Chrome, Microsoft Edge, Opera, Brave).</p>
                    <p>For the best experience, please switch to one of these browsers.</p>
                    <p style="font-size:0.9em; opacity:0.7;">Detected browser: ${browserInfo.name || 'Unknown'} ${browserInfo.version || ''}</p>
                `;
            }
            return; // Stop further script execution for non-Chromium
        }
    } catch (e) {
        console.warn("Browser detection error:", e); // Continue if UAParser fails for some reason
    }

    const SVG_COPY_ICON = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
    const SVG_COPIED_ICON = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';

    function makeCopyable(cellId, textElementId, iconId) {
        const cellElement = document.getElementById(cellId);
        const textElement = document.getElementById(textElementId);
        const iconElement = document.getElementById(iconId);
        
        if (!cellElement || !textElement || !iconElement) return;

        cellElement.classList.add('copyable');
        iconElement.innerHTML = SVG_COPY_ICON;
        cellElement.style.cursor = 'pointer'; 

        const copyAction = async () => {
            const textToCopy = textElement.textContent;
            if (textElement.classList.contains('loading') || textElement.classList.contains('error') || !textToCopy || ['Loading...', 'Error', 'Unavailable', 'Unavailable (DNS)', 'Could not determine', 'Unknown', 'N/A'].some(s => textToCopy.includes(s))) {
                return; 
            }
            try {
                await navigator.clipboard.writeText(textToCopy);
                iconElement.innerHTML = SVG_COPIED_ICON;
                setTimeout(() => { iconElement.innerHTML = SVG_COPY_ICON; }, 1500);
            } catch (err) { 
                console.error('Failed to copy text: ', err);
            }
        };
        cellElement.addEventListener('click', copyAction);
    }

    async function fetchWithTimeout(resource, options = {}, timeout = 7000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        options.signal = controller.signal;
        try {
            const response = await fetch(resource, options); 
            clearTimeout(id); 
            return response;
        } catch (error) { 
            clearTimeout(id); 
            throw error; 
        }
    }

    function updateText(elementId, label, value, isError = false, isLoading = false) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (isLoading) {
            element.textContent = `${label}: Loading...`;
            element.className = 'cell-text loading';
            return;
        }
        if (isError) {
            element.textContent = `${label}: Error`;
            element.className = 'cell-text error';
            return;
        }
        element.textContent = `${label}: ${value || 'N/A'}`;
        element.className = 'cell-text';
    }


    async function fetchIP(url, textElementId, label, ipType) {
        updateText(textElementId, label, null, false, true);
        try {
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const ip = (await response.text()).trim();
            let isValid = (ipType === 'ipv4') ? /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip) : (ip.includes(':') && ip.length >= 3);
            if (isValid) { 
                updateText(textElementId, label, ip);
            } else { 
                throw new Error('Invalid IP format'); 
            }
        } catch (error) {
            const isDnsFailureForIPv6 = ipType === 'ipv6' && error.message.toLowerCase().includes('err_name_not_resolved');
            const value = isDnsFailureForIPv6 ? 'Unavailable (DNS)' : (ipType === 'ipv6' ? 'Unavailable' : 'Could not determine');
            updateText(textElementId, label, value, !isDnsFailureForIPv6); // Only error if not expected DNS failure for IPv6
        }
    }
    
    const API_IPWHO_IS = 'https://ipwho.is/';

    async function fetchGeoData() {
        const locationTextElId = 'locationText';
        updateText(locationTextElId, 'Location', null, false, true);
        try {
            const responseIpwho = await fetchWithTimeout(API_IPWHO_IS);
            if (!responseIpwho.ok) throw new Error(`ipwho.is HTTP ${responseIpwho.status}`);
            const dataIpwho = await responseIpwho.json();
            if (dataIpwho.success === false && dataIpwho.message) throw new Error(`ipwho.is: ${dataIpwho.message}`);
            if (dataIpwho.success !== undefined && !dataIpwho.success) throw new Error('ipwho.is: API error');

            const city = dataIpwho.city || ''; 
            const countryFullName = dataIpwho.country || '';
            let combinedLocation = 'N/A';
            if (city && countryFullName) combinedLocation = `${city}, ${countryFullName}`;
            else if (city) combinedLocation = city; 
            else if (countryFullName) combinedLocation = countryFullName;
            updateText(locationTextElId, 'Location', combinedLocation);
        } catch (error) {
            updateText(locationTextElId, 'Location', null, true);
            console.error('Error fetching geo data:', error);
        }
    }

    async function displayBrowserAndOSInfo() {
        const browserTextElId = 'browserText';
        const osTextElId = 'osText';
        
        updateText(browserTextElId, 'Browser', null, false, true);
        updateText(osTextElId, 'OS', null, false, true);

        let browserName, browserVersion, osName, osVersion;

        try {
            if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
                const highEntropyValues = await navigator.userAgentData.getHighEntropyValues(["platform", "platformVersion", "fullVersionList"]);
                osName = highEntropyValues.platform || null;
                osVersion = highEntropyValues.platformVersion || null;
                if (highEntropyValues.fullVersionList && highEntropyValues.fullVersionList.length > 0) {
                    let primaryEntry = highEntropyValues.fullVersionList.find(e => e.brand === "Microsoft Edge") ||
                                       highEntropyValues.fullVersionList.find(e => e.brand === "Google Chrome") ||
                                       highEntropyValues.fullVersionList.find(e => e.brand === "Opera") ||
                                       highEntropyValues.fullVersionList.find(e => !e.brand.toLowerCase().includes("not") && !e.brand.toLowerCase().includes("chromium"));
                    if (primaryEntry) { 
                        browserName = primaryEntry.brand; 
                        browserVersion = primaryEntry.version; 
                    }
                }
            }
        } catch (uachError) { 
            console.warn('Could not get UA Client Hints:', uachError);
        }

        if (!browserName || !osName || !browserVersion || !osVersion) {
            if (typeof UAParser === 'undefined') {
                updateText(browserTextElId, 'Browser', 'Error (Lib missing)', true);
                updateText(osTextElId, 'OS', 'Error (Lib missing)', true);
                console.error('UAParser library not loaded.');
                return;
            }
            try {
                const parser = new UAParser(navigator.userAgent); 
                const result = parser.getResult();
                if (!browserName && result.browser && result.browser.name) { 
                    browserName = result.browser.name; 
                    browserVersion = result.browser.version; 
                }
                if (!osName && result.os && result.os.name) { 
                    osName = result.os.name; 
                    osVersion = result.os.version; 
                }
            } catch (parseError) {
                updateText(browserTextElId, 'Browser', null, true);
                updateText(osTextElId, 'OS', null, true);
                console.error('Error parsing UA string with UAParser:', parseError);
                return;
            }
        }
        updateText(browserTextElId, 'Browser', `${browserName || 'Unknown'} ${browserVersion || ''}`.trim());
        updateText(osTextElId, 'OS', `${osName || 'Unknown'} ${osVersion || ''}`.trim());
    }

    window.onload = async () => {
        if (document.getElementById('browserCompatibilityMessage').style.display === 'block') {
            return; // Don't run main script if compatibility message is shown
        }

        fetchIP('https://ipv4.icanhazip.com', 'ipv4Text', 'IPv4', 'ipv4');
        fetchIP('https://ipv6.icanhazip.com', 'ipv6Text', 'IPv6', 'ipv6');
        fetchGeoData(); 
        try { 
            await displayBrowserAndOSInfo(); 
        } catch(e) {
            updateText('browserText', 'Browser', null, true);
            updateText('osText', 'OS', null, true);
            console.error('Error displaying browser/OS info:', e);
        }

        const copyableCells = [
            { cell: 'ipv4Cell', text: 'ipv4Text', icon: 'ipv4CopyIcon' }, 
            { cell: 'ipv6Cell', text: 'ipv6Text', icon: 'ipv6CopyIcon' },
            { cell: 'locationCell', text: 'locationText', icon: 'locationCopyIcon' },
            { cell: 'browserCell', text: 'browserText', icon: 'browserCopyIcon' }, 
            { cell: 'osCell', text: 'osText', icon: 'osCopyIcon' }
        ];
        copyableCells.forEach(field => makeCopyable(field.cell, field.text, field.icon));
    };
})(); // IIFE to encapsulate browser check and main logic