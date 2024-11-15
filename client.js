document.addEventListener("DOMContentLoaded", function () {
    try{
        const cycledContentContainer = document.getElementById('cycledContentContainer');
        const currentContentHeader = document.getElementById('currentContentHeader');
        const weatherData = document.getElementById('weatherData');
        const lastUpdatedWeather = document.getElementById('lastUpdated');

        const imageElements = [
            document.getElementById('image1'),
            document.getElementById('image2'),
            document.getElementById('image3'),
            document.getElementById('image4'),
            document.getElementById('image5')
        ];

        imageElements.forEach(img => {
            cycledContentContainer.appendChild(img);
        })

        const socket = new WebSocket('ws://localhost:3001');

        function sendMessageWithCallback(socket, message, timeout, callback){
            if(socket.bufferedAmount === 0){
                socket.send(JSON.stringify(message));

                if(callback) callback();
            } else {
                setTimeout(() => {
                    sendMessageWithCallback(socket, message, timeout, callback);
                }, timeout);
            }
        }

        function sendMessage(socket, message, timeout){
            if(socket.bufferedAmount === 0){
                socket.send(JSON.stringify(message));
            } else {
                setTimeout(() => {
                    sendMessage(socket, message, timeout);
                }, timeout);
            }
            
        }

        socket.addEventListener('open', (event) => {
            console.log("Connected");
            sendMessage(socket, {type: "connection"}, 200);
        });

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
        
        socket.addEventListener('message', (event) => {
            
            
            const response = JSON.parse(event.data);

            var packet;

            switch(response.type){
                case "downloaded":
                    packet = {type: "load", message: "images"};
                    
                    sendMessageWithCallback(socket, packet, 200, () => {
                        packet = {type: "load", message: "weather"};
                        sendMessageWithCallback(socket, packet, 200);
                    });
                    
                    break;
                
                case "initial_images":
                case "images":

                    response.data.forEach((url, index) => {
                        imageElements[index].src = `${url}?timestamp=${new Date().getTime()}`;
                    });
                    
                    break;
                
                case "initial_weather":
                case "weather":

                    temp = response.data.Current_temp;
                    regn = response.data.Expected_rain;
                    vind = response.data.Current_wind;
                    skyer = response.data.Current_cloud;
                    taake = response.data.Current_fog;
                    maksTemp6Timer = response.data.Max_air_temp_6_hours;
                    minTemp6Timer = response.data.Min_air_temp_6_hours;
                    maksRegn6Timer = response.data.Max_rain_6_hours;
                    minRegn6Timer = response.data.Min_rain_6_hours;
                    regnSannsynlighet = response.data.Rain_probability_6_hours;
                    lastUpdated = response.data.Last_updated;

                    lastUpdatedWeather.innerHTML = `Sist oppdatert: ${lastUpdated.toLocaleString('en-GB', { hour12: false })}`;
                    break;
                
            }

        });

        socket.addEventListener('error', (error) => {
            console.error(`Error: ${error}`);
        })
        
        socket.addEventListener('close', (event) => {
            console.log("Disconnected");
        })
        
        var currentIndex = 0;
        var currentWeatherIndex = 0;

        // Content cycling logic
        const content = [
            { type: 'Vaktliste Elektro', bilde: imageElements[0], tid: 15 },
            { type: 'Vaktliste Renovasjon', bilde: imageElements[1], tid: 15 },
            { type: 'Vaktliste Bygg', bilde: imageElements[2], tid: 15 },
            { type: 'Telefon Vaktliste Nåværende Måned', bilde: imageElements[3], tid: 10 },
            { type: 'Telefon Vaktliste Neste Måned', bilde: imageElements[4], tid: 10 },
        ];

        function cycleContent() {

            const currentContent = content[currentIndex];            

            if (currentIndex > 0){
                content[currentIndex - 1].bilde.style.display = 'none';
            } else {
                content[content.length - 1].bilde.style.display = 'none';
            }

            currentContent.bilde.style.display = 'block';

            currentContentHeader.innerHTML = currentContent.type;
        
            currentIndex = (currentIndex + 1) % content.length;

            setTimeout(() => {
                requestAnimationFrame(cycleContent);

            }, currentContent["tid"] * 1000);

        }

        function cycleWeather(){


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

                setTimeout(() => {
                    requestAnimationFrame(cycleWeather);
                }, 7000);

            } else {
                weatherData.innerHTML =`<h4>Laster Vær</4>`;
                setTimeout(cycleWeather, 500);
            }

            currentWeatherIndex = (currentWeatherIndex + 1) % 2;
        
        }

        cycleContent();
        cycleWeather();

    } catch (error){
        console.error(`Error: ${error}`);
    }
    
});
