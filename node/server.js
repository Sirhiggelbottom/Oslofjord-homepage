// server.js
require('dotenv').config({path: './auth.env'}); // Load environment variables
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const port = 3000;
const app = express();
const WebSocket = require('ws');
const http = require('http');
const { send } = require('process');
const { Socket } = require('dgram');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let clients = [];

app.use(cors());
app.use(express.json());

const baseURL = "http://localhost:3000";

var imgUrls = [
    '',
    '',
    '',
    '',
    ''
];

const ensureDirectoryExists = (dir)  => {
    if(!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
}
const ensureFileExists = (filePath) => {
    if(!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, "");
    }
}

// Load environment variables
const redirectURI = process.env.REDIRECT_URI, clientID = process.env.CLIENT_ID, clientSecret = process.env.CLIENT_SECRET;

const elektroBilder  = {}, renoBilder = {}, byggBilder = {}, telefonvaktBilder1 = {}, telefonvaktBilder2 = {};

// Create an OAuth2 client
var oAuth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectURI);

const logDir = path.join(__dirname, 'logs');
ensureDirectoryExists(logDir);

const logFile = path.join(logDir, 'server.log');
ensureFileExists(logFile);

const errorFile = path.join(logDir, 'error.log');
ensureFileExists(errorFile);

const weatherDir = path.join(__dirname, 'weather');
ensureDirectoryExists(weatherDir);

const weatherPath = path.join(weatherDir, `WeatherData.json`);
ensureFileExists(weatherPath);

var weatherData = {
    Current_temp : Number,
    Current_wind : Number,
    Expected_rain : Number,
    Current_cloud : Number,
    Current_fog : Number,
    Max_air_temp_6_hours : Number,
    Min_air_temp_6_hours : Number,
    Max_rain_6_hours : Number,
    Min_rain_6_hours : Number,
    Rain_probability_6_hours : Number,
    Last_updated : "",
};

/**
 * Sends updates to all connected WebSocket clients.
 * @function sendUpdate
 * @param {Object} data - The data to send to the clients.
 * @throws Will log an error if there is an issue sending the update.
 */
function sendUpdate(data){
    clients.forEach(client => {
        if(client.readyState === WebSocket.OPEN){
            client.send(JSON.stringify(data));
        }
    });
}

function removeOldLogs(filePath){
    // datevalue e.g: 12/11/2024, 17:50:14
    try{

        const fileName = path.basename(filePath);
        const currentDate = new Date();

        fs.readFileSync(logFile, 'utf8', (error, data) => {
            if (error){
                logError(`Error reading ${fileName}: ${error}`);
                return;
            }
    
            const logPattern = /\b\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/g
            // Split the log into individual lines
            const logLines = data.split('\n');

            // Filter out lines with dates older than the given threshold
            const updatedLogLines = logLines.filter(line => {
                const match = line.match(logPattern);
                if (!match) return true; // If no date found, keep the line

                const dateStr = match[0];
                const [day, month, year] = dateStr.split("/");
                const logDate = new Date(`${month}/${day}/${year}`);
                const timeDiff = currentDate - logDate;

                const differenceInDays = timeDiff / (24 * 60 * 60 * 1000);

                // Keep only the logs that are not older than 30 days
                return differenceInDays <= 30;
            });

            // Join the filtered log lines back into a string
            const updatedData = updatedLogLines.join('\n');

            // Write the updated content back to the file
            try {
                fs.writeFileSync(filePath, updatedData, 'utf8');
                console.log(`Old logs removed successfully from ${fileName}`);
            } catch (error) {
                console.error(`Error writing to ${fileName}: ${error}`);
            }
    
        });

    } catch (error){
        logError(`Error removing old logs from: ${fileName}: ${error}`);
        return;
    }
    
}

function debug(debugging, message){
    if (debugging){
        console.log(`\n\n${message}\n\n`);
    }
}

function writeToLog(message){

    // Create the log message with timestamp
    const timestamp = new Date().toLocaleString('en-GB', { hour12: false });
    const logMessage = `[${timestamp}] Event: ${message}\n`;
    
    // Append the error message to the log file
    fs.appendFile(logFile, logMessage, (err) => {
        if (err) {
        console.error('Failed to write to the log file:', err);
        }
    });
}

