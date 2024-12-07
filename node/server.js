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
const readline = require('readline');
const moment = require('moment');
const os = require('os');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

var clients = [];

/*app.use(cors((req, callback) => {

    const allowedOrigins = clients.map(client => client.clientIP);
    let corsOptions;


    if (allowedOrigins.includes(req.ip)) {
        corsOptions = { origin: true };
    } else {
        corsOptions = { origin: false };
    }

    callback(null, corsOptions);
}));*/

app.use(cors({origin: '*'}));

app.use(express.json());

app.use('/images', express.static(path.join(__dirname, 'images')));

function getHostname(){
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces){
        const addresses = networkInterfaces[interfaceName];
        for (const address of addresses){
            if(address.family === 'IPv4' && !address.internal){
                return address.address;
            }
        }
    }
}

const hostName = getHostname();

const baseURL = `http://${hostName}:3000`;

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
 * Initial collection of weatherdata, this also sends the weatherdata to any connected client
 * 
 * Updates the weatherdata with 10 minute intervals
 * 
 * @async
 */
async function collectWeather(){
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
    }
}

/**
 * Updates images by fetching the latest images from Google Drive, downloading them, and updating the server with the new images.
 * 
 * This function is a hybrid of listFolders() and collectImages() and accomplishes the same as them
 * 
 * This function performs the following steps:
 * - Uses the Google Drive API to list image files based on specific criteria.
 * - Sorts and processes the image files to determine the newest images for the different departments.
 * - Updates environment variables with the IDs of the newest images.
 * - Downloads the newest images and saves them to the server.
 * - Sends the updated image url's to any connected client.
 * 
 * @async
 * @throws Will throw an error if there is an issue with setting credentials, listing folders, getting a response, or downloading images.
 */
async function updateImages(){

    debug(false,"Updating images");
    

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

            /*var createdDate1;
            var createdDate2;*/
            var createdDate;

            response.data.files.forEach(function(file){

                for (let map of mapping){
                    if (file.name.includes(map.avd)){
                        
                        /*createdDate1 = file.name.split(" ")[1];
                        createdDate2 = file.name.split(" ")[2];
                        var [day, month, year] = createdDate1.split("-");
                        var [hour, minute] = createdDate2.split(":");*/

                        const [day, month, year] = file.name.split(" ")[1].split("-");
                        const [hour, minute] = file.name.split(" ")[2].split(":");
                        
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
        }
    
    } catch (error) {
        logError("Error listing folders: " + error)
        console.error('Error listing folders:', error);
    }

    try{
        const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE, process.env.TELEFONBILDE1, process.env.TELEFONBILDE2]

        const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));

        const links = fileLinks.map(fileLink => fileLink.webContentLink);

        const imageDir = path.join(__dirname, 'images');
        ensureDirectoryExists(imageDir);

        const downloadPromises = links.map((link, index) => {
            const imagePath = path.join(imageDir, `image${index + 1}.png`);
            imgUrls[index] = `${baseURL}/images/image${index + 1}.png`;
            return downloadImage(link, imagePath);
        });

        await Promise.all(downloadPromises);

        sendUpdate({type: "images", data: imgUrls, date: new Date()});

        debug(false,"updateImages finished");

        writeToLog("Images updated");

    } catch (error){
        logError("Error while downloading images: " + error)
        console.error(`Error while downloading images: ${error}`);
    }

    

}

/** 
 * Initial collection of image url's, this also sends the image url's to any connected client.
 * 
 * Updates the image url's with 1 hour intervals.
 * 
 * @async
 */
async function collectImages(){
    try{

        const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE, process.env.TELEFONBILDE1, process.env.TELEFONBILDE2];

        const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));

        const links = fileLinks.map(fileLink => fileLink.webContentLink);

        const imageDir = path.join(__dirname, 'images');
        ensureDirectoryExists(imageDir);

        const downloadPromises = links.map((link, index) => {
            const imagePath = path.join(imageDir, `image${index + 1}.png`);
            imgUrls[index] = `${baseURL}/images/image${index + 1}.png`;
            return downloadImage(link, imagePath);
        });

        await Promise.all(downloadPromises);

        setInterval(updateImages, 3600000);

        sendUpdate({type: "images", data: imgUrls, date: new Date()});

        writeToLog("Images downloaded");

        collectWeather();

    } catch (error){
        logError("Error while downloading images: " + error)
        console.error(`Error while downloading images: ${error}`);
    }
}

/**
 * Connects to google drive and maps the newest image url for each department.
 * 
 * 
 */
