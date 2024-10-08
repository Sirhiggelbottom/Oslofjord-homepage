document.addEventListener("DOMContentLoaded", function () {
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
        { type: 'excel', url: 'https://oslofjord.sharepoint.com/:x:/s/OOP-FDVavdeling/EXpm4Ym9NBNKs51tqOzmEMcBa_-O8ehtt-p9CfL4dpKXAw?e=eVCWV8' },
        { type: 'excel', url: 'https://oslofjord.sharepoint.com/:x:/s/Felles2/EW_yqOUxicRGjyesjhgyJUYBFKJOs01kAyrAdcSIxZiYmg?e=3LYZJS' },
        { type: 'website', url: 'https://service.oslofjord.com/scripts/ticket.fcgi?_sf=0&action=mainMenu' },
        { type: 'website', url: 'https://prtg-oslofjord.msappproxy.net/public/mapshow.htm?id=55027&mapid=807498E5-9B2F-4986-959F-8F62EBB7C6E9' }
    ];

    const cycleTime = 5000; // Time in milliseconds for each content

    let currentIndex = 0;

    function cycleContent() {
        const cycledContent = document.getElementById('cycledContent');
        const contentQueue = document.getElementById('contentQueue');

        const currentContent = content[currentIndex];
        cycledContent.innerHTML = `<iframe src="${currentContent.url}" width="100%" height="100%"></iframe>`;

        const nextIndex = (currentIndex + 1) % content.length;
        contentQueue.innerHTML = `Next: ${content[nextIndex].url}`;

        currentIndex = nextIndex;
    }

    setInterval(cycleContent, cycleTime);
    cycleContent();
});