function logError(message){

    // Create the log message with timestamp
    const timestamp = new Date().toLocaleString('en-GB', { hour12: false });
    const logMessage = `[${timestamp}] ERROR: ${message}\n`;

    // Append the error message to the log file
    fs.appendFile(errorFile, logMessage, (err) => {
        if (err) {
        console.error('Failed to write to the log file:', err);
        }
    });
}



/**
 * Retrieves the file ID of the newest image from the provided object.
 *
 * @param {Object} obj - An object containing image data, where each value is an image object.
 * @param {string} obj[].file_name - The name of the image file.
 * @param {number} obj[].file_date - The date of the image file, used for sorting.
 * @param {string} obj[].file_id - The ID of the image file.
 * @returns {string|null} The file ID of the newest image, or null if an error occurs.
 */
function getNewestImage(obj){    
    const images = Object.values(obj);
    try{
        images.sort((a, b) => b.file_date - a.file_date);
        debug(false, `Nyeste bilde: ${images[0]["file_name"]}`);
        return images[0]["file_id"];
    } catch (error){
        logError(`Error sorting newest image: ${error}`);
        return null;
    }
    
}

/**
 * Retrieves the web content links for a file from Google Drive.
 *
 * @param {string} fileId - The ID of the file to retrieve links for.
 * @returns {Promise<{fileId: string, webContentLink: string}>} An object containing the file ID and web content link.
 * @throws Will log an error message if the request fails.
 */
async function getImgLink(fileId){
    try {
        const drive = google.drive({ version: 'v3', auth: oAuth2Client });

        const res = await drive.files.get({
            fileId : fileId,
            fields: 'webContentLink',
        });

        return {
            fileId: fileId,
            webContentLink: res.data.webContentLink,
        };
    } catch (error){
        logError("Error getting Imagelinks: " + error)
        console.error('Error getting Imagelinks:', error);
    }

}

/**
 * Downloads an image from the specified URL and saves it to the given image path.
 *
 * @param {string} url - The URL of the image to download.
 * @param {string} imagePath - The local file path where the image will be saved.
 * @returns {Promise<void>} A promise that resolves when the image has been successfully downloaded and saved.
 * @throws Will log an error message if the download fails.
 */
const downloadImage = async (url, imagePath) => {
    try{
        const writer = fs.createWriteStream(imagePath);
        const res = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        res.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error){
        logError("Error downloading image:" + error)
        console.error('Error downloading image:', error);
    }
    
};

/**
 * Downloads weather data from the specified URL and saves it to the given path.
 * @async
 * @function downloadWeatherData
 * @param {string} weatherPath - The local file path where the weather data will be saved.
 * @returns {Promise<string>} A promise that resolves to "Ok" when the weather data has been successfully downloaded and saved.
 * @throws Will log an error if the download fails.
 */
async function downloadWeatherData(weatherPath){

    var options = {
            hostname: 'api.met.no',
            path: '/weatherapi/locationforecast/2.0/complete.json?lat=59.2297&lon=10.3624',
            method: 'GET',
            headers: {
                'User-Agent' : 'WeatherData/1.0 (driftoslofjordhotell@gmail.com)',
            }
        };

    const req = https.request(options, (res) => {
        let data = '';
    
        var expires = res.headers['expires'];
        var lastModifed = res.headers['last-modified'];
        //console.log(`Expires header: ${expires}\nLast modified: ${lastModifed}`);
    
        res.on('data', (chunk) => {
            data += chunk;
        });
    
        res.on('end', () => {
            fs.writeFileSync(weatherPath, data, 'utf8');
        });

        if (res.statusCode === 429) {
            console.error('Rate limit exceeded. Please try again later.');
            req.end();
            return null;
        }
    
    });

    req.on('error', (error) => {
        logError("Error, couldn't process request: " + error)
        console.error(`Error, couldn't process request.\nReason: ${error}`);
        return null;
    });

    req.end();
    writeToLog("Weather downloaded");
    return "Ok";
}
/**
 * Reads and parses the weather data file.
 * @function getWeatherFile
 * @param {string} weatherPath - The local file path of the weather data file.
 * @returns {Object|null} The parsed weather data, or null if an error occurs.
 * @throws Will log an error if there is an issue reading the weather file.
 */
