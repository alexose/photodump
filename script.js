// Photodump2
// Blazingly fast, dependency-free photo sharing that respects your privacy.

(() => {

const config = {
    id: createuuid(),
};

// Upload to S3
function upload(file) {

}

// via http://stackoverflow.com/questions/105034
function createuuid() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

})();
