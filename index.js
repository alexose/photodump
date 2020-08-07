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

const cache = {};
const timeouts = {};
const partials = {};

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
    upload_chunk: ({ hash, name, total, chunk }, ws) => {
        const dir = hash.split('#').join('');

        if (!partials[dir]) partials[dir] = {}; 
        if (!partials[dir][name]) partials[dir][name] = [];

        // Casually assuming these can't come in out of order...
        partials[dir][name].push(chunk);
        const length = partials[dir][name].length;
        if (length === total) {
            const str = partials[dir][name].join('');
            partials[dir][name] = [];
            const buf = new Buffer(str, 'base64');
            const params = {
                Key: `${dir}/${name}.webp`,
                Body: buf,
                ContentEncoding: 'base64',
                ContentType: 'image/webp',
            };

            persist(params, ws, loc => {
                log('File added');
            });
        }

        ws.send(JSON.stringify({ command: 'progress', hash, name, complete: length / total * 100 }));

    },

    upload_thumbnail: ({ hash, file }, ws) => {
        const dir = hash.split('#').join('');
        const data = Object.assign({ complete: 0 }, file);

        ws.send(JSON.stringify({ command: 'add', data }));

        // Store in memory
        if (!cache[dir]) cache[dir] = {};
        cache[dir][file.name] = data;

        // Persist to S3 after one second of inactivity
        // Yes, this should happen in redis or something
        clearTimeout(timeouts[dir]);
        timeouts[dir] = setTimeout(() => {
            s3.getObject({ 
                Bucket: config.bucket,
                Key: `${hash.split('#').join('')}/thumbs.json`,
            }, (err, data) => {
                let thumbs = {};
                if (!err) {
                    // Merge thumbs.json with cache
                    thumbs = Object.assign(cache[dir], JSON.parse(data.Body.toString()));
                } else {
                    thumbs = cache[dir]; 
                }

                // Persist
                const params = {
                    Key: `${dir}/thumbs.json`, 
                    Body: JSON.stringify(thumbs),
                    ContentType: 'text/json',
                };
                persist(params, ws);
            })

        }, 1000);
    },

    list: ({ hash }, ws) => {
        s3.getObject({ 
            Bucket: config.bucket,
            Key: `${hash.split('#').join('')}/thumbs.json`,
        }, (err, data) => {
            if (!err) {
                const obj = JSON.parse(data.Body.toString());

                // Rapid-fire thumbnails off to the client
                Object.keys(obj).forEach(key => {
                    const data = Object.assign(obj[key], { complete: 100 });
                    ws.send(JSON.stringify({ command: 'list', data }));
                });
            }
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
function persist(obj, ws, cb) {
    
    const defaults = {
        Bucket: config.bucket,
        ACL:'public-read', // TODO: no
    }

    const params = Object.assign(defaults, obj);

    s3.upload(params, (err, data) => {
        if (err) {
            throw err;
        }
        if (typeof cb === 'function') {
            cb(data.Location);
        }
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

// via https://stackoverflow.com/questions/6850276
function dataURItoBlob(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], {type: mimeString});
}
