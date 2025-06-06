// Configuration API
const API_TOKEN = 'b0b5a30a35373b8476b6ce2fbc494e0ff98372d2a7ac50b6804bbe58b84d2e32'; 
const API_BASE_URL = 'https://api.meteo-concept.com/api';

// Variables globales pour la gestion de l'état
let currentTheme = 'light';
let weatherData = [];
let citiesHistory = [];

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Initialise l'application au chargement
 */
function initializeApp() {
    setupTheme();
    setupEventListeners();
    setupSlider();
    showComparisonSection();
}

/**
 * Configure le thème de l'application
 */
function setupTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
}

/**
 * Bascule entre les thèmes clair et sombre
 */
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // Animation fluide lors du changement de thème
    document.body.style.transition = 'all 0.3s ease';
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
}

/**
 * Configure tous les écouteurs d'événements
 */
function setupEventListeners() {
    // Formulaire principal
    document.getElementById('weatherForm').addEventListener('submit', handleFormSubmit);
    
    // Slider pour les jours
    document.getElementById('daysSlider').addEventListener('input', updateDaysDisplay);
    
    // Entrée dans le champ ville pour suggestions futures
    document.getElementById('cityInput').addEventListener('input', debounce(handleCityInput, 300));
}

/**
 * Configure le slider de sélection des jours
 */
function setupSlider() {
    const slider = document.getElementById('daysSlider');
    updateDaysDisplay(); // Initialisation de l'affichage
}

/**
 * Met à jour l'affichage du nombre de jours sélectionné
 */
function updateDaysDisplay() {
    const slider = document.getElementById('daysSlider');
    const display = document.getElementById('daysDisplay');
    const days = slider.value;
    display.textContent = `${days} jour${days > 1 ? 's' : ''}`;
}

/**
 * Gère la soumission du formulaire principal
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const city = formData.get('city').trim();
    const days = parseInt(document.getElementById('daysSlider').value);
    const selectedOptions = getSelectedOptions();

    if (!city) {
        showError('Veuillez saisir une ville ou un code postal.');
        return;
    }

    // Validation du token API
    if (API_TOKEN === '') {
        showError('⚠️ Erreur de configuration : Veuillez remplacer le token API par votre token personnel Meteoconcept.');
        return;
    }

    await searchWeather(city, days, selectedOptions);
}

/**
 * Récupère les options sélectionnées par l'utilisateur
 */
