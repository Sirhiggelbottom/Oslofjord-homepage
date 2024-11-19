module.exports = {
    apps : [{
        name: 'backend-server',
        script: './server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        pre_start: "npm install",
        
    }, {
        name: 'host-server',
        script: 'python3',
        args: '-m http.server 9999',
        instances: 1,
        cwd: '../',
        autorestart: true,
        watch: false
    }],
};