function getWeatherFile(weatherPath){
    try{
        const weatherFile = fs.readFileSync(weatherPath);

        return JSON.parse(weatherFile);

    } catch(error){
        logError(`Error loading weatherFile, reason: ${error}`);
        return null;
    }
}
/**
 * Retrieves the last updated timestamp from the weather data.
 * @function getLastUpdated
 * @param {Object} weatherJSON - The parsed weather data.
 * @returns {string|null} The last updated timestamp, or null if an error occurs.
 * @throws Will log an error if there is an issue retrieving the last updated timestamp.
 */
function getLastUpdated(weatherJSON){
    var lastUpdated;
    
    try{
        let isoDate = weatherJSON["properties"]["meta"]["updated_at"];
        
        if (isoDate == undefined){
            throw new Error("Couldn't find a date in the weatherFile!");
        }

        let date = new Date(isoDate);
        lastUpdated = date.toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        
    } catch (error){
        lastUpdated = new Date().toLocaleString('en-GB', { hour12: false , timeZone: 'Europe/London'});
        logError(`Error getting lastUpdated from weatherFile: ${error}`);
    } finally {
        return lastUpdated;
    }

}
/**
 * Reads and processes the weather data from the specified path.
 * @async
 * @function readWeatherData
 * @param {string} weatherPath - The local file path of the weather data file.
 * @returns {Promise<Object>} A promise that resolves to the processed weather data.
 * @throws Will log an error if there is an issue reading or processing the weather data.
 */
async function readWeatherData(weatherPath) {

    const weatherJSON = await getWeatherFile(weatherPath);
    
    if (weatherJSON == null){
        writeToLog("WeatherData is empty");
        return;
    }

    const coordinates = weatherJSON["geometry"]["coordinates"];
    const weatherValues = weatherJSON["properties"]["timeseries"];
    const lastUpdated = getLastUpdated(weatherJSON);

    /**
     * 
     * @param {string} timeFrame - The choosen timeframe i.e instant, next hour, etc.
     * @param {string} type - The type of weather to retrive.
     * @returns {string|number|undefined} - The choosen value or undefined if data doesn't exist.
     * @throws Will log an error if it can't find a value for the choosen data.
     */
    function getNewestWeatherData(timeFrame, type){
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentDay = currentDate.getDate();
        const currentHour = currentDate.getHours();

        var timeseriesDate, timeseriesMonth, timeseriesDay, timeseriesHour;
        
        const values = weatherValues
            .map(weather => {
                try{
                    timeseriesDate = new Date(weather["time"]);
                    timeseriesMonth = timeseriesDate.getMonth();
                    timeseriesDay = timeseriesDate.getDate();
                    timeseriesHour = timeseriesDate.getHours();

                    
                    if(timeseriesMonth == currentMonth && timeseriesDay == currentDay && timeseriesHour == currentHour){
                        return weather["data"][timeFrame]["details"][type];
                    } else {
                        return undefined;
                    }
                } catch{
                    return undefined;
                }
            })
            .filter(value => value !== undefined);
        
            if (values.length < 1){
                logError(`Error no weatherData available for: ${type}`);
                return undefined;
            }
        
        return values[0];
    }

    const currTemp = getNewestWeatherData("instant", "air_temperature");

    const currWind = getNewestWeatherData("instant", "wind_speed");

    const exptRain = getNewestWeatherData("next_1_hours", "precipitation_amount");

    const currClouds = getNewestWeatherData("instant", "cloud_area_fraction");

    const currFog = getNewestWeatherData("instant", "fog_area_fraction");

    const exptMaxAirTempNext6Hours = getNewestWeatherData("next_6_hours", "air_temperature_max");

    const exptMinAirTempNext6Hours = getNewestWeatherData("next_6_hours", "air_temperature_min");

    const epxtMaxRainNext6Hours = getNewestWeatherData("next_6_hours", "precipitation_amount_max");

    const exptMinRainNext6Hours = getNewestWeatherData("next_6_hours", "precipitation_amount_min");

    const exptRainProbabilityNext6Hours = getNewestWeatherData("next_6_hours", "probability_of_precipitation");

    writeToLog("Weather updated");

    return {

        "Current_temp" : currTemp,
        "Current_wind" : currWind,
        "Expected_rain": exptRain,
        "Current_cloud" : currClouds,
        "Current_fog" : currFog,
        "Max_air_temp_6_hours" : exptMaxAirTempNext6Hours,
        "Min_air_temp_6_hours" : exptMinAirTempNext6Hours,
        "Max_rain_6_hours" : epxtMaxRainNext6Hours,
        "Min_rain_6_hours" : exptMinRainNext6Hours,
        "Rain_probability_6_hours" : exptRainProbabilityNext6Hours,
        "Last_updated" : lastUpdated,

    };

}

