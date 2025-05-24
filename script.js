(function() {
    try {
        const uaString = navigator.userAgent || "";
        const parser = new UAParser(uaString);
        const browserInfo = parser.getBrowser();
        const browserName = browserInfo.name ? browserInfo.name.toLowerCase() : "";

        const isChromiumBased = 
            browserName.includes('chrome') || browserName.includes('chromium') ||
            browserName.includes('edge') || browserName.includes('opera') || 
            browserName.includes('brave') || browserName.includes('vivaldi') ||
            (uaString.includes('Chrome') && !uaString.includes('Edg') && !uaString.includes('OPR')); // Broader check for Chromium

        const isOfficiallySupported = isChromiumBased && !browserName.includes('crios') && !browserName.includes('edgios');


        if (!isOfficiallySupported && (browserName.includes('safari') || browserName.includes('firefox') || browserName.includes('fxios') || browserName.includes('crios') || browserName.includes('edgios'))) {
            const mainContainer = document.getElementById('mainInfoContainer');
            if (mainContainer) mainContainer.style.display = 'none';
            const messageDiv = document.getElementById('browserCompatibilityMessage');
            if (messageDiv) {
                messageDiv.style.display = 'block';
                messageDiv.innerHTML = `
                    <h1>Compatibility Notice</h1>
                    <p>This page is optimized for desktop Chromium-based browsers (e.g., Google Chrome, Microsoft Edge, Opera, Brave).</p>
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

    function makeCopyable(cellId, textElementId, iconId) {
        const cellElement = document.getElementById(cellId);
        const textElement = document.getElementById(textElementId);
        const iconElement = document.getElementById(iconId);
        
        if (!cellElement || !textElement || !iconElement) return;

        cellElement.classList.add('copyable');
        iconElement.innerHTML = SVG_COPY_ICON;
        cellElement.style.cursor = 'pointer'; 

        const copyAction = async () => {
            const valueToCopy = textElement.dataset.copyValue;
            if (textElement.classList.contains('loading') || textElement.classList.contains('error-state') || 
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
        cellElement.addEventListener('click', copyAction);
    }

    async function fetchWithTimeout(resource, options = {}, timeout = 7000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        options.signal = controller.signal;
        try {
            const response = await fetch(resource, options); clearTimeout(id); return response;
        } catch (error) { clearTimeout(id); throw error; }
    }
    
    function updateText(elementId, label, valueForDisplay, valueForCopy, isError = false, isLoading = false) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const labelPart = `<span class="cell-label-part">${label}:</span>`;
        let valuePart;

        if (isLoading) {
            valuePart = `<span class="loading-text">Loading...</span>`;
            element.className = 'cell-text loading';
            element.dataset.copyValue = ''; 
        } else if (isError) {
            valuePart = `<span class="error-message">${valueForDisplay || 'Error'}</span>`;
            element.className = 'cell-text error-state'; 
            element.dataset.copyValue = ''; 
        } else {
            valuePart = valueForDisplay || 'N/A';
            element.dataset.copyValue = valueForCopy || (valueForDisplay === 'N/A' ? 'N/A' : '');
            element.className = 'cell-text';
        }
        element.innerHTML = `${labelPart} ${valuePart}`;
    }

    async function fetchIP(url, textElementId, label, ipType) {
        updateText(textElementId, label, null, null, false, true); // isLoading = true
        try {
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const ip = (await response.text()).trim();
            let isValid = (ipType === 'ipv4') ? /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip) : (ip.includes(':') && ip.length >= 3);
            if (isValid) { 
                updateText(textElementId, label, ip, ip);
            } else { 
                throw new Error('Invalid IP format'); 
            }
        } catch (error) {
            const isDnsFailureForIPv6 = ipType === 'ipv6' && error.message.toLowerCase().includes('err_name_not_resolved');
            const errorMessage = isDnsFailureForIPv6 ? 'Unavailable (DNS)' : (ipType === 'ipv6' ? 'Unavailable' : 'Could not determine');
            updateText(textElementId, label, errorMessage, '', true, false); // isError = true
        }
    }
    
    const API_IPWHO_IS = 'https://ipwho.is/';

    function getFlagEmoji(countryCode) {
        if (!countryCode || countryCode.length !== 2) return '';
        try {
            const codePoints = countryCode.toUpperCase().split('').map(char => 0x1F1E6 + (char.charCodeAt(0) - 0x41));
            return String.fromCodePoint(...codePoints);
        } catch (e) {
            return ''; // Fallback if fromCodePoint fails for some reason
        }
    }

    async function fetchGeoData() {
        const locationTextElId = 'locationText';
        updateText(locationTextElId, 'Location', null, null, false, true);
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

            let displayLocation = 'N/A';
            let copyLocation = 'N/A';

            if (city && countryFullName) {
                copyLocation = `${city}, ${countryFullName}`;
                displayLocation = `${flag} ${copyLocation}`.trimStart();
            } else if (city) {
                copyLocation = city;
                displayLocation = `${flag} ${copyLocation}`.trimStart();
            } else if (countryFullName) {
                copyLocation = countryFullName;
                displayLocation = `${flag} ${copyLocation}`.trimStart();
            }
            
            updateText(locationTextElId, 'Location', displayLocation, copyLocation);
        } catch (error) {
            updateText(locationTextElId, 'Location', 'Error fetching location', '', true);
            console.error('Error fetching geo data:', error);
        }
    }

    async function displayBrowserAndOSInfo() {
        const browserTextElId = 'browserText';
        const osTextElId = 'osText';
        
        updateText(browserTextElId, 'Browser', null, null, false, true);
        updateText(osTextElId, 'OS', null, null, false, true);
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
        } catch (uachError) { console.warn('Could not get UA Client Hints:', uachError); }

        if (!browserName || !osName || !browserVersion || !osVersion) {
            if (typeof UAParser === 'undefined') {
                updateText(browserTextElId, 'Browser', 'Error (Lib missing)', '', true);
                updateText(osTextElId, 'OS', 'Error (Lib missing)', '', true);
                console.error('UAParser library not loaded.'); return;
            }
            try {
                const parser = new UAParser(navigator.userAgent); const result = parser.getResult();
                if (!browserName && result.browser && result.browser.name) { browserName = result.browser.name; browserVersion = result.browser.version; }
                if (!osName && result.os && result.os.name) { osName = result.os.name; osVersion = result.os.version; }
            } catch (parseError) {
                updateText(browserTextElId, 'Browser', null, '', true);
                updateText(osTextElId, 'OS', null, '', true);
                console.error('Error parsing UA string with UAParser:', parseError); return;
            }
        }
        const browserFullString = `${browserName || 'Unknown'} ${browserVersion || ''}`.trim();
        const osFullString = `${osName || 'Unknown'} ${osVersion || ''}`.trim();
        updateText(browserTextElId, 'Browser', browserFullString, browserFullString);
        updateText(osTextElId, 'OS', osFullString, osFullString);
    }

    window.onload = async () => {
        if (document.getElementById('browserCompatibilityMessage').style.display === 'block') {
            return; 
        }

        fetchIP('https://ipv4.icanhazip.com', 'ipv4Text', 'IPv4', 'ipv4');
        fetchIP('https://ipv6.icanhazip.com', 'ipv6Text', 'IPv6', 'ipv6');
        fetchGeoData(); 
        try { await displayBrowserAndOSInfo(); } catch(e) {
            updateText('browserText', 'Browser', null, '', true);
            updateText('osText', 'OS', null, '', true);
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
})();