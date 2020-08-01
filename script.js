// Photodump2
// Blazingly fast, dependency-free photo sharing that respects your privacy.

(() => {

// Handle hash
const hash = document.location.hash || createuuid();

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
    Array.prototype.forEach.call(files, d => {
        convert(d, data => {
            upload(data);
        });
    });
}

// Convert image into webp format
// TODO: would be cool to do this in a web worker
function convert(d, cb) {

    // Draw image to canvas
    var ctx = canvas.getContext('2d');
    var img = new Image;
    img.onload = function() {
        ctx.drawImage(img, 20, 20);
        const webp = canvas.toDataURL("image/webp");
        cb(webp);
    }
    img.src = URL.createObjectURL(d);
}

// Upload to S3
// TODO: queue
function upload(file) {
    console.log(file);
}

// via http://stackoverflow.com/questions/105034
function createuuid() {
    const hash = Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7);
    document.location.hash = hash;
    return hash;
}

})();
