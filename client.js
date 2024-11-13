document.addEventListener("DOMContentLoaded", function () {
    const cycledContent = document.getElementById('cycledContent');
    const currentContentHeader = document.getElementById('currentContentHeader');
    const weatherData = document.getElementById('weatherData');
    const lastUpdatedWeather = document.getElementById('lastUpdated');
    var cycleTime = 10000;

    var hasImagesBeenLoaded = false;
    var hasWeatherBeenLoaded = false;

    var lastUpdated;
    var temp;
    var regn;
    var vind;
    var skyer;
    var taake;
    var maksTemp6Timer;
    var minTemp6Timer;
    var maksRegn6Timer;
    var minRegn6Timer;
    var regnSannsynlighet;

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
                clearInterval(imagesIntervalID)
                return;
            });

    }

    const imagesIntervalID = setInterval(loadImages, 3600000);
    loadImages();
    
    

    let isWeatherLoading = false;

    function getWeather(){

        if (isWeatherLoading) return;
        isWeatherLoading = true;

        fetch('http://localhost:3000/get-weather')
            .then(response => response.json())
            .then(data => {

                isWeatherLoading = false;
                
                if (data["Last_updated"] !== undefined){

                    temp = data["Current_temp"];
                    regn = data["Expected_rain"];
                    vind = data["Current_wind"];
                    skyer = data["Current_cloud"];
                    taake = data["Current_fog"];
                    maksTemp6Timer = data["Max_air_temp_6_hours"];
                    minTemp6Timer = data["Min_air_temp_6_hours"];
                    maksRegn6Timer = data["Max_rain_6_hours"];
                    minRegn6Timer = data["Min_rain_6_hours"];
                    regnSannsynlighet = data["Rain_probability_6_hours"];
                    lastUpdated = data["Last_updated"];

                    lastUpdatedWeather.innerHTML = `Sist oppdatert: ${lastUpdated.toLocaleString('en-GB', { hour12: false })}`;

                }
            })
            .catch((e) => {
                console.error(`Error: ${e}`);
                isWeatherLoading = false;
            });

    }
    
    getWeather();
    const weatherIntervalId = setInterval(getWeather, 600000);

    var currentIndex = 0;
    var currentWeatherIndex = 0;

    const elektroBilde = new Image();
    const renoBilde = new Image();
    const byggBilde = new Image();

    // Content cycling logic
    const content = [
        { type: 'Vaktliste Elektro', url: 'http://localhost:3000/images/image1.png', tid: 15 },
        { type: 'Vaktliste Renovasjon', url: 'http://localhost:3000/images/image2.png', tid: 15 },
        { type: 'Vaktliste Bygg', url: 'http://localhost:3000/images/image3.png', tid: 15 },
        { type: 'Telefon Vaktliste Nåværende Måned', url: 'http://localhost:3000/images/image4.png', tid: 10 },
        { type: 'Telefon Vaktliste Neste Måned', url: 'http://localhost:3000/images/image5.png', tid: 10 },
    ];

    function cycleContent() {

        if(!hasImagesBeenLoaded){
            setTimeout(loadImages, 1000);
        }

        const cycledContent = document.getElementById('cycledContent');        
    
        const currentContent = content[currentIndex];

        cycledContent.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 100%;"><img src="${currentContent.url}" alt="Image content" style="max-width: 100%; max-height: 100%;"></div>`;

        currentContentHeader.innerHTML = currentContent.type;

        if (lastUpdated !== undefined){
            if (currentWeatherIndex < 1){

                if (taake > 10){
                    weatherData.innerHTML = `<h4>Vær nå</h4><br>Temperatur: ${temp}°C<br>Nedbør: ${regn}mm<br>Vind: ${vind}m/s<br>Tåke: ${taake}%`;
                } else {
                    weatherData.innerHTML = `<h4>Vær nå</h4><br>Temperatur: ${temp}°C<br>Nedbør: ${regn}mm<br>Vind: ${vind}m/s<br>Skydekke: ${skyer}%`;
                }

                
            } else {

                weatherData.innerHTML = `<h4>Vær neste 6 timer</h4><br>Temperatur: ${minTemp6Timer} - ${maksTemp6Timer}°C<br>Nedbør: ${minRegn6Timer} - ${maksRegn6Timer}mm<br>Sannsynlighet for regn: ${regnSannsynlighet}%`;

            }

        } else {
            weatherData.innerHTML =`<h4>Laster Vær</4>`;
        }
    
        currentIndex = (currentIndex + 1) % content.length;
        currentWeatherIndex = (currentWeatherIndex + 1) % 2;

    }

    setInterval(cycleContent, cycleTime);
    cycleContent();
});