async function listFolders() {
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

            /*var createdDate1;
            var createdDate2;*/
            var createdDate;

            response.data.files.forEach(function(file){

                for (let map of mapping){
                    if (file.name.includes(map.avd)){
                        
                        /*createdDate1 = file.name.split(" ")[1];
                        createdDate2 = file.name.split(" ")[2];
                        var [day, month, year] = createdDate1.split("-");
                        var [hour, minute] = createdDate2.split(":");*/
                        
                        const [day, month, year] = file.name.split(" ")[1].split("-");
                        const [hour, minute] = file.name.split(" ")[2].split(":");

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

            collectImages();

        } catch (error){
            logError("Error getting a response: " + error)
            console.error('Error getting a response:', error);
        }
    
    } catch (error) {
        logError("Error listing folders: " + error)
        console.error('Error listing folders:', error);
    }
}

/**
 * Tries to automatically authenticate with the google drive api, if it can't, it opens an authentication window in the default browser.
 */
function authenticate() {

    if (fs.existsSync('./refresh_token.json')){
        const tokenData = JSON.parse(fs.readFileSync('./refresh_token.json'));
        oAuth2Client.setCredentials({
            refresh_token : tokenData.refresh_token
        });

        process.env.REFRESH_TOKEN = tokenData.refresh_token;

        writeToLog("Authenticated automatically using stored refresh-token.");

        console.log("Authenticated automatically");

        listFolders();
    } else {

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/drive.photos.readonly'
            ],
            prompt: 'consent',
            redirect_uri: process.env.REDIRECT_URI, 
        });

        process.env.AUTHURL = authUrl;

        (async () => {

            const {default : open} = await import('open');

            try {
                console.log("Please authenticate in the browser");
                authWindow = await open(authUrl);
            } catch (error){
                logError(`Failed to authenticate: ${error}`);
            }
        
        })();

        
    }
}

/**
 * Sends updates to all connected WebSocket clients.
 * @function sendUpdate
 * @param {Object} data - The data to send to the clients.
 * @throws Will log an error if there is an issue sending the update.
 */
function sendUpdate(data){
    clients.forEach(client => {
        if(client.ws.readyState === WebSocket.OPEN){
            client.ws.send(JSON.stringify(data));
        }
    });
}

function removeOldLogs(){

    const logFiles = ['server.log', 'error.log'];
    const oneWeekAgo = moment().subtract(7, 'days');
    
    logFiles.forEach((file) => {
        const filePath = path.join(logDir, file);
        const tempFilePath = path.join(logDir, `${file}.tmp`);

        const readStream = fs.createReadStream(filePath);
        const writeStream = fs.createWriteStream(tempFilePath);

        const rl = readline.createInterface({
            input: readStream,
            output: process.stdout,
            terminal: false,
        });

        rl.on('line', (line) => {
            const match = line.match(/^\[(.*?)\]/)

            if (match){
                const logDate = moment(match[1], 'DD/MM/YYYY, HH:mm:ss');
                if(logDate.isAfter(oneWeekAgo)){
                    writeStream.write(line + '\n');
                }
            }
        });

        rl.on('close', () => {
            writeStream.end(() => {
                fs.rename(tempFilePath, filePath, (error) => {
                    if (error){
                        console.error(`Error replacing log file: ${file}\nError: ${error}`);
                    } else {
                        console.log(`Updated: ${file}`);
                    }
                })
            })
        });
    });

    
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
        fs.writeFileSync('./refresh_token.json', JSON.stringify({ refresh_token: tokens.refresh_token }));

        process.env.REFRESH_TOKEN = tokens.refresh_token;

        //res.redirect(`${baseURL}/list-folders`);
        res.send(`
            <html>
                <body>
                    <h1>Authentication successful!</h1>
                    <p>You can now close this tab</p>
                    <script>
                        setTimeout(function() {
                            window.close();
                        }, 2000);
                    </script>
                </body>
            </html>
        `);
        listFolders();
    } catch (error) {
        logError("Error retrieving access token: " + error)
        console.error('Error retrieving access token:', error);
        res.status(500).send('Error retrieving access token.');
    }
});

app.get(`/get-connection`, (req, res) => {
    res.send(`ws://${hostName}:3001`);
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

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    clients.push({ws, clientIP});

    console.log(`A client is trying to connect`);
    

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        var message;
        var emptyUrls = false;

        switch(data.type){

            case "load":

                switch(data.message){

                    case "images":
                        console.log(`Client requests to load images`);
                        message = {type: "initial_images", data: imgUrls, date: new Date()};
                        sendUpdate(message);
                        writeToLog("Loaded images to clients");
                        break;

                    case "weather":
                        console.log(`Client requests to load weather`);
                        message = {type: "initial_weather", data: weatherData};
                        sendUpdate(message);
                        writeToLog("Loaded weather to clients");
                        break;
                }
            
                break;
        
            case "weather":
                console.log(`Client requests updated weather`);
                message = {type: "weather", data: weatherData};
                sendUpdate(message);
                writeToLog("Updated weather for clients");
                break;

            case "images":
                console.log(`Client requests updated images`);
                message = {type: "images", data: imgUrls, date: new Date()};
                sendUpdate(message);
                writeToLog("Updated images for clients");
                break;

            case "connection":
                console.log(`Client connected, images and weather requested`);
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
        clients = clients.filter(client => client.ws !== ws);
    });

    ws.on('error', (error) => {
        console.error(`Error: ${error}`);
    });
});

// Server
app.listen(3000, '0.0.0.0', () => {
    
    authenticate();

    setInterval(() => {
        removeOldLogs();
    }, 604800000);

    removeOldLogs();
    
    console.log(`Server started at: ${new Date().toLocaleString('en-GB', { hour12: false })}, running on ${hostName}\n`);
});

// Websocket Server
server.listen(3001, hostName, () => {
    console.log(`Websocket started at: ${new Date().toLocaleString('en-GB', { hour12: false })}, running on ${Object.values(server.address())}\n`);
});