function getSelectedOptions() {
    const checkboxes = document.querySelectorAll('input[name="options"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Recherche les données météorologiques
 */
async function searchWeather(city, days, options) {
    showLoading();
    
    try {
        // Étape 1: Recherche de la ville
        const cityData = await searchCity(city);
        
        // Étape 2: Récupération des prévisions
        const forecasts = await getForecasts(cityData.insee, days);
        
        // Étape 3: Affichage des résultats
        displayWeatherResults(cityData, forecasts, options);
        
        // Sauvegarde dans l'historique
        saveCityToHistory(cityData);
        
    } catch (error) {
        console.error('Erreur lors de la recherche météo:', error);
        showError(error.message || 'Une erreur est survenue lors de la recherche.');
    }
}

/**
 * Recherche une ville via l'API
 */
async function searchCity(query) {
    const url = `${API_BASE_URL}/location/cities?token=${API_TOKEN}&search=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Erreur API: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.cities || data.cities.length === 0) {
        throw new Error('Aucune ville trouvée pour cette recherche.');
    }
    
    return data.cities[0]; // Retourne la première ville trouvée
}

/**
 * Récupère les prévisions météorologiques
 */
async function getForecasts(insee, days) {
    const forecasts = [];
    
    for (let i = 0; i < days; i++) {
        const url = `${API_BASE_URL}/forecast/daily/${i}?token=${API_TOKEN}&insee=${insee}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erreur lors de la récupération des prévisions: ${response.status}`);
        }
        
        const data = await response.json();
        forecasts.push(data.forecast);
    }
    
    return forecasts;
}

/**
 * Affiche les résultats météorologiques
 */
function displayWeatherResults(cityData, forecasts, options) {
    weatherData = { city: cityData, forecasts, options };
    
    const resultsContainer = document.getElementById('results');
    
    // DEBUG: Affichez la structure des données de la ville
    console.log('=== DEBUG CITY DATA ===');
    console.log('Structure cityData:', cityData);
    console.log('Champs disponibles pour la ville:');
    Object.keys(cityData).forEach(key => {
        console.log(`- ${key}: ${cityData[key]}`);
    });
    console.log('=====================');
    
    // Correction des champs de ville avec plusieurs alternatives
    const cityName = cityData.name || cityData.nom || cityData.city || cityData.commune || 'Ville inconnue';
    const postalCode = cityData.postal_code || cityData.cp || cityData.code_postal || cityData.postcode || '';
    const departmentName = cityData.department_name || cityData.departement || cityData.dept_name || cityData.department || 'Département inconnu';
    const departmentNumber = cityData.department_number || cityData.dept_number || cityData.dept || cityData.department_code || '';
    
    let html = `
        <div class="city-info fade-in">
            <h2>${cityName}${postalCode ? ` (${postalCode})` : ''}</h2>
            <p>Département: ${departmentName}${departmentNumber ? ` (${departmentNumber})` : ''}</p>
    `;
    
    // Affichage des informations supplémentaires si demandées
    if (options.length > 0) {
        html += '<div class="additional-info">';
        
        if (options.includes('latitude')) {
            const latitude = cityData.latitude || cityData.lat || 0;
            html += `
                <div class="info-item">
                    <strong>Latitude</strong>
                    ${typeof latitude === 'number' ? latitude.toFixed(4) : latitude}°
                </div>
            `;
        }
        
        if (options.includes('longitude')) {
            const longitude = cityData.longitude || cityData.lon || cityData.lng || 0;
            html += `
                <div class="info-item">
                    <strong>Longitude</strong>
                    ${typeof longitude === 'number' ? longitude.toFixed(4) : longitude}°
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    
    // Génération des cartes météo
    html += '<div class="weather-cards">';
    
    forecasts.forEach((forecast, index) => {
        html += generateWeatherCard(forecast, index, options);
    });
    
    html += '</div>';
    
    resultsContainer.innerHTML = html;
    
    // Animation d'apparition
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}


/**
 * Génère une carte météo individuelle
 */


function generateWeatherCard(forecast, dayIndex, options) {
    const date = new Date();
    date.setDate(date.getDate() + dayIndex);
    
    const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    const dateStr = date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long' 
    });
    
    const weatherIcon = getWeatherIcon(forecast.weather);
    const weatherDesc = getWeatherDescription(forecast.weather);
    

    console.log('Structure forecast:', forecast);
    

    const humidity = forecast.humidity || forecast.rh2m || forecast.rh || forecast.humidite || 'N/D';
    
    let detailsHtml = `
        <div class="detail-item">
            <span class="detail-label">Min / Max:</span>
            <span class="detail-value">${forecast.tmin}° / ${forecast.tmax}°</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Humidité:</span>
            <span class="detail-value">${humidity}${humidity !== 'N/D' ? '%' : ''}</span>
        </div>
    `;
    
    // Ajout des détails supplémentaires selon les options sélectionnées
    if (options.includes('rain')) {
        const rain = forecast.rr10 || forecast.rr1 || forecast.rain || 0;
        detailsHtml += `
            <div class="detail-item">
                <span class="detail-label">Pluie:</span>
                <span class="detail-value">${rain} mm</span>
            </div>
        `;
    }
    
    if (options.includes('wind')) {
        const wind = forecast.wind10m || forecast.wind || forecast.windspeed || 0;
        detailsHtml += `
            <div class="detail-item">
                <span class="detail-label">Vent:</span>
                <span class="detail-value">${wind} km/h</span>
            </div>
        `;
    }
    
    if (options.includes('windDirection')) {
        const windDir = getWindDirection(forecast.dirwind10m || forecast.winddir);
        const windDegrees = forecast.dirwind10m || forecast.winddir || 0;
        detailsHtml += `
            <div class="detail-item">
                <span class="detail-label">Direction:</span>
                <span class="detail-value">${windDir} (${windDegrees}°)</span>
            </div>
        `;
    }
    
    return `
        <div class="weather-card fade-in" style="animation-delay: ${dayIndex * 0.1}s">
            <div class="card-header">
                <div class="card-date">
                    <div style="font-size: 1.1em; text-transform: capitalize;">${dayName}</div>
                    <div style="font-size: 0.9em; color: #666;">${dateStr}</div>
                </div>
                <div class="weather-icon">${weatherIcon}</div>
            </div>
            
            <div class="temperature">
                ${Math.round((forecast.tmin + forecast.tmax) / 2)}°
            </div>
            
            <div class="weather-description">
                ${weatherDesc}
            </div>
            
            <div class="weather-details">
                ${detailsHtml}
            </div>
        </div>
    `;
}


