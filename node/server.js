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

const baseURL = "http://localhost:3000";

var weatherData = {
    Average_temp : Number,
    Average_wind : Number,
    Average_rain : Number,
    Average_cloud : Number,
    Max_air_temp_6_hours : Number,
    Min_air_temp_6_hours : Number,
    Max_rain_6_hours : Number,
    Min_rain_6_hours : Number,
    Rain_probability_6_hours : Number,
    Last_updated : "",
};

app.use(cors());

// Load environment variables
const authCheckURI = process.env.REDIRECT_URI_CHECK, reAuthURI = process.env.REDIRECT_URI_REAUTH, redirectURI = process.env.REDIRECT_URI, clientID = process.env.CLIENT_ID, clientSecret = process.env.CLIENT_SECRET, refreshToken = process.env.REFRESH_TOKEN;

// Create an OAuth2 client
var oAuth2Client = new google.auth.OAuth2(  
    clientID,
    clientSecret,
    authCheckURI

);

function debug(debugging, message){
    if (debugging){
        console.log(`\n\n${message}\n\n`);
    }
}

function logError(message){
    const logDir = path.join(__dirname, 'logs');
    const logFilePath = path.join(logDir, 'error.log');

    // Ensure the logs directory exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    // Create the log message with timestamp
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}\n`;

    // Append the error message to the log file
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
        console.error('Failed to write to the log file:', err);
        }
    });
}

const elektroBilder  = {};
const renoBilder = {};
const byggBilder = {};
const telefonvaktBilder1 = {};
const telefonvaktBilder2 = {};
const usorterteBilder = {};

// Root route to handle "/"
app.get('/', (req, res) => {
    res.send('<h1>Welcome to the Google OAuth 2.0 Login screen</h1><p><a href="/auth">Login with Google</a></p>');
});

// Step 1: Direct users to Google's OAuth 2.0 login page
app.get('/auth', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // To get a refresh token
    scope: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/docs', 'https://www.googleapis.com/auth/drive.photos.readonly'],
    redirect_uri: authCheckURI,
    });

    process.env.AUTHURL = authUrl;

    res.redirect(authUrl);
});

app.get('/auth/check', async (req, res) => {
    const code = req.query.code;
    
    try{
        // Exchange the authorization code for an access token and refresh token
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        if (!tokens || !tokens.refresh_token){
            oAuth2Client.redirectUri = redirectURI;
            res.redirect(reAuthURI);
        } else {
            // Store the refresh token securely (e.g., in a database)
            //oAuth2Client.redirectUri = authCheckURI
            process.env.REFRESH_TOKEN = tokens.refresh_token;
            res.redirect(redirectURI);
        }

        debug(false,`Refresh token: ${tokens.refresh_token}`);

    } catch (error){
        logError(error)
        console.error('Error checking the access token:', error);
        res.status(500).send('Error checking the access token.');
    }

});

app.get('/reauth', (req, res) => {

    try{
        console.log("Authenticating");

        const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // To get a refresh token
            scope: ['https://www.googleapis.com/auth/drive.readonly'],
            prompt: 'consent',
            redirect_uri: process.env.REDIRECT_URI,

        });
        process.env.AUTHURL = authUrl;
        res.redirect(authUrl);
    } catch (error){
        logError(error)
        console.error('Error authenticating:', error);
        res.status(500).send('Error checking the access token.');
    }

    
});

// Step 2: Handle the OAuth 2.0 callback and get the access token and refresh token
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
        logError(error)
        console.error('Error retrieving access token:', error);
        res.status(500).send('Error retrieving access token.');
    }
});

// Step 3: Use the stored refresh token to get a new access token and access the Google Drive API
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

            response.data.files.forEach(function(file){

                if (file.name.includes("Bilde_Elektro")){
                    elektroBilder[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                    debug(false,"Elektro bilde");
                } else if (file.name.includes("Bilde_Renovasjon")){
                    renoBilder[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                    debug(false,"Reno bilde");
                } else if (file.name.includes("Bilde_Bygg")){
                    byggBilder[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                    debug(false,"Bygg bilde");

                } else if(file.name.includes("Bilde_Telefonvakt_1")){
                    telefonvaktBilder1[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                    debug(false,"Bygg bilde");
                } else if(file.name.includes("Bilde_Telefonvakt_2")){
                    telefonvaktBilder2[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                    debug(false,"Bygg bilde");
                } else {
                    usorterteBilder[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                }
                
                debug(false,`\nFound file.\nFile name: ${file.name}\nFile ID: ${file.id}\nParent folder: ${file.parents}\n`);

            });

            debug(false,`Antall Elektro bilder: ${Object.keys(elektroBilder).length}\nAntall Renovasjons bilder: ${Object.keys(renoBilder).length}\nAntall Bygg bilder: ${Object.keys(byggBilder).length}\nAntall usorterte bilder: ${Object.keys(usorterteBilder).length}`)
        
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

            debug(false, `\nElektrobilde id: ${process.env.ELEKTROBILDE}\nRenobilde Id: ${process.env.RENOVASJONSBILDE}\nByggbilde Id: ${process.env.BYGGBILDE}\n\n Telefonvaktbilde 1 Id: ${process.env.TELEFONBILDE1}\n Telefonvaktbilde 2 Id: ${process.env.TELEFONBILDE2}`);

            debug(false,`\nNyeste elektrobilde: ${nyesteElektroBilde}\nNyeste renobilde: ${nyesteRenoBilde}\nNyeste byggbilde: ${nyesteByggBilde}\nNyeste telefonvaktbilde: ${nyesteTelefonBilde1}`);

            res.redirect(`${baseURL}/images`);

        } catch (e){
            logError(error)
            console.error('Error getting a response:', e);
            res.status(500).send('Error getting response.');
        }
    
    } catch (error) {
        logError(error)
        console.error('Error listing folders:', error);
        res.status(500).send('Error listing folders.');
    }
});


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
        logError(error)
        console.error('Error getting Imagelinks:', error);
    }

}


app.get('/images', async (req, res) => {

    try{
        const drive = google.drive({ version: 'v3', auth: oAuth2Client });

        const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE, process.env.TELEFONBILDE1, process.env.TELEFONBILDE2];

        debug(false,`\n\nFileIDs: ${fileIds}`);

        const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));

        const links = [];
        
        fileLinks.forEach(linkInfo => {
            links.push(linkInfo.webContentLink);
        });

        res.redirect(`${baseURL}/download-images`)
    } catch (error){
        logError(error)
        console.error('Error accessing images:', error);
        res.status(500).send('Error listing folders.');
    }
    

});

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
    } catch (e){
        logError(error)
        console.error('Error downloading image:', error);
    }
    
};

var expires = "";
var lastModifed = "";

async function downloadWeatherData(options, weatherPath, weatherDir){
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
            console.log(`Weather data downloaded to: ${weatherDir}`);
        });

        if (res.statusCode === 429) {
            console.error('Rate limit exceeded. Please try again later.');
            req.end();
            return null;
        }
    
    });

    req.on('error', (e) => {
        logError(error)
        console.error(`Error, couldn't process request.\nReason: ${e}`);
    });

    req.end();
    return "Ok";
}

