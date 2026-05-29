// Initialize the map centered in Brazil
const map = L.map('map').setView([-15.7801, -47.9292], 5);

// Layer definitions
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

const cartoDbDarkMatter = L.tileLayer('https://{s].basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

const esriSatImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Fix potential typo in cartodb subdomain and add default layer
const cartoDbDarkMatterCorrected = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
});
cartoDbDarkMatterCorrected.addTo(map);

const baseLayers = {
    "Modo Escuro": cartoDbDarkMatterCorrected,
    "Mapa de Ruas": osmLayer,
    "Satélite": esriSatImagery
};

L.control.layers(baseLayers).addTo(map);

const originInput = document.getElementById('origin');
const destinationInput = document.getElementById('destination');
const addStopButton = document.getElementById('add-stop');
const getRouteButton = document.getElementById('get-route');
const stopsContainer = document.getElementById('stops-container');
const totalDistanceSpan = document.getElementById('total-distance');
const totalTimeSpan = document.getElementById('total-time');
const instructionsList = document.getElementById('instructions-list');

let stopCounter = 0;
let waypoints = [];
let routingControl = null;

// Custom icons
const originIcon = L.divIcon({
    className: 'custom-icon-marker',
    html: '<div style="background-image: linear-gradient(135deg, #00f0ff 0%, #0077ff 100%); width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0, 240, 255, 0.8);"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
});

const destinationIcon = L.divIcon({
    className: 'custom-icon-marker',
    html: '<div style="background-image: linear-gradient(135deg, #ff00ff 0%, #a800a8 100%); width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(255, 0, 255, 0.8);"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
});

const stopIcon = L.divIcon({
    className: 'custom-icon-marker',
    html: '<div style="background-color: #e2e8f0; width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid #0f172a; box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);"></div>',
    iconSize: [17, 17],
    iconAnchor: [8, 8]
});

// Debounce helper
const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