/**
 * Updates images by fetching the latest images from Google Drive, downloading them, and updating the server with the new images.
 * 
 * This function performs the following steps:
 * 1. Sets up an endpoint `/update-images` to handle the image update request.
 * 2. Uses the Google Drive API to list image files based on specific criteria.
 * 3. Sorts and processes the image files to determine the newest images for different categories.
 * 4. Updates environment variables with the IDs of the newest images.
 * 5. Downloads the newest images and saves them to the server.
 * 6. Sends an update notification with the new image URLs.
 * 
 * @async
 * @function updateImages
 * @throws Will throw an error if there is an issue with setting credentials, listing folders, getting a response, or downloading images.
 */
function updateImages(){

    debug(false,"Updating images");
    

    app.get('/update-images', async (req, res) => {
        debug(false,"Trying to download images");
        // Set credentials with the refresh token
    
        try {

            oAuth2Client.setCredentials({
                refresh_token: process.env.REFRESH_TOKEN // Retrieve this from your database
            });

            try{
                debug(false,"Trying to get images");
                // Use the Google Drive API to list folders
                const drive = google.drive({ version: 'v3', auth: oAuth2Client });
                
                const response = await drive.files.list({
                    q: "mimeType contains 'image/' and (mimeType = 'image/jpeg' or mimeType = 'image/png') and trashed = false",
                    fields: 'nextPageToken, files(id, name, parents)',
                    spaces: 'drive',
                });
    
                debug(false,"Trying to sort through response data");

                const mapping = [
                    {avd: "Bilde_Elektro", target: elektroBilder},
                    {avd: "Bilde_Renovasjon", target: renoBilder},
                    {avd: "Bilde_Bygg", target: byggBilder},
                    {avd: "Bilde_Telefonvakt_1", target: telefonvaktBilder1},
                    {avd: "Bilde_Telefonvakt_2", target: telefonvaktBilder2}
                ];
    
                var createdDate1;
                var createdDate2;
                var createdDate;

                response.data.files.forEach(function(file){

                    for (let map of mapping){
                        if (file.name.includes(map.avd)){
                            
                            createdDate1 = file.name.split(" ")[1];
                            createdDate2 = file.name.split(" ")[2];
                            var [day, month, year] = createdDate1.split("-");
                            var [hour, minute] = createdDate2.split(":");
                            
                            createdDate = Date.parse(new Date(year, month, day, hour, minute));
                            
                            map.target[file.name] = {
                                file_name: file.name,
                                file_id: file.id,
                                file_date: createdDate,
                            };
                        
                            break;

                        }                    
                    }

                });
    
                debug(false,`Antall Elektro bilder: ${Object.keys(elektroBilder).length}\nAntall Renovasjons bilder: ${Object.keys(renoBilder).length}\nAntall Bygg bilder: ${Object.keys(byggBilder).length}\n`);
            
                const nyesteElektroBilde = getNewestImage(elektroBilder);
                const nyesteRenoBilde = getNewestImage(renoBilder);
                const nyesteByggBilde = getNewestImage(byggBilder);
                const nyesteTelefonBilde1 = getNewestImage(telefonvaktBilder1);
                const nyesteTelefonBilde2 = getNewestImage(telefonvaktBilder2);

                process.env.ELEKTROBILDE = nyesteElektroBilde;
                process.env.RENOVASJONSBILDE = nyesteRenoBilde;
                process.env.BYGGBILDE = nyesteByggBilde;
                process.env.TELEFONBILDE1 = nyesteTelefonBilde1;
                process.env.TELEFONBILDE2 = nyesteTelefonBilde2;
    
                
    
                debug(false,`\nNyeste elektrobilde: ${nyesteElektroBilde}\nNyeste renobilde: ${nyesteRenoBilde}\nNyeste byggbilde: ${nyesteByggBilde}`);
    
            } catch (error){
                logError("Error getting a response: " + error)
                console.error('Error getting a response:', error);
                res.status(500).send('Error getting response.');
            }
        
        } catch (error) {
            logError("Error listing folders: " + error)
            console.error('Error listing folders:', error);
            res.status(500).send('Error listing folders.');
        }
    
        try{
            const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE, process.env.TELEFONBILDE1, process.env.TELEFONBILDE2]
    
            const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));
    
            const links = fileLinks.map(fileLink => fileLink.webContentLink);
    
            const imageDir = path.join(__dirname, 'images');
            ensureDirectoryExists(imageDir);
    
            const downloadPromises = links.map((link, index) => {
                const imagePath = path.join(imageDir, `image${index + 1}.png`);
                imgUrls[index] = `http://localhost:3000/images/image${index + 1}.png`;
                return downloadImage(link, imagePath);
            });
    
            await Promise.all(downloadPromises);

            sendUpdate({type: "images", data: imgUrls, date: new Date()});

            res.send("Images updated successfully");
            debug(false,"updateImages finished");
    
        } catch (error){
            logError("Error while downloading images: " + error)
            console.error(`Error while downloading images: ${error}`);
            res.status(500).send("Error downloading images");
        }
    
    
    });

    fetch(`${baseURL}/update-images`).catch((error) => {
        console.error(`Error: ${error}`);
        logError("Error updating images" + error)
    });

    writeToLog("Images updated");

}

