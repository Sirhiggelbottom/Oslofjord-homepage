# Oslofjord-homepage

## Overview

This project is a web application that displays weather data and images. It consists of a backend server that fetches data from external APIs and a frontend client that displays the data.

## Files

### server.js

#### This is the main backend server file. It handles the following tasks:

- Sets up an Express server and WebSocket server.
- Manages OAuth2 authentication with Google Drive.
- Downloads and updates images from Google Drive.
- Fetches and processes weather data from an external weather API.
- Sends updates to connected clients via WebSocket.

### auth.env

This file contains environment variables required for OAuth2 authentication with Google Drive.

### ecosystem.config.js

This file is used by PM2 to manage the application processes. It defines two applications:

- `backend-server`: Runs the `server.js` file.
- `host-server`: Runs a Python HTTP server to serve static files.

### client.js

This is the main frontend client file. It handles the following tasks:

- Establishes a WebSocket connection with the backend server.
- Receives and displays weather data and images.
- Cycles through different content and updates the displayed data periodically.

### index.html

This is the main HTML file for the frontend. It defines the structure of the web page, including containers for displaying weather data and images.

### style.css

This file contains the CSS styles for the frontend. It defines the layout and appearance of the web page, including styles for various elements such as containers, headers, and images.
