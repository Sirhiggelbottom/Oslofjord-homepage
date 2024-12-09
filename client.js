document.addEventListener("DOMContentLoaded", function () {
    try{
        const cycledContentContainer = document.getElementById('cycledContentContainer');
        const currentContentHeader = document.getElementById('currentContentHeader');
        const dateTime = document.getElementById('dateTimeDisplay');
        const weatherData = document.getElementById('weatherData');
        const lastUpdatedWeather = document.getElementById('lastUpdated');
        const lastUpdatedImages = document.getElementById('lastUpdate');
        const dropdown = document.getElementById('dropdownmenu');
        var webSocket;
        var hostName;
        var contentTimeout;

        const url = `${window.location.protocol}//${window.location.hostname}:3000/get-connection`;

        fetch(url)
            .then(response => response.text())
            .then(data => {
                hostName = data;
                connectSocket();
            });

        const imageElements = [
            document.getElementById('image1'),
            document.getElementById('image2'),
            document.getElementById('image3'),
            document.getElementById('image4'),
            document.getElementById('image5')
        ];

        imageElements.forEach(img => {
            cycledContentContainer.appendChild(img);
        });

        /**
         * Used to chain messages to the server.
         * @param {webSocket} socket - WebSocket used to send message.
         * @param {Object} message - Object containing message type and the message itself.
         * @param {number} timeout - Timeout before trying to resend message in ms.
         * @param {callback} callback - Callback.
         * @returns {void}
         */
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

        /**
         * Sends messages to the server.
         * @param {webSocket} socket - WebSocket used to send message.
         * @param {Object} message - Object containing message type and the message itself.
         * @param {number} timeout - Timeout before trying to resend message in ms.
         * @param {number} limit - Amount of attempts.
         * @returns {void}
         * @throws Prints the error to the console.
         */
        function sendMessage(socket, message, timeout, limit){
            
            try{

                let attempts = 0;
            
                function attemptSend() {
                    if (attempts >= limit) {
                        console.error('Message attempts limit reached');
                        return;
                    }
                    
                    if (socket.bufferedAmount === 0) {
                        socket.send(JSON.stringify(message));
                    } else {
                        attempts++;
                        setTimeout(attemptSend, timeout);
                    }
                }
                
                attemptSend();

            } catch (error){
                console.error(`Error: ${error}`);
            }
            
        }

        var lastUpdated, temp, regn, vind, skyer, taake, maksTemp6Timer, minTemp6Timer, maksRegn6Timer, minRegn6Timer, regnSannsynlighet;

        /**
         * Connects the client to the server via a WebSocket.
         * Also handles messages.
         */
        function connectSocket(){

            console.log(`Trying to connect to websocket at: ${hostName}`);
            
            if (hostName == undefined){
                setTimeout(() => {
                    connectSocket();
                }, 2000);

                return;
            }

            const socket = new WebSocket(hostName);
            webSocket = socket;
            
            socket.addEventListener('open', (event) => {
                console.log("Connected");
                sendMessage(socket, {type: "connection"}, 200, 5);
            });

            socket.addEventListener('message', (event) => {
            
                const response = JSON.parse(event.data);
                var imageUpdateTime;
    
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
                            if(imageElements[index]){
                                imageElements[index].src = `${url}?timestamp=${new Date().getTime()}`;
                                console.log(`Bilde url: ${imageElements[index].src}`);
                            } else {
                                packet = {type: "error", message: "Array size mismatch!"};
                                sendMessage(socket, packet, 500, 5);
                            }
                        });
    
                        if(response.date != undefined){
                            imageUpdateTime = new Date(new Date(response.date).getTime() + (60 + new Date(response.date).getTimezoneOffset()) * 60 * 1000).toLocaleString('en-GB', {hour12: false}); 
                            /*let responseDate = new Date(response.date);
                            let timezoneOffset = responseDate.getTimezoneOffset();
                            let adjustedTime = new Date(responseDate.getTime() + (+60 + timezoneOffset) * 60 * 1000).toLocaleString('en-GB', {hour12: false});*/
    
                            lastUpdatedImages.innerHTML = `Sist oppdatert: ${imageUpdateTime}`;
                        }
                        
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

            socket.addEventListener('close', (event) => {
                console.log("Disconnected, trying to reconnect again");
                setTimeout(connectSocket, 5000);
            });
    
            socket.addEventListener('error', (error) => {
                console.error(`Error: ${error}`);
            });

        }
        

        // Display current date and time
        function updateDateTime() {
            const now = new Date();

            // Date and Time parts
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-based
            const year = now.getFullYear();

            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            // Combined Date and Time String
            const dateTimeString = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

            dateTime.textContent = dateTimeString;
            
            /*const dateTimeBox = document.getElementById('dateTime');
            const now = new Date();
            dateTimeBox.innerHTML = `<h2>${now.toLocaleString('en-GB', { hour12: false })}</h2>`;*/
        }

        setInterval(() => {
            requestAnimationFrame(updateDateTime);
        }, 1000);
        updateDateTime();
        
        var currentIndex = 0;
        var currentWeatherIndex = 0;

        // Content cycling logic
        const content = [
            { type: 'Vaktliste Elektro', bilde: imageElements[0], tid: 15 },
            { type: 'Vaktliste Renovasjon', bilde: imageElements[1], tid: 15 },
            { type: 'Vaktliste Bygg', bilde: imageElements[2], tid: 15 },
            { type: 'Telefon Vaktliste 1', bilde: imageElements[3], tid: 10 },
            { type: 'Telefon Vaktliste 2', bilde: imageElements[4], tid: 10 },
        ];

        dropdown.addEventListener('change', () => {
            const selectedValue = dropdown.value;
            const selectedText = dropdown.options[dropdown.selectedIndex].text;
            
            if (selectedValue == "option1"){

                content.forEach(obj => {
                    obj.bilde.style.display = 'none';
                });

                currentIndex = 0;
                requestAnimationFrame(cycleContent);

                return;
            }

            try{

                if(contentTimeout){
                    clearTimeout(contentTimeout);
                    content.forEach(obj => {
                        obj.bilde.style.display = 'none';
                    });
                }

                const selectedContent = content.find(item => item.type == selectedText);

                if (selectedContent){

                    selectedContent.bilde.style.display = 'block';
                    currentContentHeader.innerHTML = selectedContent.type;

                }


            } catch (error){
                console.error(`Error: ${error}`);
            }
            
        }); 

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

            contentTimeout = setTimeout(() => {
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

                    weatherData.innerHTML = `<h4>Vær neste 6 timer</h4><br>Temperatur: ${minTemp6Timer} - ${maksTemp6Timer}°C<br>Nedbør: ${minRegn6Timer} - ${maksRegn6Timer}mm<br>Sannsynlighet for nedbør: ${regnSannsynlighet}%`;

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

        if(webSocket){
            sendMessage(webSocket, {type: "error", message: `Client: ${error}`});
        }
    }
    
});