/**
 * Displays the Google OAuth 2.0 login screen with a link to initiate the login process.
 * @function GET /
 * @returns redirect to /auth
 */
app.get('/', (req, res) => {
    res.send('<h1>Welcome to the Google OAuth 2.0 Login screen</h1><p><a href="/auth">Login with Google</a></p>');
});

/**
 * Generates the Google OAuth 2.0 authentication URL and Redirects the user to it.
 * @function GET /auth
 * @returns redirect to /auth/callback
 * @throws Will log an error if there is an issue generating the authentication URL.
 */
app.get('/auth', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // To get a refresh token
            scope: ['https://www.googleapis.com/auth/drive.readonly'],
            prompt: 'consent',
            redirect_uri: process.env.REDIRECT_URI,

        });

    process.env.AUTHURL = authUrl;

    res.redirect(authUrl);
});

/**
 * Handles the OAuth 2.0 callback, exchanges the authorization code for tokens, and Redirects to the list folders route.
 * @async
 * @function GET /auth/callback
 * @returns redirect to /list-folders
 * @throws Will log an error if there is an issue retrieving the access token.
 */
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;

    try {
    // Exchange the authorization code for an access token and refresh token
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Store the refresh token securely (e.g., in a database)
        process.env.REFRESH_TOKEN = tokens.refresh_token;

        res.redirect(`${baseURL}/list-folders`);
    } catch (error) {
        logError("Error retrieving access token: " + error)
        console.error('Error retrieving access token:', error);
        res.status(500).send('Error retrieving access token.');
    }
});

/**
 * Lists the folders in the authenticated user's Google Drive.
 * @async
 * @function GET /list-folders
 * @returns Redirects to /download-images
 * @throws Will log an error if there is an issue listing the folders.
 */