/**
 * Retourne l'icône météo appropriée
 */
function getWeatherIcon(weatherCode) {
    const icons = {
        0: '☀️',   // Soleil
        1: '🌤️',  // Peu nuageux
        2: '⛅',   // Ciel voilé
        3: '☁️',   // Nuageux
        4: '☁️',   // Très nuageux
        5: '🌦️',  // Couvert
        6: '🌧️',  // Brouillard
        7: '🌫️',  // Brouillard givrant
        10: '🌦️', // Pluie faible
        11: '🌧️', // Pluie modérée
        12: '🌧️', // Pluie forte
        13: '🌦️', // Pluie faible verglaçante
        14: '🌧️', // Pluie modérée verglaçante
        15: '🌧️', // Pluie forte verglaçante
        16: '❄️',  // Neige faible
        17: '🌨️',  // Neige modérée
        18: '🌨️',  // Neige forte
        20: '🌦️', // Averses de pluie faible
        21: '🌧️', // Averses de pluie modérée
        22: '⛈️',  // Averses de pluie forte
        30: '🌨️', // Averses de neige faible
        31: '🌨️', // Averses de neige modérée
        32: '🌨️', // Averses de neige forte
        40: '⛈️',  // Orage
        41: '⛈️',  // Orage faible
        42: '⛈️',  // Orage modéré
        43: '⛈️',  // Orage fort
        44: '⛈️',  // Orage très fort
        45: '⛈️',  // Orage exceptionnel
    };
    
    return icons[weatherCode] || '🌤️';
}

/**
 * Retourne la description météo
 */
function getWeatherDescription(weatherCode) {
    const descriptions = {
        0: 'Ensoleillé',
        1: 'Peu nuageux',
        2: 'Ciel voilé',
        3: 'Nuageux',
        4: 'Très nuageux',
        5: 'Couvert',
        6: 'Brouillard',
        7: 'Brouillard givrant',
        10: 'Pluie faible',
        11: 'Pluie modérée',
        12: 'Pluie forte',
        13: 'Pluie faible verglaçante',
        14: 'Pluie modérée verglaçante',
        15: 'Pluie forte verglaçante',
        16: 'Neige faible',
        17: 'Neige modérée',
        18: 'Neige forte',
        20: 'Averses de pluie faible',
        21: 'Averses de pluie modérée',
        22: 'Averses de pluie forte',
        30: 'Averses de neige faible',
        31: 'Averses de neige modérée',
        32: 'Averses de neige forte',
        40: 'Orage',
        41: 'Orage faible',
        42: 'Orage modéré',
        43: 'Orage fort',
        44: 'Orage très fort',
        45: 'Orage exceptionnel'
    };
    
    return descriptions[weatherCode] || 'Conditions météo inconnues';
}

/**
 * Convertit la direction du vent en texte
 */
