document.addEventListener("DOMContentLoaded", function () {
    const cycledContent = document.getElementById('cycledContent');
    const currentContentHeader = document.getElementById('currentContentHeader');
    const weatherData = document.getElementById('weatherData');
    const lastUpdatedWeather = document.getElementById('lastUpdated');
    var cycleTime = 10000;

    var hasImagesBeenLoaded = false;

    // Display current date and time
    function updateDateTime() {
        const dateTimeBox = document.getElementById('dateTime');
        const now = new Date();
        dateTimeBox.innerHTML = `<h2>${now.toLocaleString('en-GB', { hour12: false })}</h2>`;
    }

    setInterval(updateDateTime, 1000);
    updateDateTime();

    function loadImages(){

        fetch('http://localhost:3000/list-images')
            .then(response => response.text())
            .then(data => {
                if (data.includes("Ok")){
                    elektroBilde.src = 'http://localhost:3000/images/image1.png';
                    renoBilde.src = 'http://localhost:3000/images/image2.png';
                    byggBilde.src = 'http://localhost:3000/images/image3.png';
                    hasImagesBeenLoaded = true;
                } else {
                    console.log(data);
                }
            })
            .catch((e) => {
                hasImagesBeenLoaded = false;
                console.log(`Images not loaded: ${e}`);
            });

    }

    

    setTimeout(loadImages, 30000);
    
    const elektroBilde = new Image();
    const renoBilde = new Image();
    const byggBilde = new Image();
    
    //{ type: 'Superoffice', url: 'https://service.oslofjord.com/scripts/ticket.fcgi?_sf=0&action=mainMenu', tid: 5 },
    //{ type: 'System Status', url: 'https://prtg-oslofjord.msappproxy.net/public/mapshow.htm?id=55027&mapid=807498E5-9B2F-4986-959F-8F62EBB7C6E9', tid: 5 },

    // Content cycling logic
    const content = [
        { type: 'Vaktliste Elektro', url: 'http://localhost:3000/images/image1.png', tid: 15 },
        { type: 'Vaktliste Renovasjon', url: 'http://localhost:3000/images/image2.png', tid: 15 },
        { type: 'Vaktliste Bygg', url: 'http://localhost:3000/images/image3.png', tid: 15 },
        { type: 'Telefon Vaktliste Nåværende Måned', url: 'http://localhost:3000/images/image4.png', tid: 10 },
        { type: 'Telefon Vaktliste Neste Måned', url: 'http://localhost:3000/images/image5.png', tid: 10 },
    ];

    var lastUpdated;

    function getWeather(){

        fetch('http://localhost:3000/get-weather')
            .then(response => response.json())
            .then(data => {
                //console.log(`Temperatur: ${data["Average_temp"]} Celsius\nRegn: ${data["Average_rain"]}mm\nVind: ${data["Average_wind"]}m/s\nSkydekke: ${data["Average_cloud"]}%\nVær neste time: ${data["Predicted_weather"]}`)
                if (!(data["Average_temp"] == "NaN" || data["Average_rain"] == "NaN" || data["Average_wind"] == "NaN" || data["Average_cloud"] == "NaN" || data["Predicted_weather"] == "NaN" || data["Last_updated"] == "NaN")){
                    lastUpdated = new Date();
                    weatherData.innerHTML = `Temperatur: ${data["Average_temp"]}°C<br>Regn: ${data["Average_rain"]}mm<br>Vind: ${data["Average_wind"]}m/s<br>Skydekke: ${data["Average_cloud"]}%`;
                    lastUpdatedWeather.innerHTML = `Sist oppdatert: ${lastUpdated.toLocaleString('en-GB', { hour12: false })}`;
                } else {
                    weatherData.innerHTML = `Laster vær`;
                }
            })
            .catch((e) => {
                console.error(`Error: ${e}`);
            });
    }

    setInterval(getWeather, 320000)
    getWeather();

    let currentIndex = 0;

    function cycleContent() {

        if(!hasImagesBeenLoaded){
            setTimeout(loadImages, 5000);
        }

        const cycledContent = document.getElementById('cycledContent');
        const contentQueue = document.getElementById('contentQueue');
        
    
        const currentContent = content[currentIndex];

        if (currentContent.type == "System Status"){
            cycledContent.innerHTML = `<iframe src="${currentContent.url}" style="width: 100%; height: 500px;"></iframe>`;
        } else {
            cycledContent.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 100%;"><img src="${currentContent.url}" alt="Image content" style="max-width: 100%; max-height: 100%;"></div>`;
            currentContentHeader.innerHTML = currentContent.type;
        }
    
        currentIndex = (currentIndex + 1) % content.length;

    }

    

    setInterval(cycleContent, cycleTime);
    cycleContent();
});
