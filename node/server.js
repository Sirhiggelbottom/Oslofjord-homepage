// server.js
require('dotenv').config({path: './auth.env'}); // Load environment variables
const express = require('express');
const { google } = require('googleapis');
const { prod_tt_sasportal } = require('googleapis/build/src/apis/prod_tt_sasportal');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { hostname } = require('os');
const port = 3000;
const app = express();

app.use(cors());
app.use(express.json());

const baseURL = "http://localhost:3000";

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

function debug(debugging, message){
    if (debugging){
        console.log(`\n\n${message}\n\n`);
    }
}

function writeToLog(message){
    const logDir = path.join(__dirname, 'logs');
    const logFilePath = path.join(logDir, 'server.log');

    // Ensure the logs directory exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    // Create the log message with timestamp
    const timestamp = new Date().toLocaleString('en-GB', { hour12: false });
    const logMessage = `[${timestamp}] Event: ${message}\n`;
    
    // Append the error message to the log file
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
        console.error('Failed to write to the log file:', err);
        }
    });
}

function logError(message){
    const logDir = path.join(__dirname, 'logs');
    const logFilePath = path.join(logDir, 'error.log');

    // Ensure the logs directory exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    // Create the log message with timestamp
    const timestamp = new Date().toLocaleString('en-GB', { hour12: false });
    const logMessage = `[${timestamp}] ERROR: ${message}\n`;

    // Append the error message to the log file
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
        console.error('Failed to write to the log file:', err);
        }
    });
}

function getNewestImage(obj){    
    const images = Object.keys(obj);
    
    images.sort((a, b) => b - a);
    
    return images[0];

}

async function getImgLink(fileId){
    try {
        const drive = google.drive({ version: 'v3', auth: oAuth2Client });

        const res = await drive.files.get({
            fileId : fileId,
            fields: 'webViewLink, webContentLink',
        });

        return {
            fileId: fileId,
            webViewLink: res.data.webViewLink,
            webContentLink: res.data.webContentLink,
        };
    } catch (error){
        logError("Error getting Imagelinks: " + error)
        console.error('Error getting Imagelinks:', error);
    }

}

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
    
        expires = res.headers['expires'];
        lastModifed = res.headers['last-modified'];
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

function getWeatherFile(weatherPath){
    try{
        const weatherFile = fs.readFileSync(weatherPath);

        return JSON.parse(weatherFile);

    } catch(error){
        logError(`Error loading weatherFile, reason: ${error}`);
        return null;
    }
}

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
        lastUpdated = new Date().toLocaleString('en-GB', { hour12: false });
        logError(`Error getting lastUpdated from weatherFile: ${error}`);
    } finally {
        return lastUpdated;
    }

}

async function readWeatherData(weatherPath) {

    const weatherJSON = await getWeatherFile(weatherPath);
    
    if (weatherJSON == null){
        writeToLog("WeatherData is empty");
        return;
    }

    const coordinates = weatherJSON["geometry"]["coordinates"];
    const weatherValues = weatherJSON["properties"]["timeseries"];
    const lastUpdated = getLastUpdated(weatherJSON);

    function getNewestWeatherData(category, type){
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
                        return weather["data"][category]["details"][type];
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

function isWeatherDataInComplete(weatherData){
    return Object.values(weatherData).some(value => value === undefined || value === null);
}

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
    
                response.data.files.forEach(function(file){

                    for (let map of mapping){
                        if (file.name.includes(map.avd)){
                            map.target[file.name] = {
                                file_name: file.name,
                                file_id: file.id,
                            };

                            break;

                        }
    
                    }
    
                });
    
                debug(false,`Antall Elektro bilder: ${Object.keys(elektroBilder).length}\nAntall Renovasjons bilder: ${Object.keys(renoBilder).length}\nAntall Bygg bilder: ${Object.keys(byggBilder).length}\n`);
            
                const nyesteElektroBilde = getNewestImage(elektroBilder);
                const nyesteRenoBilde = getNewestImage(renoBilder);
                const nyesteByggBilde = getNewestImage(byggBilder);
    
                process.env.ELEKTROBILDE = elektroBilder[nyesteElektroBilde].file_id;
                process.env.RENOVASJONSBILDE = renoBilder[nyesteRenoBilde].file_id;
                process.env.BYGGBILDE = byggBilder[nyesteByggBilde].file_id;
    
                
    
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
            const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE]
    
            const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));
    
            const links = fileLinks.map(fileLink => fileLink.webContentLink);
    
            const imageDir = path.join(__dirname, 'images');
            ensureDirectoryExists(imageDir);
    
            const downloadPromises = links.map((link, index) => {
                const imagePath = path.join(imageDir, `image${index + 1}.png`);
                return downloadImage(link, imagePath);
            });
    
            await Promise.all(downloadPromises);
    
        } catch (error){
            logError("Error while downloading images: " + error)
            console.error(`Error while downloading images: ${error}`);
            res.status(500).send("Error downloading images");
        }
    
        res.send("Images updated successfully");
        debug(false,"updateImages finished");
    
    });

    fetch(`${baseURL}/update-images`).catch((error) => {
        console.error(`Error: ${error}`);
        logError("Error updating images" + error)
    });

    writeToLog("Images updated");
}

