const http = require('http');
const fs = require('fs');
const ws = require('ws');
const AWS = require('aws-sdk');

const config = require('./config');

const host = 'localhost';
const port = 8082;
const wsport = 8083;
const html = fs.readFileSync('./index.html');
const script = fs.readFileSync('./script.js');
const log = str => console.log(str);

// Initialize S3 interface
const s3 = new AWS.S3({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
});

// Create HTTP server
// Most of the heavy lifting happens below, via the websocket server
http.createServer(function ({url}, res) {
    switch(url){ 
        case '/':
            respond(html, 'text/html');
            break;
        case '/script.js':
            respond(script, 'text/javascript');
            break;
        case '/favicon.ico':
            respond('', 'image/ico');
            break;
        default:
            respond('404', 'text/plain', 404);
    }

    function respond(body, type, code=200) {
        res.writeHead(code, {'Content-Type': type});
        res.write(body);
        res.end();
    }

}).listen(port, () => {
    log(`HTTP server listening at http://${host}:${port}`)
});

// Create socket server
const wss = new ws.Server({
    port: wsport,
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
    }
}, () => {
    log(`Sockets enabled at ws://${host}:${wsport}`)
});

wss.on('connection', ws => {

    // Receive upload
    ws.on('message', str => {
        const obj = JSON.parse(str);
        const dir = obj.hash.split('#').join('');
        // Split image into various sizes
        // Store them in the cloud somewhere
        persist(obj.file, dir);
    });

    ws.send('Welcome to Photodump!');
});

// Persist data in S3
function persist(file, dir) {
    const params = {
        Bucket: config.bucket,
        Key: `${dir}/${createuuid()}.webp`,
        Body: file,
        ContentEncoding: 'base64',
        ContentType: 'image/webp',
        ACL:'public-read', // TODO: no
    };

    s3.upload(params, function(err, data) {
        if (err) {
            throw err;
        }
        console.log(`File uploaded successfully. ${data.Location}`);
    });
}

// via http://stackoverflow.com/questions/105034
function createuuid() {
    return Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7);
}
