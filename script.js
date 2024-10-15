document.addEventListener("DOMContentLoaded", function () {
    const cycledContent = document.getElementById('cycledContent');
    var contentJSON = "";
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
    const cycle_content = [
        { type: "Superoffice", url: "https://service.oslofjord.com/scripts/ticket.fcgi?_sf=0&action=mainMenu" },
        { type: "Vaktliste Elektro", url: "https://docs.google.com/document/d/13L3dL9Wc2O47zYmxbM5LiIV-lyJrWuFc6y11aNTeq9M/edit?tab=t.0" },
        { type: "Vaktliste Renovasjon", url: "https://docs.google.com/document/d/1LAMUOZ0JfId6mbSIx6QhZ7x6QskTk85r68E_OAWVLNY/edit?tab=t.0" },
        { type: "Vaktliste Bygg", url: "https://docs.google.com/document/d/1699ljKX_ohgo4iWQbr9lwbwqjwiTyEN_21-vzGD2QeE/edit?tab=t.0" },
        { type: "System status", url: "https://prtg-oslofjord.msappproxy.net/public/mapshow.htm?id=55027&mapid=807498E5-9B2F-4986-959F-8F62EBB7C6E9" },
        { type: "Vær data", url: "https://api.met.no/weatherapi/locationforecast/2.0/mini.json?lat=59.22&lon=10.33" }
    ];

    const cycleTime = 10000;

    let currentIndex = 0;

    function cycleContent() {
        const cycledContent = document.getElementById('cycledContent');
        const contentQueue = document.getElementById('contentQueue');
    
        var currentContent = cycle_content[currentIndex];
        if (currentContent.type == "Vær data"){
            currentContent = cycle_content[(currentIndex + 1) % cycle_content.length]
        }

        //

        if (cycle_content[currentIndex].type == "System status"){
            cycledContent.innerHTML = `<iframe src="${currentContent.url}" width="175%" height="1225px"></iframe>`;
            adjustIframeScale(cycledContent, [700, 100], 0.75);
        } else {
            cycledContent.innerHTML = `<iframe src="${currentContent.url}" width="100%" height="600"></iframe>`;
        }
    
        // Show the full queue of upcoming content
        let queueHTML = '<strong>Upcoming Content:</strong><br>';
        for (let i = 1; i < cycle_content.length; i++) {
            const nextIndex = (currentIndex + i) % cycle_content.length;
            queueHTML += `${i}. ${cycle_content[nextIndex].url}<br>`;
        }
    
        contentQueue.innerHTML = queueHTML;
    
        currentIndex = (currentIndex + 1) % cycle_content.length;
    }

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

        const currentContent = cycle_content[1];

        cycledContent.innerHTML = `<iframe src="${currentContent.url}" width="175%" height="1225px"></iframe>`;
        
        switch(currentContent.url){
            case `${cycle_content[3].url}`:
                adjustIframeScale(cycledContent, [700, 100], 0.75);
                break;
            
            default:
                adjustIframeScale(cycledContent, [700, 100], 1);
        }

        weatherData.innerHTML = `<iframe src="https://api.met.no/weatherapi/locationforecast/2.0/mini.json?lat=59.22&lon=10.33" width="100%" height="100%"</iframe>`;

    }

    //showcontent();

    /*setInterval(cycleContent, cycleTime);
    cycleContent();*/
});
