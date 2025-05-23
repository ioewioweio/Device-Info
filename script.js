const SVG_COPY_ICON = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
const SVG_COPIED_ICON = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';

function makeCopyable(valueElementId, iconElementId) {
    const valueElement = document.getElementById(valueElementId);
    const iconElement = document.getElementById(iconElementId);
    const container = valueElement.parentElement;
    if (!valueElement || !iconElement || !container) return;

    container.classList.add('copyable');
    iconElement.innerHTML = SVG_COPY_ICON;
    valueElement.style.cursor = 'pointer'; 
    iconElement.style.cursor = 'pointer';

    const copyAction = async () => {
        const textToCopy = valueElement.textContent;
        if (valueElement.classList.contains('loading') || valueElement.classList.contains('error') || !textToCopy || ['N/A', 'Loading...', 'Error', 'Unavailable', 'Unavailable (DNS)', 'Could not determine', 'Unknown'].includes(textToCopy)) {
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
    valueElement.addEventListener('click', copyAction);
    iconElement.addEventListener('click', copyAction);
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

async function fetchIP(url, elementId, ipType) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.className = 'loading value'; 
    element.textContent = 'Loading...';
    try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const ip = (await response.text()).trim();
        let isValid = (ipType === 'ipv4') ? /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip) : (ip.includes(':') && ip.length >= 3);
        if (isValid) { 
            element.textContent = ip; 
            element.className = 'value'; 
        } else { 
            throw new Error('Invalid IP format'); 
        }
    } catch (error) {
        const isDnsFailureForIPv6 = ipType === 'ipv6' && error.message.toLowerCase().includes('err_name_not_resolved');
        element.textContent = isDnsFailureForIPv6 ? 'Unavailable (DNS)' : (ipType === 'ipv6' ? 'Unavailable' : 'Could not determine');
        element.className = isDnsFailureForIPv6 ? 'value' : 'error value';
    }
}

const API_IPWHO_IS = 'https://ipwho.is/';

async function fetchGeoData() {
    const locationEl = document.getElementById('location');
    if (!locationEl) return;

    locationEl.textContent = 'Loading...';
    locationEl.className = 'loading value';

    const setElementValue = (el, value, isError = false) => {
        if (el) { 
            el.textContent = value || 'N/A'; 
            el.className = isError ? 'error value' : 'value'; 
        }
    };

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
        setElementValue(locationEl, combinedLocation);
    } catch (error) {
        setElementValue(locationEl, 'Error', true);
        console.error('Error fetching geo data:', error);
    }
}

async function displayBrowserAndOSInfo() {
    const browserEl = document.getElementById('browser');
    const osEl = document.getElementById('os');
    if(!browserEl || !osEl) return;

    browserEl.className = 'loading value'; 
    osEl.className = 'loading value';
    browserEl.textContent = 'Loading...'; 
    osEl.textContent = 'Loading...';
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
            if (browserEl) { browserEl.textContent = browserName || 'Error'; browserEl.className = 'error value'; }
            if (osEl) { osEl.textContent = osName || 'Error'; osEl.className = 'error value'; }
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
            if (browserEl && !browserName) { browserEl.textContent = "Error"; browserEl.className = 'error value'; }
            if (osEl && !osName) { osEl.textContent = "Error"; osEl.className = 'error value'; }
            console.error('Error parsing UA string with UAParser:', parseError);
            return;
        }
    }
    if (browserEl) {
        browserEl.textContent = `${browserName || 'Unknown'} ${browserVersion || ''}`.trim(); 
        browserEl.className = 'value';
    }
    if (osEl) {
        osEl.textContent = `${osName || 'Unknown'} ${osVersion || ''}`.trim(); 
        osEl.className = 'value';
    }
}

window.onload = async () => {
    fetchIP('https://ipv4.icanhazip.com', 'ipv4', 'ipv4');
    fetchIP('https://ipv6.icanhazip.com', 'ipv6', 'ipv6');
    fetchGeoData(); 
    try { 
        await displayBrowserAndOSInfo(); 
    } catch(e) {
        const browserEl = document.getElementById('browser'); 
        const osEl = document.getElementById('os');
        if (browserEl) { browserEl.textContent = "Error"; browserEl.className = 'error value'; }
        if (osEl) { osEl.textContent = "Error"; osEl.className = 'error value'; }
        console.error('Error displaying browser/OS info:', e);
    }

    const copyableFields = [
        { value: 'ipv4', icon: 'ipv4CopyIcon' }, 
        { value: 'ipv6', icon: 'ipv6CopyIcon' },
        { value: 'location', icon: 'locationCopyIcon' },
        { value: 'browser', icon: 'browserCopyIcon' }, 
        { value: 'os', icon: 'osCopyIcon' }
    ];
    copyableFields.forEach(field => makeCopyable(field.value, field.icon));
};