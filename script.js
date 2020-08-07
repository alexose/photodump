// Photodump2
// Blazingly fast, dependency-free photo sharing that respects your privacy.

(() => {

const aws_url = "https://photodump-aws.s3.amazonaws.com";

// Handle hash
const hash = document.location.hash || createuuid();

// Create Websocket
const ws = new WebSocket('ws://localhost:8083');

const commands = {
    list: ({ data }) => display(data),
    add: ({ data }) => display(data),
    progress: (data) => progress(data)
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

    // First, generate & upload thumbnails
    const thumbnails = {};
    const arr = Array.from(files);

    arr.forEach((d, i) => {
        convert(d, 450, 450, data => {
            thumbnails[i] = {
                name: md5(d.name + d.lastModified + data), 
                src: data
            };
            if (Object.keys(thumbnails).length == files.length) {

                // Rapid-fire upload thumbnails to the server
                const arr = Object.keys(thumbnails);
                
                (function iterate(i) {
                    if (thumbnails[i]) {
                        upload('thumbnail', thumbnails[i], () => iterate(i+1)); 
                    } else {
                        next();
                    }
                })(0);
            }
        });
    });

    // Next, convert and upload the resized originals
    function next() {
        (function iterate(i) {
            const file = arr[i];
            if (file) {
                chunkedUpload(file, thumbnails[i].name, () => {
                    iterate(i+1);
                });
            } else {
                console.log('Done!');
            }
        })(0);
    }

    // TODO: If requested, upload the originals
}

// Divide a file into chunks and upload them sequentially to the server
function chunkedUpload(file, name, cb) {

    // This should scale based on the client's bandwidth, I think
    const size = 1024 * 100;
    const total = Math.ceil(file.size / size);
    const reader = new FileReader();

    (function iterate(i) {
        const chunk = file.slice(i, i+size);
        if (chunk.size) {
            reader.readAsDataURL(chunk);
            reader.onloadend = () => {
                console.log(reader.result.split(',')[1].length);
                send(JSON.stringify({
                   command: 'upload_chunk',
                   name,
                   hash,
                   total,
                   chunk: reader.result.split(',')[1]
                }), () => {
                    iterate(i += size)
                });
            };
        } else {
            cb();
        }
    })(0);
}

// Convert image into webp format
// TODO: would be cool to do this in a web worker
// TODO: how to handle massively huge images?
function convert(d, w, h, cb) {

    // Draw image to offscreen canvas
    var ctx = canvas.getContext('2d');
    var img = new Image;
    img.onload = function() {

        // Resize as necessary
        let ratio = w && h ? Math.min(w / img.width, h / img.height) : 1; 

        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const webp = canvas.toDataURL("image/webp");
        cb(webp);
    }
    img.src = URL.createObjectURL(d);
}

// Upload to server 
// TODO: queue
function upload(type, file, cb) {

    // TODO: send blob instead of string
    const str = JSON.stringify({ command: 'upload_' + type, hash, file });
    send(str, function(remaining){
        if (remaining === 0){
            if (typeof cb === 'function') {
                cb();
            }
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

function display(data) {
    const { name, url, complete, src } = data;
    const img = document.getElementById(name);
    if (!img) {
        const container = document.createElement('div');
        const dir = hash.split('#').join('');

        container.id = name;
        container.className = 'thumb';
        container.onclick = e => {
            window.location = `${aws_url}/${dir}/${name}.webp` 
        };

        const shade = document.createElement('div');
        shade.className = 'shade';
        shade.style.width = (100 - complete) + '%';
        container.appendChild(shade);
        
        const image = document.createElement('img');
        image.src = src;
        container.appendChild(image);

        
        element.appendChild(container);      
    }
}

// Handle progress
function progress(data) {
    const thumb = document.getElementById(data.name);
    thumb.children[0].style.width = data.complete + '%';
}

// via http://stackoverflow.com/questions/105034
function createuuid() {
    const hash = Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7);
    document.location.hash = hash;
    return hash;
}

// via https://stackoverflow.com/questions/1655769 
function md5(inputString) {
    var hc="0123456789abcdef";
    function rh(n) {var j,s="";for(j=0;j<=3;j++) s+=hc.charAt((n>>(j*8+4))&0x0F)+hc.charAt((n>>(j*8))&0x0F);return s;}
    function ad(x,y) {var l=(x&0xFFFF)+(y&0xFFFF);var m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&0xFFFF);}
    function rl(n,c)            {return (n<<c)|(n>>>(32-c));}
    function cm(q,a,b,x,s,t)    {return ad(rl(ad(ad(a,q),ad(x,t)),s),b);}
    function ff(a,b,c,d,x,s,t)  {return cm((b&c)|((~b)&d),a,b,x,s,t);}
    function gg(a,b,c,d,x,s,t)  {return cm((b&d)|(c&(~d)),a,b,x,s,t);}
    function hh(a,b,c,d,x,s,t)  {return cm(b^c^d,a,b,x,s,t);}
    function ii(a,b,c,d,x,s,t)  {return cm(c^(b|(~d)),a,b,x,s,t);}
    function sb(x) {
        var i;var nblk=((x.length+8)>>6)+1;var blks=new Array(nblk*16);for(i=0;i<nblk*16;i++) blks[i]=0;
        for(i=0;i<x.length;i++) blks[i>>2]|=x.charCodeAt(i)<<((i%4)*8);
        blks[i>>2]|=0x80<<((i%4)*8);blks[nblk*16-2]=x.length*8;return blks;
    }
    var i,x=sb(inputString),a=1732584193,b=-271733879,c=-1732584194,d=271733878,olda,oldb,oldc,oldd;
    for(i=0;i<x.length;i+=16) {olda=a;oldb=b;oldc=c;oldd=d;
        a=ff(a,b,c,d,x[i+ 0], 7, -680876936);d=ff(d,a,b,c,x[i+ 1],12, -389564586);c=ff(c,d,a,b,x[i+ 2],17,  606105819);
        b=ff(b,c,d,a,x[i+ 3],22,-1044525330);a=ff(a,b,c,d,x[i+ 4], 7, -176418897);d=ff(d,a,b,c,x[i+ 5],12, 1200080426);
        c=ff(c,d,a,b,x[i+ 6],17,-1473231341);b=ff(b,c,d,a,x[i+ 7],22,  -45705983);a=ff(a,b,c,d,x[i+ 8], 7, 1770035416);
        d=ff(d,a,b,c,x[i+ 9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,     -42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
        a=ff(a,b,c,d,x[i+12], 7, 1804603682);d=ff(d,a,b,c,x[i+13],12,  -40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);
        b=ff(b,c,d,a,x[i+15],22, 1236535329);a=gg(a,b,c,d,x[i+ 1], 5, -165796510);d=gg(d,a,b,c,x[i+ 6], 9,-1069501632);
        c=gg(c,d,a,b,x[i+11],14,  643717713);b=gg(b,c,d,a,x[i+ 0],20, -373897302);a=gg(a,b,c,d,x[i+ 5], 5, -701558691);
        d=gg(d,a,b,c,x[i+10], 9,   38016083);c=gg(c,d,a,b,x[i+15],14, -660478335);b=gg(b,c,d,a,x[i+ 4],20, -405537848);
        a=gg(a,b,c,d,x[i+ 9], 5,  568446438);d=gg(d,a,b,c,x[i+14], 9,-1019803690);c=gg(c,d,a,b,x[i+ 3],14, -187363961);
        b=gg(b,c,d,a,x[i+ 8],20, 1163531501);a=gg(a,b,c,d,x[i+13], 5,-1444681467);d=gg(d,a,b,c,x[i+ 2], 9,  -51403784);
        c=gg(c,d,a,b,x[i+ 7],14, 1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);a=hh(a,b,c,d,x[i+ 5], 4,    -378558);
        d=hh(d,a,b,c,x[i+ 8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16, 1839030562);b=hh(b,c,d,a,x[i+14],23,  -35309556);
        a=hh(a,b,c,d,x[i+ 1], 4,-1530992060);d=hh(d,a,b,c,x[i+ 4],11, 1272893353);c=hh(c,d,a,b,x[i+ 7],16, -155497632);
        b=hh(b,c,d,a,x[i+10],23,-1094730640);a=hh(a,b,c,d,x[i+13], 4,  681279174);d=hh(d,a,b,c,x[i+ 0],11, -358537222);
        c=hh(c,d,a,b,x[i+ 3],16, -722521979);b=hh(b,c,d,a,x[i+ 6],23,   76029189);a=hh(a,b,c,d,x[i+ 9], 4, -640364487);
        d=hh(d,a,b,c,x[i+12],11, -421815835);c=hh(c,d,a,b,x[i+15],16,  530742520);b=hh(b,c,d,a,x[i+ 2],23, -995338651);
        a=ii(a,b,c,d,x[i+ 0], 6, -198630844);d=ii(d,a,b,c,x[i+ 7],10, 1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);
        b=ii(b,c,d,a,x[i+ 5],21,  -57434055);a=ii(a,b,c,d,x[i+12], 6, 1700485571);d=ii(d,a,b,c,x[i+ 3],10,-1894986606);
        c=ii(c,d,a,b,x[i+10],15,   -1051523);b=ii(b,c,d,a,x[i+ 1],21,-2054922799);a=ii(a,b,c,d,x[i+ 8], 6, 1873313359);
        d=ii(d,a,b,c,x[i+15],10,  -30611744);c=ii(c,d,a,b,x[i+ 6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21, 1309151649);
        a=ii(a,b,c,d,x[i+ 4], 6, -145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+ 2],15,  718787259);
        b=ii(b,c,d,a,x[i+ 9],21, -343485551);a=ad(a,olda);b=ad(b,oldb);c=ad(c,oldc);d=ad(d,oldd);
    }
    return rh(a)+rh(b)+rh(c)+rh(d);
}
})();
