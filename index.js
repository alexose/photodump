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
// Note that most of the heavy lifting happens via websocket, not here
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

const commands = {
    upload: ({ hash, file }, ws) => {
        const dir = hash.split('#').join('');
        
        // Split image into various sizes
        
        // Store them in the cloud somewhere
        persist(file, dir, ws);
    },
    list: ({ hash }, ws) => {
        const prefix = hash.split('#').join('');
        list(prefix, results => {
            ws.send(JSON.stringify({
                command: 'list',
                results: results.map(d => 'https://photodump-aws.s3.us-west-2.amazonaws.com/' + d.Key)
            }));
        });
    }
}

wss.on('connection', ws => {

    ws.on('message', str => {
        const obj = JSON.parse(str);
        const { command } = obj;
        if (commands[command]) { 
            commands[command](obj, ws);
        }
    });

    ws.send(JSON.stringify({ command: 'welcome', text: 'Welcome to Photodump!' }));
});

// Persist data in S3
function persist(file, dir, ws) {
    const params = {
        Bucket: config.bucket,
        Key: `${dir}/${createuuid()}.webp`,
        Body: file,
        ContentEncoding: 'base64',
        ContentType: 'image/webp',
        ACL:'public-read', // TODO: no
    };

    s3.upload(params, (err, data) => {
        if (err) {
            throw err;
        }
        ws.send(JSON.stringify({
            command: 'add',
            src: data.Location,
        }));
        log(`File uploaded successfully. ${data.Location}`);
    });
}

// Get all image URLs in a specified bucket
function list(prefix, cb) {
    const params = { 
        Bucket: config.bucket,
        Prefix: prefix,
    };

    s3.listObjects(params, (err, data) => {
        if (err) {
            throw err;
        }
        cb(data.Contents);
    })
}

// via http://stackoverflow.com/questions/105034
function createuuid() {
    return Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7);
}
