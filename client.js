document.addEventListener("DOMContentLoaded", function () {
    const cycledContent = document.getElementById('cycledContent');

    var weather_json;
    var hasUpdateImagesBeenRan = false;
    
    //cycledContent.innerHTML = "test";
    
    // Display current date and time
    function updateDateTime() {
        const dateTimeBox = document.getElementById('dateTime');
        const now = new Date();
        dateTimeBox.innerHTML = now.toLocaleString();
    }

    setInterval(updateDateTime, 1000);
    updateDateTime();

    // Content cycling logic
    const content = [
        { type: 'Vaktliste Elektro', url: 'http://localhost:3000/images/image1.png' },
        { type: 'Vaktliste Renovasjon', url: 'http://localhost:3000/images/image2.png' },
        { type: 'Vaktliste Bygg', url: 'http://localhost:3000/images/image3.png' },
        { type: 'Superoffice', url: 'https://service.oslofjord.com/scripts/ticket.fcgi?_sf=0&action=mainMenu' },
        { type: 'System Status', url: 'https://prtg-oslofjord.msappproxy.net/public/mapshow.htm?id=55027&mapid=807498E5-9B2F-4986-959F-8F62EBB7C6E9' }
    ];

    function getWeather(){

        fetch('http://localhost:3000/get-weather')
            .then(response => response.json())
            .then(data => {
                //console.log(`Temperatur: ${data["Average_temp"]} Celsius\nRegn: ${data["Average_rain"]}mm\nVind: ${data["Average_wind"]}m/s\nSkydekke: ${data["Average_cloud"]}%\nVær neste time: ${data["Predicted_weather"]}`)
                if (!(data["Average_temp"] == "NaN" || data["Average_rain"] == "NaN" || data["Average_wind"] == "NaN" || data["Average_cloud"] == "NaN" || data["Predicted_weather"] == "NaN" || data["Last_updated"] == "NaN")){
                    const lastUpdated = new Date(data["Last_updated"]);
                    weatherData.innerHTML = `Temperatur: ${data["Average_temp"]}°C<br>Regn: ${data["Average_rain"]}mm<br>Vind: ${data["Average_wind"]}m/s<br>Skydekke: ${data["Average_cloud"]}%<br>Vær neste time: ${data["Predicted_weather"]}<br>Sist oppdatert: ${lastUpdated.toLocaleString()}`;
                }
            })
            .catch((e) => {
                console.error(`Error: ${e}`);
            });
    }

    setInterval(getWeather, 320000)
    getWeather();

    const cycleTime = 10000;

    let currentIndex = 0;

    function cycleContent() {
        const cycledContent = document.getElementById('cycledContent');
        const contentQueue = document.getElementById('contentQueue');
        const weatherData = document.getElementById('weatherData');
    
        const currentContent = content[currentIndex];
        cycledContent.innerHTML = `<iframe src="${currentContent.url}" width="100%" height="600"></iframe>`;
    
        // Show the full queue of upcoming content
        let queueHTML = '<strong>Upcoming Content:</strong><br>';
        for (let i = 1; i < content.length; i++) {
            const nextIndex = (currentIndex + i) % content.length;
            queueHTML += `${i}. ${content[nextIndex].type}<br>`;
        }
    
        contentQueue.innerHTML = queueHTML;
    
        currentIndex = (currentIndex + 1) % content.length;
    }

    function adjustIframeScale(iframe, original_size ,scaleFactor) {

        var height = original_size[0];
        var width = original_size[1];
        
        // Apply the scale factor to the iframe
        iframe.style.transform = `scale(${scaleFactor})`;
        iframe.style.transformOrigin = '0 0'; // Ensures scaling starts from the top-left corner
    
        // Adjust iframe size based on the scale factor
        iframe.style.width = `${width + (scaleFactor * 100)}%`;
        iframe.style.height = `${height * (scaleFactor + 1)}px`;
    }

    function showcontent(){
        const cycledContent = document.getElementById('cycledContent');
        const contentQueue = document.getElementById('contentQueue');
        const weatherData = document.getElementById('weatherData');

        /*cycledContent.innerHTML = `<iframe src="${currentContent.url}" width="175%" height="1225px"></iframe>`;
        
        switch(currentContent.url){
            case `${content[3].url}`:
                adjustIframeScale(cycledContent, [700, 100], 0.75);
                break;
            
            default:
                adjustIframeScale(cycledContent, [700, 100], 1);
        }

        weatherData.innerHTML = `<iframe src="https://api.met.no/weatherapi/locationforecast/2.0/mini.json?lat=59.22&lon=10.33" width="100%" height="100%"</iframe>`;*/

    }

    //showcontent();

    setInterval(cycleContent, cycleTime);
    cycleContent();
});
