document.addEventListener("DOMContentLoaded", function () {
    const cycledContent = document.getElementById('cycledContent');
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
        { type: 'excel', url: '2024-Arrangementer-Vaktplan.xlsx' },
        { type: 'excel', url: 'https://oslofjord.sharepoint.com/:x:/s/Felles2/EW_yqOUxicRGjyesjhgyJUYBFKJOs01kAyrAdcSIxZiYmg?e=3LYZJS' },
        { type: 'website', url: 'https://service.oslofjord.com/scripts/ticket.fcgi?_sf=0&action=mainMenu' },
        { type: 'website', url: 'https://prtg-oslofjord.msappproxy.net/public/mapshow.htm?id=55027&mapid=807498E5-9B2F-4986-959F-8F62EBB7C6E9' }
    ];

    const cycleTime = 10000;

    let currentIndex = 0;

    function cycleContent() {
        const cycledContent = document.getElementById('cycledContent');
        const contentQueue = document.getElementById('contentQueue');
    
        const currentContent = content[currentIndex];
        cycledContent.innerHTML = `<iframe src="${currentContent.url}" width="100%" height="600"></iframe>`;
    
        // Show the full queue of upcoming content
        let queueHTML = '<strong>Upcoming Content:</strong><br>';
        for (let i = 1; i < content.length; i++) {
            const nextIndex = (currentIndex + i) % content.length;
            queueHTML += `${i}. ${content[nextIndex].url}<br>`;
        }
    
        contentQueue.innerHTML = queueHTML;
    
        currentIndex = (currentIndex + 1) % content.length;
    }
    
    /*function getAuthdata(){
        var result = {};
        try{
            fetch("auth_config.json")
                .then(response => response.text())
                .then(data => {
                    
                
                });
        } catch (e){
            cycledContent.innerHTML = `Error when reading authFile: ${e}`;
            return null;
        }
    }

    var authData = getAuthdata();*/
    


    /*

    try {

        var msalConfig = {
            auth: {
                clientId: authData.find(line => line.startsWith("client_id:")).split(":")[1].trim().replace(/^"|"$/g, ''),
                authority: `https://login.microsoftonline.com/${authData.find(line => line.startsWith("tenant_id:")).split(":")[1].trim().replace(/^"|"$/g, '')}`,
                redirectUri: "http://localhost"
            }
        };

        cycledContent.innerHTML = `redirecturl is: ${msalConfig}`;

    } catch (e){
        cycledContent.innerHTML = `Error when reading authfile: ${e}`;
    }
    */

    //cycledContent.innerHTML = msalConfig ? "true" : "false";
    

    

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

        const currentContent = content[3];

        cycledContent.innerHTML = `<iframe src="${currentContent.url}" width="175%" height="1225px"></iframe>`;
        
        switch(currentContent.url){
            case `${content[3].url}`:
                adjustIframeScale(cycledContent, [700, 100], 0.75);
                break;
            
            default:
                adjustIframeScale(cycledContent, [700, 100], 1);
        }

        weatherData.innerHTML = `<iframe src="https://api.met.no/weatherapi/locationforecast/2.0/mini.json?lat=59.22&lon=10.33" width="100%" height="100%"</iframe>`;

    }

    showcontent();

    /*setInterval(cycleContent, cycleTime);
    cycleContent();*/
});