async function readWeatherData(weatherPath) {
    const weatherFile = fs.readFileSync(weatherPath);

    const weatherJSON = JSON.parse(weatherFile);
    const coordinates = weatherJSON["geometry"]["coordinates"];
    const weatherValues = weatherJSON["properties"]["timeseries"];
    var lastUpdated = weatherJSON["properties"]["meta"]["updated_at"];

    var temperatures = [];
    var temperature;

    var windSpeeds = [];
    var windSpeed;

    var rains = [];
    var rain;

    var cloudCoverages = [];
    var cloudCoverage;

    var airTempsMaxNext6Hours = []
    var airTempMaxNext6Hours;

    var airTempsMinNext6Hours = []
    var airTempMinNext6Hours;

    var maxRainsNext6Hours = [];
    var maxRainNext6Hours;

    var minRainsNext6Hours = [];
    var minRainNext6Hours;

    var rainProbabilitiesNext6Hours = []
    var rainProbabilityNext6Hours;
    
    var weatherTimeSeries = Object.keys(weatherValues);
    var timeSeriesLength = weatherTimeSeries.length - 2;


    for (let i = 0; i < timeSeriesLength; i++){

        try{
            temperature = weatherValues[i]["data"]["instant"]["details"]["air_temperature"];
            temperatures.push(temperature);
            
            windSpeed = weatherValues[i]["data"]["instant"]["details"]["wind_speed"];
            windSpeeds.push(windSpeed);

            rain = weatherValues[i]["data"]["next_1_hours"]["details"]["precipitation_amount"];
            rains.push(rain);

            cloudCoverage = weatherValues[i]["data"]["instant"]["details"]["cloud_area_fraction"];
            cloudCoverages.push(cloudCoverage);

            airTempMaxNext6Hours =  weatherValues[i]["data"]["next_6_hours"]["details"]["air_temperature_max"];
            airTempsMaxNext6Hours.push(airTempMaxNext6Hours);

            airTempMinNext6Hours =  weatherValues[i]["data"]["next_6_hours"]["details"]["air_temperature_min"];
            airTempsMinNext6Hours.push(airTempMinNext6Hours);

            maxRainNext6Hours =  weatherValues[i]["data"]["next_6_hours"]["details"]["precipitation_amount_max"];
            maxRainsNext6Hours.push(maxRainNext6Hours);

            minRainNext6Hours =  weatherValues[i]["data"]["next_6_hours"]["details"]["precipitation_amount_min"];
            minRainsNext6Hours.push(minRainNext6Hours);

            rainProbabilityNext6Hours =  weatherValues[i]["data"]["next_6_hours"]["details"]["probability_of_precipitation"];
            rainProbabilitiesNext6Hours.push(rainProbabilityNext6Hours);

        } catch(e){

            continue;

        }

    }

    if(temperatures.length < 1 || windSpeeds.length < 1 || rains.length < 1 || cloudCoverages.length < 1) {
        console.error("Error, instant values not defined");
    }

    // Current Air Temp
    
    //----------------------------------------------------------------------------------------------------------------------

    var sumTemp = 0;
    var avgTemp = 0;

    temperatures.forEach((temperature) => {
        sumTemp += temperature;
    });

    avgTemp = (sumTemp / temperatures.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    // Current Wind Speed
    
    //----------------------------------------------------------------------------------------------------------------------

    var sumWind = 0;
    var avgWind = 0;

    windSpeeds.forEach((wind) => {
        sumWind += wind;
    });

    avgWind = (sumWind / windSpeeds.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    // Current Rainpour

    //----------------------------------------------------------------------------------------------------------------------

    var sumRain = 0;
    var avgRain = 0;

    

    rains.forEach((rain) => {
        sumRain += rain;
    });

    avgRain = (sumRain / rains.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    // Current Cloudcoverage

    //----------------------------------------------------------------------------------------------------------------------

    var sumClouds = 0;
    var avgClouds = 0;

    cloudCoverages.forEach((cloud) => {
        sumClouds += cloud;
    });

    avgClouds = (sumClouds / cloudCoverages.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    // Max Air Temp Next 6 Hours

    //----------------------------------------------------------------------------------------------------------------------

    var sumMaxAirTempNext6Hours = 0;
    var avgMaxAirTempNext6Hours = 0;

    airTempsMaxNext6Hours.forEach((temp) => {
        sumMaxAirTempNext6Hours += temp;
    });

    avgMaxAirTempNext6Hours = (sumMaxAirTempNext6Hours / airTempsMaxNext6Hours.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    // Min Air Temp Next 6 Hours

    //----------------------------------------------------------------------------------------------------------------------

    var sumMinAirTempNext6Hours = 0;
    var avgMinAirTempNext6Hours = 0;

    airTempsMinNext6Hours.forEach((temp) => {
        sumMinAirTempNext6Hours += temp;
    });

    avgMinAirTempNext6Hours = (sumMinAirTempNext6Hours / airTempsMinNext6Hours.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    // Max Rainpour Next 6 Hours

    //----------------------------------------------------------------------------------------------------------------------

    
    var sumMaxRainNext6Hours = 0;
    var avgMaxRainNext6Hours = 0;

    maxRainsNext6Hours.forEach((rain) => {
        sumMaxRainNext6Hours += rain;
    });

    avgMaxRainNext6Hours = (sumMaxRainNext6Hours / maxRainsNext6Hours.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    // Min Rainpour Next 6 Hours

    //----------------------------------------------------------------------------------------------------------------------

    var sumMinRainNext6Hours = 0;
    var avgMinRainNext6Hours = 0;

    minRainsNext6Hours.forEach((rain) => {
        sumMinRainNext6Hours += rain;
    });

    avgMinRainNext6Hours = (sumMinRainNext6Hours / minRainsNext6Hours.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    // Rain Probability Next 6 Hours

    //----------------------------------------------------------------------------------------------------------------------

    var sumRainProbabilityNext6Hours = 0;
    var avgRainProbabilityNext6Hours = 0;

    rainProbabilitiesNext6Hours.forEach((rain) => {
        sumRainProbabilityNext6Hours += rain;
    });

    avgRainProbabilityNext6Hours = (sumRainProbabilityNext6Hours / rainProbabilitiesNext6Hours.length).toFixed(1);

    //----------------------------------------------------------------------------------------------------------------------

    debug(false,`Average temp: ${avgTemp} Celsius\nAverage wind: ${avgWind} m/s\nAverage cloudcoverage: ${avgClouds}%`);

    //return [avgTemp, avgWind, avgClouds, predicredWeather];

    return {

        "Average_temp" : avgTemp,
        "Average_wind" : avgWind,
        "Average_rain": avgRain,
        "Average_cloud" : avgClouds,
        "Max_air_temp_6_hours" : avgMaxAirTempNext6Hours,
        "Min_air_temp_6_hours" : avgMinAirTempNext6Hours,
        "Max_rain_6_hours" : avgMaxRainNext6Hours,
        "Min_rain_6_hours" : avgMinRainNext6Hours,
        "Rain_probability_6_hours" : avgRainProbabilityNext6Hours,
        "Last_updated" : lastUpdated,

    };

    
}


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
        const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE, process.env.TELEFONBILDE1, process.env.TELEFONBILDE2];

        const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));

        const links = [];
    
        fileLinks.forEach(linkInfo => {
            links.push(linkInfo.webContentLink);
        });

        const imageDir = path.join(__dirname, 'images');
        ensureDirectoryExists(imageDir);

        const downloadPromises = links.map((link, index) => {
            const imagePath = path.join(imageDir, `image${index + 1}.png`);
            return downloadImage(link, imagePath);
        });

        await Promise.all(downloadPromises);

        setInterval(updateImages, 3600000);

        res.redirect(`${baseURL}/download-weather`);

    } catch (e){
        logError(error)
        console.error(`Error while downloading images: ${e}`);
        res.status(500).send("Error downloading images");
    }
});

app.get(`/download-weather`, async (req, res) => {

    try{
        const weatherDir = path.join(__dirname, 'weather');
        ensureDirectoryExists(weatherDir);

        const weatherPath = path.join(weatherDir, `WeatherData.json`);
        ensureFileExists(weatherPath);

        var options;

        if(!lastModifed == ""){
            options = {
                hostname: 'api.met.no',
                path: '/weatherapi/locationforecast/2.0/complete.json?lat=59.22&lon=10.33',
                method: 'GET',
                headers: {
                    'User-Agent' : 'WeatherData/1.0 (driftoslofjordhotell@gmail.com)',
                    'If-Modified-Since': lastModifed
                }
            };
            //console.log("Using If-Modifed-Since variable");
        } else {
            options = {
                hostname: 'api.met.no',
                path: '/weatherapi/locationforecast/2.0/complete.json?lat=59.22&lon=10.33',
                method: 'GET',
                headers: {
                    'User-Agent' : 'WeatherData/1.0 (driftoslofjordhotell@gmail.com)',
                }
            };
            //console.log("Not using If-Modifed-Since variable");
        }
        
        
        var weatherResponse = await downloadWeatherData(options, weatherPath, weatherDir);
        

        if(weatherResponse != null){
            weatherData = await readWeatherData(weatherPath);
        }
        

        setInterval(() => downloadWeatherData(options, weatherPath, weatherDir), 300000);
        setInterval(() => readWeatherData(weatherPath), 320000);

    } catch (e){
        logError(error)
        console.error(`Error downloading weatherdata, reason:\n\n${e}`);
    }

    res.redirect(baseURL);
    
});

app.get('/get-weather', (req, res) => {
    if(weatherData == ""){
        res.json({
            Average_temp : "NaN",
            Average_rain : "NaN",
            Average_wind : "NaN",
            Average_cloud : "NaN",
            Max_air_temp_6_hours : "NaN",
            Min_air_temp_6_hours : "NaN",
            Max_rain_6_hours : "NaN",
            Min_rain_6_hours : "NaN",
            Rain_probability_6_hours : "NaN",
            Last_updated : "NaN",
        });
    } else {
        res.json(weatherData);
    }
    
});

function updateImages(){
    debug(false,"Updating images");
    
    fetch(`${baseURL}/update-images`).catch((e) => {
        console.error(`Error: ${e}`);
        logError(error)
    });

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
    
                response.data.files.forEach(function(file){
    
                    if (file.name.includes("Bilde_Elektro")){
                        elektroBilder[file.name] = {
                            file_name : file.name,
                            file_id: file.id
                        };
                        debug(false,"Elektro bilde");
                    } else if (file.name.includes("Bilde_Renovasjon")){
                        renoBilder[file.name] = {
                            file_name : file.name,
                            file_id: file.id
                        };
                        debug(false,"Reno bilde");
                    } else if (file.name.includes("Bilde_Bygg")){
                        byggBilder[file.name] = {
                            file_name : file.name,
                            file_id: file.id
                        };
                        debug(false,"Bygg bilde");
                    } else {
                        usorterteBilder[file.name] = {
                            file_name : file.name,
                            file_id: file.id
                        };
                    }
                    
                    debug(false,`\nFound file.\nFile name: ${file.name}\nFile ID: ${file.id}\nParent folder: ${file.parents}\n`);
    
                });
    
                debug(false,`Antall Elektro bilder: ${Object.keys(elektroBilder).length}\nAntall Renovasjons bilder: ${Object.keys(renoBilder).length}\nAntall Bygg bilder: ${Object.keys(byggBilder).length}\nAntall usorterte bilder: ${Object.keys(usorterteBilder).length}`)
            
                const nyesteElektroBilde = getNewestImage(elektroBilder);
                const nyesteRenoBilde = getNewestImage(renoBilder);
                const nyesteByggBilde = getNewestImage(byggBilder);
    
                process.env.ELEKTROBILDE = elektroBilder[nyesteElektroBilde].file_id;
                process.env.RENOVASJONSBILDE = renoBilder[nyesteRenoBilde].file_id;
                process.env.BYGGBILDE = byggBilder[nyesteByggBilde].file_id;
    
                
    
                debug(false,`\nNyeste elektrobilde: ${nyesteElektroBilde}\nNyeste renobilde: ${nyesteRenoBilde}\nNyeste byggbilde: ${nyesteByggBilde}`);
    
            } catch (e){
                logError(error)
                console.error('Error getting a response:', e);
                res.status(500).send('Error getting response.');
            }
        
        } catch (error) {
            logError(error)
            console.error('Error listing folders:', error);
            res.status(500).send('Error listing folders.');
        }
    
        try{
            const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE]
    
            const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));
    
            const links = [];
        
            fileLinks.forEach(linkInfo => {
                links.push(linkInfo.webContentLink);
            });
    
            const imageDir = path.join(__dirname, 'images');
            ensureDirectoryExists(imageDir);
    
            const downloadPromises = links.map((link, index) => {
                const imagePath = path.join(imageDir, `image${index + 1}.png`);
                return downloadImage(link, imagePath);
            });
    
            await Promise.all(downloadPromises);
    
        } catch (e){
            logError(error)
            console.error(`Error while downloading images: ${e}`);
            res.status(500).send("Error downloading images");
        }
    
        res.send("Images updated successfully");
        debug(false,"updateImages finished");
    
    });

    
}

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
    console.log('Server running on http://localhost:3000');
});
