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
    Predicted_weather : "",
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

const debugging = false;

function debug(message){
    if (debugging){
        console.log(`\n\n${message}\n\n`);
    }
}

const elektroBilder  = {};
const renoBilder = {};
const byggBilder = {};
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

        debug(`Refresh token: ${tokens.refresh_token}`);

    } catch (error){
        console.error('Error checking the access token:', error);
        res.status(500).send('Error checking the access token.');
    }

});

app.get('/reauth', (req, res) => {

    console.log("Authenticating");

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline', // To get a refresh token
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        prompt: 'consent',
        redirect_uri: process.env.REDIRECT_URI,

    });
    process.env.AUTHURL = authUrl;
    res.redirect(authUrl);
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
        console.error('Error retrieving access token:', error);
        res.status(500).send('Error retrieving access token.');
    }
});

// Step 3: Use the stored refresh token to get a new access token and access the Google Drive API
app.get('/list-folders', async (req, res) => {
    // Set credentials with the refresh token
    oAuth2Client.setCredentials({
      refresh_token: process.env.REFRESH_TOKEN // Retrieve this from your database
    });


    try {
        try{
            debug("Trying to get images");
            // Use the Google Drive API to list folders
            const drive = google.drive({ version: 'v3', auth: oAuth2Client });
            
            const response = await drive.files.list({
                q: "mimeType contains 'image/' and (mimeType = 'image/jpeg' or mimeType = 'image/png') and trashed = false",
                fields: 'nextPageToken, files(id, name, parents)',
                spaces: 'drive',
            });

            debug("Trying to sort through response data");

            response.data.files.forEach(function(file){

                if (file.name.includes("Bilde_Elektro")){
                    elektroBilder[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                    debug("Elektro bilde");
                } else if (file.name.includes("Bilde_Renovasjon")){
                    renoBilder[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                    debug("Reno bilde");
                } else if (file.name.includes("Bilde_Bygg")){
                    byggBilder[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                    debug("Bygg bilde");
                } else {
                    usorterteBilder[file.name] = {
                        file_name : file.name,
                        file_id: file.id
                    };
                }
                
                debug(`\nFound file.\nFile name: ${file.name}\nFile ID: ${file.id}\nParent folder: ${file.parents}\n`);

            });

            debug(`Antall Elektro bilder: ${Object.keys(elektroBilder).length}\nAntall Renovasjons bilder: ${Object.keys(renoBilder).length}\nAntall Bygg bilder: ${Object.keys(byggBilder).length}\nAntall usorterte bilder: ${Object.keys(usorterteBilder).length}`)
        
            const nyesteElektroBilde = getNewestImage(elektroBilder);
            const nyesteRenoBilde = getNewestImage(renoBilder);
            const nyesteByggBilde = getNewestImage(byggBilder);

            process.env.ELEKTROBILDE = elektroBilder[nyesteElektroBilde].file_id;
            process.env.RENOVASJONSBILDE = renoBilder[nyesteRenoBilde].file_id;
            process.env.BYGGBILDE = byggBilder[nyesteByggBilde].file_id;

            

            debug(`\nNyeste elektrobilde: ${nyesteElektroBilde}\nNyeste renobilde: ${nyesteRenoBilde}\nNyeste byggbilde: ${nyesteByggBilde}`);

            res.redirect(`${baseURL}/images`);

        } catch (e){
            console.error('Error getting a response:', e);
            res.status(500).send('Error getting response.');
        }
    
    } catch (error) {
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
}


app.get('/images', async (req, res) => {
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    const fileIds = [process.env.ELEKTROBILDE, process.env.RENOVASJONSBILDE, process.env.BYGGBILDE]

    debug(`\n\nFileIDs: ${fileIds}`);

    const fileLinks = await Promise.all(fileIds.map(id => getImgLink(id)));

    const links = [];
    
    fileLinks.forEach(linkInfo => {
        links.push(linkInfo.webContentLink);
    });

    res.redirect(`${baseURL}/download-images`)

});

const downloadImage = async (url, imagePath) => {
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
    
    });

    req.on('error', (e) => {
        console.error(`Error, couldn't process request.\nReason: ${e}`);
    });

    req.end();
}

async function readWeatherData(weatherPath) {
    const weatherFile = fs.readFileSync(weatherPath);

    const weatherJSON = JSON.parse(weatherFile);
    const coordinates = weatherJSON["geometry"]["coordinates"];
    const weatherValues = weatherJSON["properties"]["timeseries"];
    var lastUpdated = weatherJSON["properties"]["meta"]["units"]["updated_at"];

    var temperatures = [];
    var temperature;

    var windSpeeds = [];
    var windSpeed;

    var rains = [];
    var rain;

    var cloudCoverages = [];
    var cloudCoverage;

    var predictedWeathers = []
    var predicredWeather;

    var weatherTimeSeries = Object.keys(weatherValues);
    var timeSeriesLength = weatherTimeSeries.length;

    

    debug(`Vær neste time: ${weatherValues[0]["data"]["next_1_hours"]["summary"]["symbol_code"]}`)

    for (let i = 0; i < timeSeriesLength; i++){

        temperature = weatherValues[i]["data"]["instant"]["details"]["air_temperature"];
        temperatures.push(temperature);
        
        windSpeed = weatherValues[i]["data"]["instant"]["details"]["wind_speed"];
        windSpeeds.push(windSpeed);

        rain = weatherValues[i]["data"]["next_1_hours"]["details"]["precipitation_amount"];
        rains.push(rain);

        cloudCoverage = weatherValues[i]["data"]["instant"]["details"]["cloud_area_fraction"];
        cloudCoverages.push(cloudCoverage);

        predicredWeather = weatherValues[i]["data"]["next_1_hours"]["summary"]["symbol_code"];
        predictedWeathers.push(predicredWeather);

    }

    predicredWeather = predictedWeathers[(predictedWeathers.length) - 1]

    var sumTemp = 0;
    var avgTemp = 0;

    temperatures.forEach((temperature) => {
        sumTemp += temperature;
    });

    avgTemp = (sumTemp / temperatures.length).toFixed(1);

    var sumWind = 0;
    var avgWind = 0;

    windSpeeds.forEach((wind) => {
        sumWind += wind;
    });

    var sumRain = 0;
    var avgRain = 0;

    rains.forEach((rain) => {
        sumRain += rain;
    });

    avgRain = (sumRain / rains.length).toFixed(1);

    avgWind = (sumWind / windSpeeds.length).toFixed(1);

    var sumClouds = 0;
    var avgClouds = 0;

    cloudCoverages.forEach((cloud) => {
        sumClouds += cloud;
    });

    avgClouds = (sumClouds / cloudCoverages.length).toFixed(1);

    debug(`Average temp: ${avgTemp} Celsius\nAverage wind: ${avgWind} m/s\nAverage cloudcoverage: ${avgClouds}%\nPredicted Weather: ${predicredWeather}`);

    //return [avgTemp, avgWind, avgClouds, predicredWeather];

    return {"Average_temp" : avgTemp, "Average_wind" : avgWind, "Average_rain": avgRain, "Average_cloud" : avgClouds, "Predicted_weather": predicredWeather, "Last_updated" : lastUpdated};
    
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

app.get('/images/:imageName', (req, res) => {
    const imageName = req.params.imageName;
    const imagePath = path.join(__dirname, 'images', imageName);
    res.sendFile(imagePath);

});

app.get('/download-images', async (req, res) => {
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

        setInterval(updateImages, 3600000);

        res.redirect(`${baseURL}/download-weather`);

    } catch (e){
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
                path: '/weatherapi/locationforecast/2.0/mini.json?lat=59.22&lon=10.33',
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
                path: '/weatherapi/locationforecast/2.0/mini.json?lat=59.22&lon=10.33',
                method: 'GET',
                headers: {
                    'User-Agent' : 'WeatherData/1.0 (driftoslofjordhotell@gmail.com)',
                }
            };
            //console.log("Not using If-Modifed-Since variable");
        }
        
        //console.log("\nDownloading weather data\n");
        await downloadWeatherData(options, weatherPath, weatherDir);
        //console.log("Reading weather data")

        weatherData = await readWeatherData(weatherPath);

        setInterval(() => downloadWeatherData(options, weatherPath, weatherDir), 300000);
        setInterval(() => readWeatherData(weatherPath), 320000);

    } catch (e){
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
            Predicted_weather : "NaN",
            Last_updated : "NaN",
        });
    } else {
        res.json(weatherData);
    }
    
});

