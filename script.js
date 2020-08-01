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
    if (name === 'drop') handlefiles(e.dataTransfer.files);
}

function handleFiles(files) {
    Array.prototype.forEach.call(files, d => {
        const converted = convert(d);
    });

    // Add upload into queue;
}

// Convert image into webp format
// TODO: would be cool to do this in a web worker
function convert(d) {
    // Draw image to canvas
    var ctx = canvas.getContext('2d');
    var webp = canvas.toDataURL("image/webp");
}

// Upload to S3
function upload(file) {

}

// via http://stackoverflow.com/questions/105034
function createuuid() {
    const hash = Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7);
    document.location.hash = hash;
    return hash;
}

})();
