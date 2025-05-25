(function() {
    try {
        const uaString = navigator.userAgent || "";
        const parser = new UAParser(uaString);
        const browserInfo = parser.getBrowser();
        const browserName = browserInfo.name ? browserInfo.name.toLowerCase() : "";

        const isOfficiallySupported = 
            (browserName.includes('chrome') && !uaString.includes("Edg/") && !uaString.includes("OPR/")) || 
            browserName.includes('chromium') ||
            (uaString.includes("Edg/") && uaString.includes("Chrome")) || 
            (uaString.includes("OPR/") && uaString.includes("Chrome")) || 
            browserName.includes('brave') ||
            browserName.includes('vivaldi');

        if (!isOfficiallySupported && (browserName.includes('safari') || browserName.includes('firefox') || browserName.includes('fxios') || browserName.includes('crios') || browserName.includes('edgios'))) {
            const mainContainer = document.getElementById('mainInfoContainer');
            if (mainContainer) mainContainer.style.display = 'none';
            const messageDiv = document.getElementById('browserCompatibilityMessage');
            if (messageDiv) {
                messageDiv.style.display = 'block';
                messageDiv.innerHTML = `
                    <h1>Compatibility Notice</h1>
                    <p>This page is optimized for modern desktop Chromium-based browsers (e.g., Google Chrome, Microsoft Edge, Opera, Brave).</p>
                    <p>You may experience limited functionality or display issues on other browsers.</p>
                    <p style="font-size:0.9em; opacity:0.7;">Detected: ${browserInfo.name || 'Unknown'} ${browserInfo.version || ''}</p>
                `;
            }
            return; 
        }
    } catch (e) {
        console.warn("Browser detection error:", e);
    }

    const SVG_COPY_ICON = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
    const SVG_COPIED_ICON = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';

    function makeCopyable(cellElementId, valueElementId, iconElementId) {
        const cellElement = document.getElementById(cellElementId);
        const valueElement = document.getElementById(valueElementId);
        const iconElement = document.getElementById(iconElementId);
        
        if (!cellElement || !valueElement || !iconElement) return;

        iconElement.innerHTML = SVG_COPY_ICON;

        const copyAction = async () => {
            const valueToCopy = valueElement.dataset.copyValue;
            if (!cellElement.classList.contains('icon-active') || 
                valueToCopy === undefined || valueToCopy === null || valueToCopy === '' || 
                ['N/A', 'Unknown', 'Could not determine', 'Unavailable', 'Unavailable (DNS)'].includes(valueToCopy)) {
                return; 
            }
            try {
                await navigator.clipboard.writeText(valueToCopy);
                iconElement.innerHTML = SVG_COPIED_ICON;
                setTimeout(() => { iconElement.innerHTML = SVG_COPY_ICON; }, 1500);
            } catch (err) { 
                console.error('Failed to copy text: ', err);
            }
        };
        iconElement.addEventListener('click', copyAction);
    }

    async function fetchWithTimeout(resource, options = {}, timeout = 7000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        options.signal = controller.signal;
        try {
            const response = await fetch(resource, options); clearTimeout(id); return response;
        } catch (error) { clearTimeout(id); throw error; }
    }
    
    function updateCellValue(valueElementId, valueForDisplay, valueForCopy, isError = false, isLoading = false) {
        const element = document.getElementById(valueElementId);
        if (!element) return;
        const cellElement = element.closest('.info-cell'); 

        if (isLoading) {
            element.innerHTML = `<span class="loading-text">Loading...</span>`;
            element.className = 'cell-value loading';
            element.dataset.copyValue = ''; 
            if (cellElement) cellElement.classList.remove('icon-active');
        } else if (isError) {
            element.innerHTML = `<span class="error-message">${valueForDisplay || 'Error'}</span>`;
            element.className = 'cell-value error-state'; 
            element.dataset.copyValue = ''; 
            if (cellElement) cellElement.classList.remove('icon-active');
        } else {
            element.textContent = valueForDisplay || 'N/A';
            element.dataset.copyValue = valueForCopy || (valueForDisplay === 'N/A' ? 'N/A' : '');
            element.className = 'cell-value';
            
            const uncopyableValues = ['N/A', 'Unknown', 'Could not determine', 'Unavailable', 'Unavailable (DNS)', ''];
            if (cellElement && valueForCopy && !uncopyableValues.includes(valueForCopy)) {
                cellElement.classList.add('icon-active');
            } else if (cellElement) {
                cellElement.classList.remove('icon-active');
            }
        }
    }

    async function fetchIP(valueElementId, ipType) {
        const url = ipType === 'ipv4' ? 'https://ipv4.icanhazip.com' : 'https://ipv6.icanhazip.com';
        updateCellValue(valueElementId, null, null, false, true); 
        try {
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const ip = (await response.text()).trim();
            let isValid = (ipType === 'ipv4') ? /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip) : (ip.includes(':') && ip.length >= 3);
            if (isValid) { 
                updateCellValue(valueElementId, ip, ip);
            } else { 
                throw new Error('Invalid IP format'); 
            }
        } catch (error) {
            const isDnsFailureForIPv6 = ipType === 'ipv6' && error.message.toLowerCase().includes('err_name_not_resolved');
            const errorMessage = isDnsFailureForIPv6 ? 'Unavailable (DNS)' : (ipType === 'ipv6' ? 'Unavailable' : 'Could not determine');
            updateCellValue(valueElementId, errorMessage, '', true, false);
        }
    }
    
    const API_IPWHO_IS = 'https://ipwho.is/';
    const API_IPINFO_IO = 'https://ipinfo.io/json';

    function getFlagEmoji(countryCode) {
        if (!countryCode || countryCode.length !== 2) return '';
        try {
            const codePoints = countryCode.toUpperCase().split('').map(char => 0x1F1E6 + (char.charCodeAt(0) - 0x41));
            return String.fromCodePoint(...codePoints);
        } catch (e) { return ''; }
    }
    
    function parseProviderFromHostname(hostname) {
        if (!hostname || typeof hostname !== 'string' || hostname === 'N/A' || !hostname.includes('.')) {
            return 'N/A';
        }
        const lowerHostname = hostname.toLowerCase();

        // Specific check for "soyuz" based on your rDNS example
        if (lowerHostname.includes('soyuz.in.ua')) {
            const parts = lowerHostname.split('.');
            for (const part of parts) {
                if (part.includes('soyuz')) {
                    let name = part.replace(/^(nat-pool-|dyn-pool-|static-|client-)/, '');
                    name = name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    return name === "Soyuz" ? "Soyuz Telecom" : name; // Be more specific if it's just "Soyuz"
                }
            }
            return "Soyuz Network"; // Fallback for soyuz.in.ua
        }

        // Generic parsing
        let parts = lowerHostname.split('.');
        const commonInfraPrefixes = ['ip', 'host', 'dsl', 'pool', 'dyn', 'static', 'ppp', 'gw', 'client', 'user', 'wn', 'nat-pool', 'rev', 'ptr'];
        
        // Remove infrastructure prefixes from the beginning of the array of parts
        while (parts.length > 0 && (commonInfraPrefixes.includes(parts[0]) || parts[0].match(/^([0-9]+[-]?)+$/) )) {
            parts.shift();
        }

        if (parts.length === 0) return hostname; // Fallback to original if all parts removed

        // Try to identify a meaningful name, often the part before a common SLD/TLD
        if (parts.length >= 2) {
            // If structure is domain.tld (e.g. google.com) or domain.sld.tld (e.g. example.co.uk)
            let significantPart = parts[0]; 
            if (parts.length > 2 && (parts[1] === 'co' || parts[1] === 'com' || parts[1] === 'net' || parts[1] === 'org')) {
                 // e.g. customer.isp.co.uk -> "isp"
                 // e.g. myisp.com.au -> "myisp"
                 significantPart = parts[0];
            } else if (parts.length === 2) { // domain.tld
                 significantPart = parts[0];
            } else if (parts.length > 2) { //  a.b.c.com -> take 'c' or 'b' if 'c' is too generic
                significantPart = parts[parts.length - 3]; // Try third from end
                 if(significantPart.length <= 3 && parts.length > 3) significantPart = parts[parts.length - 4]; // Try fourth
            }


            if (significantPart && significantPart.length > 0 && !(["com", "net", "org"].includes(significantPart) && parts.length - (parts.indexOf(significantPart)+1) <=1 )) {
                 return significantPart.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            }
        }
        // Fallback: join remaining parts if more than one, or take the first, or original hostname
        if (parts.length > 1) return parts.join('.');
        if (parts.length === 1 && parts[0]) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        
        return hostname; 
    }


    async function fetchGeoData() {
        const locationValueElId = 'locationValue';
        const locationPrefixIconEl = document.getElementById('locationPrefixIcon');
        const providerValueElId = 'providerValue';
        
        updateCellValue(locationValueElId, null, null, false, true);
        updateCellValue(providerValueElId, null, null, false, true);
        if (locationPrefixIconEl) locationPrefixIconEl.textContent = '';
        // No need to touch other prefix icons as they will remain empty by default.

        try { 
            const responseIpwho = await fetchWithTimeout(API_IPWHO_IS);
            if (!responseIpwho.ok) throw new Error(`ipwho.is HTTP ${responseIpwho.status}`);
            const dataIpwho = await responseIpwho.json();
            if (dataIpwho.success === false && dataIpwho.message) throw new Error(`ipwho.is: ${dataIpwho.message}`);
            if (dataIpwho.success !== undefined && !dataIpwho.success) throw new Error('ipwho.is: API error');

            const city = dataIpwho.city || ''; 
            const countryFullName = dataIpwho.country || '';
            const countryCode = dataIpwho.country_code || '';
            const flag = getFlagEmoji(countryCode);

            if (locationPrefixIconEl) locationPrefixIconEl.textContent = flag;
            
            let locationString = 'N/A';
            if (city && countryFullName) locationString = `${city}, ${countryFullName}`;
            else if (city) locationString = city; 
            else if (countryFullName) locationString = countryFullName;
            
            updateCellValue(locationValueElId, locationString, locationString);
        } catch (error) {
            updateCellValue(locationValueElId, 'Error', '', true);
            if (locationPrefixIconEl) locationPrefixIconEl.textContent = '⚠️';
            console.error('Error fetching location data (ipwho.is):', error);
        }
            
        try { 
            const responseIpinfo = await fetchWithTimeout(API_IPINFO_IO);
            if (!responseIpinfo.ok) throw new Error(`ipinfo.io HTTP ${responseIpinfo.status}`);
            const dataIpinfo = await responseIpinfo.json();
            
            const rawHostname = dataIpinfo.hostname;
            const deducedProvider = parseProviderFromHostname(rawHostname);
            updateCellValue(providerValueElId, deducedProvider, deducedProvider);

        } catch (error) {
            updateCellValue(providerValueElId, 'Error', '', true);
            console.error('Error fetching provider data (ipinfo.io):', error);
        }
    }

    async function displayBrowserAndOSInfo() {
        const browserValueElId = 'browserValue';
        const osValueElId = 'osValue';
        // const browserPrefixIconEl = document.getElementById('browserPrefixIcon'); // Not used anymore
        // const osPrefixIconEl = document.getElementById('osPrefixIcon');       // Not used anymore
        
        updateCellValue(browserValueElId, null, null, false, true);
        updateCellValue(osValueElId, null, null, false, true);
        // if (browserPrefixIconEl) browserPrefixIconEl.textContent = ''; // Ensure empty
        // if (osPrefixIconEl) osPrefixIconEl.textContent = '';       // Ensure empty

        let browserName, browserVersion, osName, osVersion;
        try {
            if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
                const highEntropyValues = await navigator.userAgentData.getHighEntropyValues(["platform", "platformVersion", "fullVersionList"]);
                osName = highEntropyValues.platform || null; osVersion = highEntropyValues.platformVersion || null;
                if (highEntropyValues.fullVersionList && highEntropyValues.fullVersionList.length > 0) {
                    let primaryEntry = highEntropyValues.fullVersionList.find(e => e.brand === "Microsoft Edge") ||
                                       highEntropyValues.fullVersionList.find(e => e.brand === "Google Chrome") ||
                                       highEntropyValues.fullVersionList.find(e => e.brand === "Opera") ||
                                       highEntropyValues.fullVersionList.find(e => !e.brand.toLowerCase().includes("not") && !e.brand.toLowerCase().includes("chromium"));
                    if (primaryEntry) { browserName = primaryEntry.brand; browserVersion = primaryEntry.version; }
                }
            }
        } catch (uachError) { console.warn('Could not get UA Client Hints:', uachError); }

        if (!browserName || !osName || !browserVersion || !osVersion) {
            if (typeof UAParser === 'undefined') {
                updateCellValue(browserValueElId, 'Error (Lib missing)', '', true); updateCellValue(osValueElId, 'Error (Lib missing)', '', true);
                console.error('UAParser library not loaded.'); return;
            }
            try {
                const parser = new UAParser(navigator.userAgent); const result = parser.getResult();
                if (!browserName && result.browser && result.browser.name) { browserName = result.browser.name; browserVersion = result.browser.version; }
                if (!osName && result.os && result.os.name) { osName = result.os.name; osVersion = result.os.version; }
            } catch (parseError) {
                updateCellValue(browserValueElId, null, '', true); updateCellValue(osValueElId, null, '', true);
                console.error('Error parsing UA string with UAParser:', parseError); return;
            }
        }
        const browserFullString = `${browserName || 'Unknown'} ${browserVersion || ''}`.trim();
        const osFullString = `${osName || 'Unknown'} ${osVersion || ''}`.trim();
        
        // No longer setting browser/OS prefix icons
        // if (browserPrefixIconEl) browserPrefixIconEl.textContent = getBrowserEmoji(browserName); // REMOVED
        // if (osPrefixIconEl) osPrefixIconEl.textContent = getOsEmoji(osName);                   // REMOVED

        updateCellValue(browserValueElId, browserFullString, browserFullString);
        updateCellValue(osValueElId, osFullString, osFullString);
    }

    window.onload = async () => {
        if (document.getElementById('browserCompatibilityMessage').style.display === 'block') return;
        fetchIP('ipv4Value', 'ipv4');
        fetchIP('ipv6Value', 'ipv6');
        fetchGeoData(); 
        try { await displayBrowserAndOSInfo(); } catch(e) {
            updateCellValue('browserValue', null, '', true); updateCellValue('osValue', null, '', true);
            console.error('Error displaying browser/OS info:', e);
        }
        const copyableCells = [
            { cell: 'ipv4Cell', value: 'ipv4Value', icon: 'ipv4CopyIcon' }, 
            { cell: 'ipv6Cell', value: 'ipv6Value', icon: 'ipv6CopyIcon' },
            { cell: 'locationCell', value: 'locationValue', icon: 'locationCopyIcon' },
            { cell: 'providerCell', value: 'providerValue', icon: 'providerCopyIcon' },
            { cell: 'browserCell', value: 'browserValue', icon: 'browserCopyIcon' }, 
            { cell: 'osCell', value: 'osValue', icon: 'osCopyIcon' }
        ];
        copyableCells.forEach(field => makeCopyable(field.cell, field.value, field.icon));
    };
})();