app.get('/list-folders', async (req, res) => {
    
    try {
        // Set credentials with the refresh token
        oAuth2Client.setCredentials({
            refresh_token: process.env.REFRESH_TOKEN // Retrieve this from your database
        });

        try{
            debug(false,"Trying to get images");
            // Use the Google Drive API to list folders
            const drive = google.drive({ version: 'v3', auth: oAuth2Client });
            
            const response = await drive.files.list({
                q: "mimeType contains 'image/' and (mimeType = 'image/jpeg' or mimeType = 'image/png') and trashed = false",
                fields: 'nextPageToken, files(id, name, parents)',
                spaces: 'drive',
            });

            debug(false,"Trying to sort through response data");

            const mapping = [
                {avd: "Bilde_Elektro", target: elektroBilder},
                {avd: "Bilde_Renovasjon", target: renoBilder},
                {avd: "Bilde_Bygg", target: byggBilder},
                {avd: "Bilde_Telefonvakt_1", target: telefonvaktBilder1},
                {avd: "Bilde_Telefonvakt_2", target: telefonvaktBilder2}
            ];
            
            debug(false, `antall filer: ${response.data.files.length}`);

            var createdDate1;
            var createdDate2;
            var createdDate;

            response.data.files.forEach(function(file){

                for (let map of mapping){
                    if (file.name.includes(map.avd)){
                        
                        createdDate1 = file.name.split(" ")[1];
                        createdDate2 = file.name.split(" ")[2];
                        var [day, month, year] = createdDate1.split("-");
                        var [hour, minute] = createdDate2.split(":");
                        
                        createdDate = Date.parse(new Date(year, month, day, hour, minute));
                        
                        map.target[file.name] = {
                            file_name: file.name,
                            file_id: file.id,
                            file_date: createdDate,
                        };
                    
                        break;

                    }                    
                }

            });

            debug(false,`Elektro bilder: ${Object.keys(elektroBilder)}\nRenovasjons bilder: ${Object.keys(renoBilder)}\nBygg bilder: ${Object.keys(byggBilder)}`);
        
            const nyesteElektroBilde = getNewestImage(elektroBilder);
            const nyesteRenoBilde = getNewestImage(renoBilder);
            const nyesteByggBilde = getNewestImage(byggBilder);
            const nyesteTelefonBilde1 = getNewestImage(telefonvaktBilder1);
            const nyesteTelefonBilde2 = getNewestImage(telefonvaktBilder2);

            process.env.ELEKTROBILDE = nyesteElektroBilde;
            process.env.RENOVASJONSBILDE = nyesteRenoBilde;
            process.env.BYGGBILDE = nyesteByggBilde;
            process.env.TELEFONBILDE1 = nyesteTelefonBilde1;
            process.env.TELEFONBILDE2 = nyesteTelefonBilde2;

            debug(false,`\nElektrobilde id: ${process.env.ELEKTROBILDE}\nRenobilde Id: ${process.env.RENOVASJONSBILDE}\nByggbilde Id: ${process.env.BYGGBILDE}\n\nTelefonvaktbilde 1 Id: ${process.env.TELEFONBILDE1}\nTelefonvaktbilde 2 Id: ${process.env.TELEFONBILDE2}`);

            res.redirect(`${baseURL}/download-images`);

        } catch (error){
            logError("Error getting a response: " + error)
            console.error('Error getting a response:', error);
            res.redirect(baseURL);
            //res.status(500).send('Error getting response.');
        }
    
    } catch (error) {
        logError("Error listing folders: " + error)
        console.error('Error listing folders:', error);
        res.redirect(baseURL);
        //res.status(500).send('Error listing folders.');
    }
});

app.get('/images/:imageName', (req, res) => {
    const imageName = req.params.imageName;
    const imagePath = path.join(__dirname, 'images', imageName);
    res.sendFile(imagePath);

});

/**
 * Downloads the latest images from Google Drive and saves them to the server.
 * @async
 * @function GET /download-images
 * @returns Redirects to /download-weather
 * @throws Will log an error if there is an issue downloading the images.
 */