app.get('/', (req, res) => {
    res.send('<h1>Welcome to the Google OAuth 2.0 Login screen</h1><p><a href="/auth">Login with Google</a></p>');
});

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

            response.data.files.forEach(function(file){

                for (let map of mapping){
                    if (file.name.includes(map.avd)){
                        map.target[file.name] = {
                            file_name: file.name,
                            file_id: file.id,
                        };
                     
                        break;

                    }                    
                }

            });

            debug(false,`Antall Elektro bilder: ${Object.keys(elektroBilder).length}\nAntall Renovasjons bilder: ${Object.keys(renoBilder).length}\nAntall Bygg bilder: ${Object.keys(byggBilder).length}`);
        
            const nyesteElektroBilde = getNewestImage(elektroBilder);
            const nyesteRenoBilde = getNewestImage(renoBilder);
            const nyesteByggBilde = getNewestImage(byggBilder);
            const nyesteTelefonBilde1 = getNewestImage(telefonvaktBilder1);
            const nyesteTelefonBilde2 = getNewestImage(telefonvaktBilder2);

            process.env.ELEKTROBILDE = elektroBilder[nyesteElektroBilde].file_id;
            process.env.RENOVASJONSBILDE = renoBilder[nyesteRenoBilde].file_id;
            process.env.BYGGBILDE = byggBilder[nyesteByggBilde].file_id;
            process.env.TELEFONBILDE1 = telefonvaktBilder1[nyesteTelefonBilde1].file_id;
            process.env.TELEFONBILDE2 = telefonvaktBilder2[nyesteTelefonBilde2].file_id;

            debug(false,`\nElektrobilde id: ${process.env.ELEKTROBILDE}\nRenobilde Id: ${process.env.RENOVASJONSBILDE}\nByggbilde Id: ${process.env.BYGGBILDE}\n\nTelefonvaktbilde 1 Id: ${process.env.TELEFONBILDE1}\nTelefonvaktbilde 2 Id: ${process.env.TELEFONBILDE2}`);
            debug(false,`\nNyeste elektrobilde: ${nyesteElektroBilde}\nNyeste renobilde: ${nyesteRenoBilde}\nNyeste byggbilde: ${nyesteByggBilde}\nNyeste telefonvaktbilde: ${nyesteTelefonBilde1}`);

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

app.get('/list-images', (req, res) => {
    const imagesPath = path.join(__dirname, 'images');
    const imageFiles = fs.readdirSync(imagesPath);

    if(imageFiles.length == 0){
        console.error("The images hasn't been downloaded yet.");
        res.status(500).send("The images hasn't been downloaded yet.");
    } else {
        res.send("Ok");
    }
});

app.get('/images/:imageName', (req, res) => {
    const imageName = req.params.imageName;
    const imagePath = path.join(__dirname, 'images', imageName);
    res.sendFile(imagePath);

});

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
            return downloadImage(link, imagePath);
        });

        await Promise.all(downloadPromises);

        setInterval(updateImages, 3600000);

        writeToLog("Images downloaded");

        res.redirect(`${baseURL}/download-weather`);

    } catch (error){
        logError("Error while downloading images: " + error)
        console.error(`Error while downloading images: ${error}`);
        res.status(500).send("Error downloading images");
    }
});

app.get(`/download-weather`, async (req, res) => {

    try{
        /*const weatherDir = path.join(__dirname, 'weather');
        ensureDirectoryExists(weatherDir);

        const weatherPath = path.join(weatherDir, `WeatherData.json`);
        ensureFileExists(weatherPath);*/
        
        var weatherResponse = await downloadWeatherData(weatherPath);
        

        if(weatherResponse != null){
            //setTimeout(async () => { weatherData = await readWeatherData(weatherPath); }, 500);
            setTimeout(async () => {
                weatherData = await readWeatherData(weatherPath)
            }, 500);
            
        }
        

        setInterval(() => downloadWeatherData(weatherPath), 300000);
        
        /*setInterval(() => {
            weatherData = readWeatherData(weatherPath)
        }, 320000);*/
        

    } catch (error){
        logError("Error saving weatherdata: " + error)
        console.error(`Error saving weatherdata, reason:\n\n${error}`);
    }

    res.redirect(baseURL);
    
});

app.get('/get-weather', async (req, res) => {
    let weatherPath = path.join(__dirname, 'weather', 'WeatherData.json');

    weatherData = await readWeatherData(weatherPath);
    
    if(isWeatherDataInComplete(weatherData)){
        
        //writeToLog("WeatherData not present");
        

        res.json({
            Current_temp : undefined,
            Expected_rain : undefined,
            Current_wind : undefined,
            Current_cloud : undefined,
            Current_fog: undefined,
            Max_air_temp_6_hours : undefined,
            Min_air_temp_6_hours : undefined,
            Max_rain_6_hours : undefined,
            Min_rain_6_hours : undefined,
            Rain_probability_6_hours : undefined,
            Last_updated : undefined,
        });


    } else {
        
        res.json(weatherData);
        //writeToLog("WeatherData sent to client");
    }
    
});

app.post('/log-error', (req, res) => {
    
    try{

        const {message} = req.body;

        logError("Client error: " + message);
        //logError(`client error: ${Object.keys(req)}`);

        res.json({message: 'Data received successfully', received: message});

    } catch (error){
        logError("Error when logging errors from client: " + error);
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

// Start the server
app.listen(3000, () => {
    console.log(`Server started at: ${new Date().toLocaleString('en-GB', { hour12: false })}, running on http://localhost:3000`);
});
