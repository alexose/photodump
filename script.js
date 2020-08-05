// Photodump2
// Blazingly fast, dependency-free photo sharing that respects your privacy.

(() => {

// Handle hash
const hash = document.location.hash || createuuid();

// Create Websocket
const ws = new WebSocket('ws://localhost:8083');

const commands = {
    list: ({ results }) => display(results),
    add: ({ src }) => display([src]),
}

// Get all images in dump
ws.onopen = () => ws.send(JSON.stringify({ command: 'list', hash }));
ws.onmessage = ({ data }) => {
    const obj = JSON.parse(data);
    const { command } = obj;
    if (commands[command]){
        commands[command](obj);
    }
    console.log(obj);
}

// Create necessary elements;
const element = document.getElementById('application');
const canvas = document.createElement('canvas');

const aws_url = "https://photodump-aws.s3.amazonaws.com";

// Handle drag and drop
['dragover','drop','dragleave'].forEach(d => { 
    element.addEventListener(d, e => handleDragDrop(d, e)); 
});

function handleDragDrop(name, e) {
    e.preventDefault();
    e.stopPropagation();
    if (name === 'drop') handleFiles(e.dataTransfer.files);
}

function handleFiles(files) {
    Array.prototype.forEach.call(files, d => {
        convert(d, data => {
            upload(data);
        });
    });
}

// Convert image into webp format
// TODO: would be cool to do this in a web worker
function convert(d, cb) {

    // Draw image to offscreen canvas
    var ctx = canvas.getContext('2d');
    var img = new Image;
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const webp = canvas.toDataURL("image/webp");
        cb(webp);
    }
    img.src = URL.createObjectURL(d);
}

// Upload to server 
// TODO: queue
function upload(file) {

    // TODO: send blob instead of string
    const str = JSON.stringify({ command: 'upload', hash, file });
    send(str, function(remaining){
        if (remaining === 0){
           console.log('file sent');
        } else {
           const loaded = file.size - remaining;
           const percentage = Math.round((loaded * 100) / file.size );
           console.log(percentage);
        }
    });
}

// via https://stackoverflow.com/questions/43725260
function send(str, callback) {
    ws.send(str);

    if (callback != null) {
        var interval = setInterval(function () {
            if (ws.bufferedAmount > 0) {
                callback(ws.bufferedAmount);
            } else {
                callback(0)
                clearInterval(interval);
            }
        }, 100);
    }
}

function display(urls) {
    urls.forEach(url => {
        const arr = url.split('/');
        const file = arr.pop();
        const img = document.getElementById(file);
        if (!img) {
            const newImg = document.createElement('img');
            newImg.id = file;
            newImg.src = url;
            element.appendChild(newImg);      
        }
    });
}

// via http://stackoverflow.com/questions/105034
function createuuid() {
    const hash = Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7);
    document.location.hash = hash;
    return hash;
}

})();