app.get('/download-images', async (req, res) => {
    try{
        const drive = google.drive({ version: 'v3', auth: oAuth2Client });

        const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE, process.env.TELEFONBILDE1, process.env.TELEFONBILDE2];

        const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));

        const links = fileLinks.map(fileLink => fileLink.webContentLink);

        const imageDir = path.join(__dirname, 'images');
        ensureDirectoryExists(imageDir);

        const downloadPromises = links.map((link, index) => {
            const imagePath = path.join(imageDir, `image${index + 1}.png`);
            imgUrls[index] = `http://localhost:3000/images/image${index + 1}.png`;
            return downloadImage(link, imagePath);
        });

        await Promise.all(downloadPromises);

        setInterval(updateImages, 3600000);

        sendUpdate({type: "images", data: imgUrls, date: new Date()});

        writeToLog("Images downloaded");

        res.redirect(`${baseURL}/download-weather`);

    } catch (error){
        logError("Error while downloading images: " + error)
        console.error(`Error while downloading images: ${error}`);
        res.status(500).send("Error downloading images");
    }
});

/**
 * Downloads the latest weather data and saves it to the server.
 * @async
 * @function GET /download-weather
 * @returns Redirects to the root route.
 * @throws Will log an error if there is an issue downloading the weather data.
 */
app.get(`/download-weather`, async (req, res) => {

    try{
                
        var weatherResponse = await downloadWeatherData(weatherPath);
        
        if(weatherResponse != null){
            setTimeout(async () => {
                weatherData = await readWeatherData(weatherPath);
                sendUpdate({type: "weather", data: weatherData});
            }, 500);
            
        }

        setInterval(() => downloadWeatherData(weatherPath), 600000);
        
        setInterval(async () => {

            weatherData = await readWeatherData(weatherPath);
            sendUpdate({type: "weather", data: weatherData});

        }, 605000);
        

    } catch (error){
        logError("Error saving weatherdata: " + error)
        console.error(`Error saving weatherdata, reason:\n\n${error}`);
    } finally {
        res.redirect(baseURL);
    }

});

process.on('uncaughtException', (err) => {
    logError(`Uncaught Exception: ${err.message}\n${err.stack}`);
    // Optionally exit after logging to avoid an unstable state
    process.exit(1);
});
  
process.on('unhandledRejection', (reason, promise) => {
    logError(`Unhandled Rejection: ${reason}`);
    // Optionally exit after logging
    process.exit(1);
});

process.on('exit', (code) => {
    logError(`server.js process exited with code: ${code}`);
});

wss.on('connection', (ws) => {
    clients.push(ws);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        var message;

        switch(data.type){

            case "load":

                switch(data.message){

                    case "images":
                        message = {type: "initial_images", data: imgUrls, date: new Date()};
                        sendUpdate(message);
                        writeToLog("Loaded images to clients");
                        break;

                    case "weather":
                        message = {type: "initial_weather", data: weatherData};
                        sendUpdate(message);
                        writeToLog("Loaded weather to clients");
                        break;
                }
        
            case "weather":
                message = {type: "weather", data: weatherData};
                sendUpdate(message);
                writeToLog("Updated weather for clients");
                break;

            case "images":
                message = {type: "images", data: imgUrls, date: new Date()};
                sendUpdate(message);
                writeToLog("Updated images for clients");
                break;

            case "connection":
                message = {type: "initial_images", data: imgUrls, date: new Date()};
                sendUpdate(message);
                writeToLog("Loaded images for new client");
                
                setTimeout(() => {
                    message = {type: "initial_weather", data: weatherData};
                    sendUpdate(message);
                    writeToLog("Loaded weather for new client");
                }, 200);

                break;
            
            case "error":
                
                if(data.message){
                    logError(data.message);
                }

                break;
        }   
    });

    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
    });
})

// Start the server
app.listen(3000, () => {
    //removeOldLogs(logFile);
    console.log(`Server started at: ${new Date().toLocaleString('en-GB', { hour12: false })}, running on http://localhost:3000\n`);
});

server.listen(3001, () => {
    console.log(`Websocket started at: ${new Date().toLocaleString('en-GB', { hour12: false })}, running on ws://localhost:3001\n`);
});