// ViaCEP API for address autocomplete (CEP)
async function searchCep(cep) {
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
            return `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
        }
    } catch (error) {
        console.error("Erro ao buscar CEP:", error);
    }
    return null;
}

// Helper function to perform CORS-immune JSONP requests
function fetchJsonp(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const separator = url.includes('?') ? '&' : '?';
        const jsonpUrl = `${url}${separator}json_callback=${callbackName}`;
        
        const script = document.createElement('script');
        script.src = jsonpUrl;
        
        window[callbackName] = (data) => {
            resolve(data);
            document.head.removeChild(script);
            delete window[callbackName];
        };
        
        script.onerror = (err) => {
            reject(new Error('JSONP request failed'));
            document.head.removeChild(script);
            delete window[callbackName];
        };
        
        document.head.appendChild(script);
    });
}

// OSM Nominatim API for geocoding (using native JSONP to bypass all CORS and proxy blocks)
async function searchAddress(query, inputElement) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;

    try {
        const data = await fetchJsonp(url);
        return data;
    } catch (error) {
        console.error("Erro ao buscar endereço:", error);
        return [];
    }
}

function displayAutocompleteResults(results, inputElement) {
    const autocompleteResultsDiv = document.getElementById(`autocomplete-${inputElement.id}`);
    if (!autocompleteResultsDiv) return;
    
    autocompleteResultsDiv.innerHTML = '';

    if (results.length === 0) {
        autocompleteResultsDiv.style.display = 'none';
        return;
    }

    results.forEach(result => {
        const div = document.createElement('div');
        div.textContent = result.display_name;
        div.addEventListener('click', () => {
            inputElement.value = result.display_name;
            autocompleteResultsDiv.style.display = 'none';
            inputElement.dataset.lat = result.lat;
            inputElement.dataset.lon = result.lon;
        });
        autocompleteResultsDiv.appendChild(div);
    });
    autocompleteResultsDiv.style.display = 'block';
}

async function handleAddressInput(event) {
    const inputElement = event.target;
    const query = inputElement.value;
    const autocompleteResultsDiv = document.getElementById(`autocomplete-${inputElement.id}`);

    if (!autocompleteResultsDiv) return;

    if (query.length < 3) {
        autocompleteResultsDiv.style.display = 'none';
        return;
    }

    // Check if it's a direct coordinate entry (lat, lon)
    const coordRegex = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
    const coordMatch = query.match(coordRegex);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[3]);
        autocompleteResultsDiv.innerHTML = '';
        const div = document.createElement('div');
        div.textContent = `📍 Usar Coordenadas: ${lat}, ${lon}`;
        div.style.fontWeight = '600';
        div.style.color = '#00f0ff';
        div.style.padding = '8px 12px';
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
            inputElement.value = `${lat}, ${lon}`;
            autocompleteResultsDiv.style.display = 'none';
            inputElement.dataset.lat = lat;
            inputElement.dataset.lon = lon;
        });
        autocompleteResultsDiv.appendChild(div);
        autocompleteResultsDiv.style.display = 'block';
        return;
    }

    // Check if it's a CEP
    const cepRegex = /^\d{5}-?\d{3}$/;
    if (cepRegex.test(query)) {
        const addressFromCep = await searchCep(query.replace('-', ''));
        if (addressFromCep) {
            inputElement.value = addressFromCep;
            // Geocode the full address to get lat/lon for the CEP
            const geocodeResults = await searchAddress(addressFromCep, inputElement);
            if (geocodeResults.length > 0) {
                inputElement.dataset.lat = geocodeResults[0].lat;
                inputElement.dataset.lon = geocodeResults[0].lon;
            }
            autocompleteResultsDiv.style.display = 'none';
            return;
        }
    }

    const results = await searchAddress(query, inputElement);
    displayAutocompleteResults(results, inputElement);
}

const debouncedHandleAddressInput = debounce(handleAddressInput, 400);

originInput.addEventListener('input', debouncedHandleAddressInput);
destinationInput.addEventListener('input', debouncedHandleAddressInput);

// Close autocomplete results if clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-group')) {
        document.querySelectorAll('.autocomplete-results').forEach(el => {
            el.style.display = 'none';
        });
    }
});

addStopButton.addEventListener('click', () => {
    stopCounter++;
    const stopDiv = document.createElement('div');
    stopDiv.classList.add('input-group');
    stopDiv.innerHTML = `
        <label for="stop-${stopCounter}">Parada ${stopCounter}:</label>
        <input type="text" id="stop-${stopCounter}" name="stop-${stopCounter}" placeholder="Digite o CEP ou endereço" data-type="stop" autocomplete="off">
        <div class="autocomplete-results" id="autocomplete-stop-${stopCounter}" style="display: none;"></div>
        <button class="remove-stop gradient-button" data-stop-id="${stopCounter}">Remover</button>
    `;
    stopsContainer.appendChild(stopDiv);

    const newStopInput = document.getElementById(`stop-${stopCounter}`);
    newStopInput.addEventListener('input', debouncedHandleAddressInput);

    stopDiv.querySelector('.remove-stop').addEventListener('click', (e) => {
        e.preventDefault();
        stopDiv.remove();
        updateWaypoints(); // Recalculate waypoints after removing a stop
    });
});

async function getCoordinates(address, inputElement) {
    // Check if the input is already in "lat, lon" format
    const coordRegex = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
    const coordMatch = address.match(coordRegex);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[3]);
        return [lat, lon];
    }

    // Try direct search
    let results = await searchAddress(address, inputElement);
    if (results && results.length > 0) {
        return [results[0].lat, results[0].lon];
    }

    // Fallback 1: "Rua, Cidade - Estado"
    const parts = address.split(',');
    if (parts.length >= 2) {
        const genericAddress = `${parts[0].trim()}, ${parts[parts.length - 1].trim()}`;
        results = await searchAddress(genericAddress, inputElement);
        if (results && results.length > 0) {
            return [results[0].lat, results[0].lon];
        }
    }

    // Fallback 2: "Cidade - Estado"
    const cityStateMatch = address.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*-\s*([A-Z]{2})\b/);
    if (cityStateMatch) {
        results = await searchAddress(`${cityStateMatch[1]} - ${cityStateMatch[2]}`, inputElement);
        if (results && results.length > 0) {
            return [results[0].lat, results[0].lon];
        }
    }

    console.warn(`Could not find coordinates for: ${address}`);
    return null;
}

async function updateWaypoints() {
    waypoints = [];
    
    // Check Origin
    if (!originInput.value.trim()) return;
    const originCoords = originInput.dataset.lat && originInput.dataset.lon ? [parseFloat(originInput.dataset.lat), parseFloat(originInput.dataset.lon)] : null;
    if (!originCoords) {
        const coords = await getCoordinates(originInput.value, originInput);
        if (coords) {
            waypoints.push(L.latLng(coords[0], coords[1]));
            originInput.dataset.lat = coords[0];
            originInput.dataset.lon = coords[1];
        }
    } else {
        waypoints.push(L.latLng(originCoords[0], originCoords[1]));
    }

    // Check Stops
    const stopInputs = document.querySelectorAll('#stops-container input[type="text"]');
    for (const input of stopInputs) {
        if (!input.value.trim()) continue;
        const stopCoords = input.dataset.lat && input.dataset.lon ? [parseFloat(input.dataset.lat), parseFloat(input.dataset.lon)] : null;
        if (!stopCoords) {
            const coords = await getCoordinates(input.value, input);
            if (coords) {
                waypoints.push(L.latLng(coords[0], coords[1]));
                input.dataset.lat = coords[0];
                input.dataset.lon = coords[1];
            }
        } else {
            waypoints.push(L.latLng(stopCoords[0], stopCoords[1]));
        }
    }

    // Check Destination
    if (!destinationInput.value.trim()) return;
    const destinationCoords = destinationInput.dataset.lat && destinationInput.dataset.lon ? [parseFloat(destinationInput.dataset.lat), parseFloat(destinationInput.dataset.lon)] : null;
    if (!destinationCoords) {
        const coords = await getCoordinates(destinationInput.value, destinationInput);
        if (coords) {
            waypoints.push(L.latLng(coords[0], coords[1]));
            destinationInput.dataset.lat = coords[0];
            destinationInput.dataset.lon = coords[1];
        }
    } else {
        waypoints.push(L.latLng(destinationCoords[0], destinationCoords[1]));
    }

    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Add new markers with custom icons
    if (waypoints.length > 0) {
        L.marker(waypoints[0], { icon: originIcon }).addTo(map);
        for (let i = 1; i < waypoints.length - 1; i++) {
            L.marker(waypoints[i], { icon: stopIcon }).addTo(map);
        }
        if (waypoints.length > 1) {
            L.marker(waypoints[waypoints.length - 1], { icon: destinationIcon }).addTo(map);
        }
    }
}

getRouteButton.addEventListener('click', async () => {
    getRouteButton.disabled = true;
    getRouteButton.textContent = 'Calculando Rota...';
    
    try {
        await updateWaypoints();

        if (waypoints.length < 2) {
            alert('Por favor, insira pelo menos um ponto de origem e um de destino válidos.');
            getRouteButton.disabled = false;
            getRouteButton.textContent = 'Calcular Rota Otimizada';
            return;
        }

        if (routingControl) {
            map.removeControl(routingControl);
        }

        routingControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: true,
            showAlternatives: false,
            lineOptions: {
                styles: [{ color: '#00f0ff', weight: 6, opacity: 0.8 }]
            },
            altLineOptions: {
                styles: [{ color: '#ff00ff', weight: 6, opacity: 0.8 }]
            },
            createMarker: function(i, waypoint, n) {
                // Markers are custom managed, return null to avoid duplicate leaflet markers
                return null;
            }
        }).addTo(map);

        routingControl.on('routesfound', (e) => {
            const routes = e.routes;
            const summary = routes[0].summary;

            totalDistanceSpan.textContent = (summary.totalDistance / 1000).toFixed(2) + ' km';
            const totalSeconds = summary.totalTime;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            totalTimeSpan.textContent = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

            instructionsList.innerHTML = '';
            routes[0].instructions.forEach(instruction => {
                const li = document.createElement('li');
                li.innerHTML = instruction.text;
                instructionsList.appendChild(li);
            });
            
            // Auto fit map bounds to the route
            const bounds = L.latLngBounds(waypoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        });

        routingControl.on('routingerror', (e) => {
            console.error('Erro ao calcular rota:', e);
            alert('Não foi possível calcular a rota. Verifique os endereços e tente novamente.');
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
    } finally {
        getRouteButton.disabled = false;
        getRouteButton.textContent = 'Calcular Rota Otimizada';
    }
});