function updateImages(){
    debug("Updating images");
    
    fetch(`${baseURL}/update-images`).catch((e) => {
        console.error(`Error: ${e}`);
    });

    app.get('/update-images', async (req, res) => {
        debug("Trying to download images");
        // Set credentials with the refresh token
        oAuth2Client.setCredentials({
            refresh_token: process.env.REFRESH_TOKEN // Retrieve this from your database
        });
    
    
        try {
            try{
                debug("Trying to get images");
                // Use the Google Drive API to list folders
                const drive = google.drive({ version: 'v3', auth: oAuth2Client });
                
                const response = await drive.files.list({
                    q: "mimeType contains 'image/' and (mimeType = 'image/jpeg' or mimeType = 'image/png') and trashed = false",
                    fields: 'nextPageToken, files(id, name, parents)',
                    spaces: 'drive',
                });
    
                debug("Trying to sort through response data");
    
                response.data.files.forEach(function(file){
    
                    if (file.name.includes("Bilde_Elektro")){
                        elektroBilder[file.name] = {
                            file_name : file.name,
                            file_id: file.id
                        };
                        debug("Elektro bilde");
                    } else if (file.name.includes("Bilde_Renovasjon")){
                        renoBilder[file.name] = {
                            file_name : file.name,
                            file_id: file.id
                        };
                        debug("Reno bilde");
                    } else if (file.name.includes("Bilde_Bygg")){
                        byggBilder[file.name] = {
                            file_name : file.name,
                            file_id: file.id
                        };
                        debug("Bygg bilde");
                    } else {
                        usorterteBilder[file.name] = {
                            file_name : file.name,
                            file_id: file.id
                        };
                    }
                    
                    debug(`\nFound file.\nFile name: ${file.name}\nFile ID: ${file.id}\nParent folder: ${file.parents}\n`);
    
                });
    
                debug(`Antall Elektro bilder: ${Object.keys(elektroBilder).length}\nAntall Renovasjons bilder: ${Object.keys(renoBilder).length}\nAntall Bygg bilder: ${Object.keys(byggBilder).length}\nAntall usorterte bilder: ${Object.keys(usorterteBilder).length}`)
            
                const nyesteElektroBilde = getNewestImage(elektroBilder);
                const nyesteRenoBilde = getNewestImage(renoBilder);
                const nyesteByggBilde = getNewestImage(byggBilder);
    
                process.env.ELEKTROBILDE = elektroBilder[nyesteElektroBilde].file_id;
                process.env.RENOVASJONSBILDE = renoBilder[nyesteRenoBilde].file_id;
                process.env.BYGGBILDE = byggBilder[nyesteByggBilde].file_id;
    
                
    
                debug(`\nNyeste elektrobilde: ${nyesteElektroBilde}\nNyeste renobilde: ${nyesteRenoBilde}\nNyeste byggbilde: ${nyesteByggBilde}`);
    
            } catch (e){
                console.error('Error getting a response:', e);
                res.status(500).send('Error getting response.');
            }
        
        } catch (error) {
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
            console.error(`Error while downloading images: ${e}`);
            res.status(500).send("Error downloading images");
        }
    
        res.send("Images updated successfully");
        debug("updateImages finished");
    
    });

    
}

// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
