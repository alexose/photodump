/*
photodump.js -- A Firebase-backed photo sharing app.
By Alex Ose, alex@alexose.com
*/

$(document).ready(function(){
    var hash = window.location.hash;
    hash = hash.substr(1,hash.length);
    var first = false;
    if (hash === ""){

        // Generate a new hash
        // TODO: security
        hash = window.location.hash = Math.random().toString(36).substr(2);
        first = true;
    }

    var options = {
        url:   'https://photodump.firebaseio.com/',
        hash:  hash,
        first: first
    };

    var photodump = new Photodump(options);

});

Photodump = function(options){
    this.firebase = new Firebase(options.url + options.hash + '/thumbs');
    this.options  = options;

    this.stage  = $('#main');
    this.box    = $('#box');
    this.images = {};

    this
        .initStage()
        .initModal()
        .initMessages()
        .initClientEvents()
        .initServerEvents();
};

Photodump.prototype.initStage = function(){

    this.ul = $('<ul />')
        .appendTo(this.stage);

    return this;
};

Photodump.prototype.initModal = function(){

    this.modal = $('<div class="modal" />')
        .appendTo(this.box);

    return this;
};

Photodump.prototype.initMessages = function(){
    if (this.options.first){
        this.welcome = this.message(
            'You have created a new photodump.  <br />Drag a photo here to begin.'
        );
    }

    return this;
};

Photodump.prototype.message = function(str){
    var ele = $('<h1 />')
        .text(str)
        .appendTo(this.stage);

    return ele;
};

Photodump.prototype.initClientEvents = function(){
    var self = this,
        div  = '<div />',
        icon = '<i />';

    // Dragover icon for visual feedback
    var size = '128px';
    var dragover = $(div)
        .addClass('dragover')
        .css({
            'position':       'absolute',
            'z-index':        '1002',
            'pointer-events': 'none',
            'width':          size,
            'height':         size,
            'font-size':      size,
            'display':        'none'
        })
        .append(
            $(icon).addClass('icon-plus-sign')
        )
        .appendTo(
            this.stage
        );

    document.ondragover = function(evt, file){
        evt.stopPropagation();
        evt.preventDefault();
        dragover.show()
            .css({
                top  : evt.y - (parseInt(size, 10)/2),
                left : evt.x - (parseInt(size, 10)/2)
            });
    };

    document.ondragout = function(evt, file){
        // dragover.hide();
    };

    // Drop event listener
    document.ondrop = function(evt){
        evt.stopPropagation();
        evt.preventDefault();
        dragover.hide();

        var files = evt.dataTransfer.files;

        for (var i = 0; i < files.length; i++) {
            var reader = new FileReader(),
                file = files[i];

            reader.onload = process.bind(this, file);
            reader.readAsDataURL(file);
        }

        function process(file, evt){
            var imageURI = evt.target.result,
                hash    = this.hash(file.name);

            this.images[hash] = new Photodump.Image(imageURI, null, null, hash, this);
        }
    }.bind(this);

    return this;
};

Photodump.prototype.initServerEvents = function(){

    this.firebase.on('child_added', function(snapshot){
        var data = snapshot.val(),
            uri = data.uri,
            total = data.total,
            hash = data.hash;

        if (!this.images[hash]){
            this.images[hash] = new Photodump.Image(null, uri, total, hash, this);
        }

        if (this.welcome){
            this.welcome.empty();
        }
    }.bind(this));

    return this;
};

// Generic hash function
// TODO: Improve this
Photodump.prototype.hash = function(string){
    return string.replace(/[^a-zA-Z 0-9]+/g, '') + Math.ceil(Math.random()*(10e9));
};

Photodump.prototype.refToId = function(ref){
    return ref.toString().split('/').pop();
};

// Image instances can be constructed from either a full-size URI or a thumb URI.
// In each case, they behave slightly differently.
Photodump.Image = function(imageURI, thumbURI, total, hash, dump){

    this.imageURI = imageURI;
    this.thumbURI = thumbURI;
    this.total = total;
    this.hash = hash;
    this.dump = dump;

    var options = dump.options,
        setShade = this.setShade.bind(this);

    this.firebase = new Firebase(options.url + options.hash + '/image-' + hash);

    if (thumbURI){

        // If we already have a thumbnail, it's because it's already on the server

        // Append thumb
        this.append();
        this.download();
    } else {

        // Create thumb
        this.makeThumb(function(thumbURI){
            this.thumbURI = thumbURI;
            this.append();
            this.upload();
        }.bind(this));
    }

    return this;
};

// Download main image from firebase
Photodump.Image.prototype.download = function(onIncrement){

    // Firebase has an ugly tendency to download everything before it throws
    // a whole bunch of child_added events.  With that in mind, we're going to
    // set up a stream!

    var self = this,
        chunks = [];

    // TODO: add to queue
    (function get(count, arr){
      self.firebase.startAt(null, 'chunk-' + count).limit(1).on('value', function(snapshot){

          var val = snapshot.val(),
              chunk = val['chunk-' + count];

          arr.push(chunk);

          count += 1;
          self.setShade(count / self.total);

          if (count >= self.total){
              self.imageURI = arr.join('');
              return;
          }
          get(count, arr);
      });

    })(0, []);
};

// Upload main image to firebase
Photodump.Image.prototype.upload = function(onIncrement){

    onIncrement = onIncrement || function(){};

    console.log('Uploading ' + this.hash + '...');

    var hash = this.hash,
        setShade = this.setShade.bind(this);

    // Chunk image
    var arr = this.chunk(this.imageURI),
        total = arr.length,
        firebase = this.firebase;

    // Save thumb
    this.dump.firebase.child(this.hash).set({
        hash : hash,
        uri : this.thumbURI,
        total : total
    });

    // Save image
    (function upload(arr, count){

        setShade(count / total);

        if (!arr.length){
            console.log('Upload complete');
            return;
        }

        var chunk = arr.shift();

        firebase.child('chunk-' + count).set(chunk, function(){
            console.log('Chunk ' + count + ' complete.');
            count += 1;
            upload(arr, count);
        });

    })(arr, 0);

    return this;
};

// Chunk a string into N-sized pieces
Photodump.Image.prototype.chunk = function(string){

    var size = 1024 * 20, // TODO: make this adaptive
        regex = new RegExp('/.{1,' + size + '}/', 'g');

    return string.match(regex);
};

// Append to stage
Photodump.Image.prototype.append = function(){

    this.shade = $('<div class="shade" />');

    this.element = $('<li />')
        .addClass('thumb')
        .append(
            $('<img />')
                .attr('src', this.thumbURI)
                .attr('alt', this.filename)
        )
        .append(this.shade)
        .hide()
        .fadeIn()
        .click(clickHandler.bind(this))
        .appendTo(this.dump.stage);

    function clickHandler(evt){
        this.show(this.data);
    }
};

// Update shade according to progress
Photodump.Image.prototype.setShade = function(progress){
    this.shade.css('left', this.element.width() * progress);
    return;
};

// Show in modal
Photodump.Image.prototype.show = function(){

    if (this.imageURI){
        this.dump.modal
            .empty()
            .append(
                $('<img />')
                    .attr('src', this.imageURI)
            )
            .show();
    } else {

        // TODO: move forward in queue

    }
};

// Resize an image's dataURI using canvas and provide the result via callback
// via http://stackoverflow.com/questions/2516117
Photodump.Image.prototype.makeThumb = function(callback){

    var img = new Image(),
        height = 90,
        width = 140;

    img.onload = function() {
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL());
    };

    img.src = this.imageURI;
};