function getWindDirection(degrees) {
    if (degrees === null || degrees === undefined) return 'N/D';
    
    const directions = [
        'Nord', 'Nord-Nord-Est', 'Nord-Est', 'Est-Nord-Est',
        'Est', 'Est-Sud-Est', 'Sud-Est', 'Sud-Sud-Est',
        'Sud', 'Sud-Sud-Ouest', 'Sud-Ouest', 'Ouest-Sud-Ouest',
        'Ouest', 'Ouest-Nord-Ouest', 'Nord-Ouest', 'Nord-Nord-Ouest'
    ];
    
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

/**
 * Affiche un message de chargement
 */
function showLoading() {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Recherche des données météorologiques en cours...</p>
        </div>
    `;
}

/**
 * Affiche un message d'erreur
 */
function showError(message) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = `
        <div class="error-message">
            <strong>❌ Erreur :</strong> ${message}
        </div>
    `;
}

/**
 * Sauvegarde une ville dans l'historique
 */
function saveCityToHistory(cityData) {
    // Éviter les doublons
    const exists = citiesHistory.find(city => city.insee === cityData.insee);
    if (!exists) {
        citiesHistory.unshift(cityData);
        // Limiter l'historique à 10 villes
        if (citiesHistory.length > 10) {
            citiesHistory.pop();
        }
    }
}

/**
 * Gère la saisie dans le champ ville (pour futures fonctionnalités)
 */
function handleCityInput(event) {
    const query = event.target.value.trim();
    // Cette fonction pourrait être étendue pour l'autocomplétion
    console.log('Recherche suggestion pour:', query);
}

/**
 * Fonction de debounce pour limiter les appels API
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Affiche la section de comparaison
 */
function showComparisonSection() {
    const section = document.getElementById('comparisonSection');
    if (section) {
        section.style.display = 'block';
    }
}

/**
 * Compare deux villes (fonction pour le bouton de comparaison)
 */
async function compareCities() {
    const city1Input = document.getElementById('city1Input');
    const city2Input = document.getElementById('city2Input');
    const resultsContainer = document.getElementById('comparisonResults');
    
    const city1 = city1Input.value.trim();
    const city2 = city2Input.value.trim();
    
    if (!city1 || !city2) {
        resultsContainer.innerHTML = `
            <div class="error-message">
                Veuillez saisir les noms des deux villes à comparer.
            </div>
        `;
        return;
    }
    
    if (API_TOKEN === 'TON_TOKEN_ICI') {
        resultsContainer.innerHTML = `
            <div class="error-message">
                ⚠️ Veuillez configurer votre token API pour utiliser cette fonctionnalité.
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Comparaison des villes en cours...</p>
        </div>
    `;
    
    try {
        // Recherche des deux villes
        const [cityData1, cityData2] = await Promise.all([
            searchCity(city1),
            searchCity(city2)
        ]);
        
        // Récupération des prévisions pour 3 jours
        const [forecasts1, forecasts2] = await Promise.all([
            getForecasts(cityData1.insee, 3),
            getForecasts(cityData2.insee, 3)
        ]);
        
        // Affichage de la comparaison
        displayComparison(cityData1, forecasts1, cityData2, forecasts2);
        
    } catch (error) {
        console.error('Erreur lors de la comparaison:', error);
        resultsContainer.innerHTML = `
            <div class="error-message">
                <strong>❌ Erreur :</strong> ${error.message}
            </div>
        `;
    }
}

/**
 * Affiche les résultats de comparaison
 */
function displayComparison(city1Data, forecasts1, city2Data, forecasts2) {
    const resultsContainer = document.getElementById('comparisonResults');
    
    const avgTemp1 = forecasts1.reduce((sum, f) => sum + (f.tmin + f.tmax) / 2, 0) / forecasts1.length;
    const avgTemp2 = forecasts2.reduce((sum, f) => sum + (f.tmin + f.tmax) / 2, 0) / forecasts2.length;
    
    // Correction pour l'humidité
    const humidity1 = forecasts1[0].humidity || forecasts1[0].rh2m || forecasts1[0].rh || 'N/D';
    const humidity2 = forecasts2[0].humidity || forecasts2[0].rh2m || forecasts2[0].rh || 'N/D';
    
    resultsContainer.innerHTML = `
        <div class="comparison-card fade-in">
            <h3>${city1Data.name}</h3>
            <div class="comparison-temp">${Math.round(avgTemp1)}°</div>
            <div class="comparison-details">
                <div>Aujourd'hui: ${forecasts1[0].tmin}° / ${forecasts1[0].tmax}°</div>
                <div>Humidité: ${humidity1}${humidity1 !== 'N/D' ? '%' : ''}</div>
                <div>${getWeatherDescription(forecasts1[0].weather)}</div>
            </div>
        </div>
        
        <div class="comparison-vs">VS</div>
        
        <div class="comparison-card fade-in" style="animation-delay: 0.2s">
            <h3>${city2Data.name}</h3>
            <div class="comparison-temp">${Math.round(avgTemp2)}°</div>
            <div class="comparison-details">
                <div>Aujourd'hui: ${forecasts2[0].tmin}° / ${forecasts2[0].tmax}°</div>
                <div>Humidité: ${humidity2}${humidity2 !== 'N/D' ? '%' : ''}</div>
                <div>${getWeatherDescription(forecasts2[0].weather)}</div>
            </div>
        </div>
    `;
}