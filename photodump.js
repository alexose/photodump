/*
photodump.js -- A Firebase-backed photo sharing app.
By Alex Ose, alex@alexose.com
*/

var instance;

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

    instance = new Photodump(options);

});

Photodump = function(options){
    this.firebase = new Firebase(options.url + options.hash + '/thumbs');
    this.options  = options;

    this.stage  = $('#main');
    this.box    = $('#box');
    this.images = {};

    this
				.initDb()
        .initUpload()
        .initStage()
        .initModal()
        .initBox()
        .initMessages()
        .initQueue()
        .initStorage()
        .initClientEvents()
        .initServerEvents();
};

Photodump.prototype.initDb = function(){
		if (window.indexedDB){
				var db;

				request = window.indexedDB.open('photodump-' + this.options.hash, 1);

				request.onerror = function(event) {
						console.log('error: ');
				};
				
        request.onsuccess = function(event) {
						db = request.result;
				}
				 
				request.onupgradeneeded = function(event) {
						var db = event.target.result;
						var objectStore = db.createObjectStore('images', {keyPath: 'hash'});
				}

				this.add = function(hash, dataURI){
					if (db){
						var req = db.transaction(['images'], 'readwrite')
							.objectStore('images')
							.add({ hash: hash, dataURI: dataURI });
					}
				}

				this.read = function(hash, cb){
					if (db){
						var transaction = db.transaction(['images'])
						var store = transaction.objectStore('images');
						var req = store.get(hash);
						req.onsuccess = function(event) {
              var dataURI = req.result && req.result.dataURI ? req.result.dataURI : false;
							cb(dataURI);
						};
						req.onerror = function(event) {
							cb(false);
						};
					}
				}
		}
		return this;
};

Photodump.prototype.initUpload = function(){
  $('#upload')
    .click(function(evt){
      evt.stopPropagation();
    })
    .change(function(evt){
      var files = evt.target.files;
      if (files){
        document.ondrop(evt, files);
      }
    });

  return this;
}

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

Photodump.prototype.initBox = function(){

    var box = this.box,
        modal = this.modal;

    box.click(function(evt){
        if (modal.find('img').size() > 0){
            modal.empty();
        }
    });
    return this;
};

Photodump.prototype.initMessages = function(){
    if (this.options.first){
        this.welcome = this.message(
            'You have created a new photodump.<br />Drag a photo here to begin.'
        );
    }

    return this;
};

Photodump.prototype.initQueue = function(){

    this.queues = {
        upload : new Photodump.Queue(),
        download : new Photodump.Queue()
    };

    return this;
};

Photodump.prototype.initStorage = function(){

    this.storage = localStorage;
    return this;
};

Photodump.prototype.message = function(str){
    var ele = $('<h1 />')
        .html(str)
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
    document.ondrop = function(evt, files){
        evt.stopPropagation();
        evt.preventDefault();
        dragover.hide();

        files = files || evt.dataTransfer.files;

        for (var i = 0; i < files.length; i++) {
            var reader = new FileReader(),
                file = files[i];

            reader.onload = process.bind(this, file);
            reader.readAsDataURL(file);
        }

        function process(file, evt){
            var imageURI = evt.target.result,
                hash = this.hash(file.name + file.size);

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

						// See if we have the image in the db
						if (this.read){
							this.read(hash, function(result){
								this.images[hash] = new Photodump.Image(result, uri, total, hash, this);
							}.bind(this));	
						} else {
							this.images[hash] = new Photodump.Image(null, uri, total, hash, this);
						}

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
    } else {

        // Create thumb
        this.makeThumb(function(thumbURI){
            this.thumbURI = thumbURI;
            this.append();
            this.upload();

            // Record full image in db
            if (dump.add){
              dump.add(this.hash, this.imageURI);
            }
        }.bind(this));
    }

    return this;
};

// Download main image from firebase
Photodump.Image.prototype.download = function(onIncrement){

    var queue = this.dump.queues.download,
        self = this;

    queue.add(function(onFinish){

        // Firebase has an ugly tendency to download everything before it throws
        // a whole bunch of child_added events.  With that in mind, we're going to
        // set up a stream!
        var chunks = [];

        (function get(count, arr){
            var started = new Date();
            var q = self.firebase.startAt(null, 'chunk-' + count).limit(1);
            
            q.on('value', function(snapshot){

                var val = snapshot.val(),
                    chunk = val['chunk-' + count];

                arr.push(chunk);

                count += 1;
                self.setShade(count / self.total);

                if (count >= self.total){
                    self.imageURI = arr.join('');
                   
                    if (self.dump.add){
                      self.dump.add(self.hash, self.imageURI);
                    }

                    onFinish();
                    return;
                }
                var finished = new Date();
                var time = (finished - started) / 1000;
                console.log('Chunk ' + count + ' downloaded. (' + chunk.length + ' bytes, ' + time + ' seconds)');
                q.off()
                get(count, arr);
          });
        })(0, []);
    });
};

// Upload main image to firebase
Photodump.Image.prototype.upload = function(onIncrement){

    var queue = this.dump.queues.upload,
        self = this;

    onIncrement = onIncrement || function(){};

    queue.add(function(onFinish){

        console.log('Uploading ' + self.hash + '...');

        var hash = self.hash,
            setShade = self.setShade.bind(self);

        // Chunk image
        var arr = self.chunk(self.imageURI),
            total = arr.length,
            firebase = self.firebase;

        // Save thumb
        self.dump.firebase.child(self.hash).set({
            hash : hash,
            uri : self.thumbURI,
            total : total
        });

        // Save image
        (function upload(arr, count){

            setShade(count / total);

            if (!arr.length){
                console.log('Upload complete');
                onFinish();
                return;
            }

            var chunk = arr.shift();

            firebase.child('chunk-' + count).set(chunk, function(){
                console.log('Chunk ' + count + ' complete.');
                count += 1;
                upload(arr, count);
            });
        })(arr, 0);
    });

    return this;
};

// Chunk a string into N-sized pieces
Photodump.Image.prototype.chunk = function(string){

    var size = 1024 * 200, // TODO: make this adaptive
        regex = new RegExp('.{1,' + size + '}', 'g');

    return string.match(regex);
};

// Append to stage
Photodump.Image.prototype.append = function(){

    this.shade = $('<div class="shade" />');

    this.element = $('<li />')
        .addClass('thumb')
        .append(
            $('<div class="wrap" />')
                .append(
                    $('<img />')
                        .attr('src', this.thumbURI)
                        .attr('alt', this.filename)
                )
                .append(this.imageURI ? null : this.shade)
        )
        .hide()
        .css('display', 'block')
        .fadeIn()
        .click(clickHandler.bind(this))
        .appendTo(this.dump.stage);

    function clickHandler(evt){
        evt.stopPropagation();
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
        this.download();
    }
};

// Resize an image's dataURI using canvas and provide the result via callback
// via http://stackoverflow.com/questions/2516117
Photodump.Image.prototype.makeThumb = function(callback){

    var img = new Image();

    img.onload = function(){
        var canvas = document.createElement("canvas");

        // Resize entire image if it's over an arbitrary size.
        // TODO: this probably belongs somewhere else
        var full = this.getDimensions(3000, 3000, img);
        canvas.getContext("2d").drawImage(img, 0, 0, full.width, full.height);

        if (full.width < img.width || full.height < img.height){
          canvas.width = full.width;
          canvas.height = full.height;
          canvas.getContext("2d").drawImage(img, 0, 0, full.width, full.height);
          console.log('Resized extremely large image from ' + img.width + 'x' + img.height + ' to ' + full.width + 'x' + full.height + '.');
          this.imageURI = canvas.toDataURL('image/jpeg');
        }

        var thumb = this.getDimensions(140, 90, img);

        canvas.width = thumb.width;
        canvas.height = thumb.height;
        canvas.getContext("2d").drawImage(img, 0, 0, thumb.width, thumb.height);
        callback(canvas.toDataURL('image/jpeg'));
    }.bind(this);

    img.src = this.imageURI;
};


// A queue allows us to add a list of functions to be executed one-at-a-time.
// Note that in order to be queued, a function /must/ take a callback as its
// final argument!
Photodump.Queue = function(){
    this.arr = [];
    this.running = false;
};

Photodump.Queue.prototype.add = function(func, args, context){

    if (args && args.length){
        args = Array.prototype.slice.call(arguments);
    } else {
        args = [];
    }

    // Add callback argument
    args.push(this.run.bind(this));

    this.arr.push({
        func : func,
        args : args,
        context : context || this
    });

    // Automatically start if we're not running
    if (!this.running){
        this.run();
    }
};

Photodump.Queue.prototype.remove = function(func){

};

Photodump.Queue.prototype.run = function(){
    if (this.arr.length){
        var obj = this.arr.shift();
        obj.func.apply(obj.context, obj.args);

        this.running = true;
    } else {
        this.running = false;
    }
};

/* Secret static methods! */

// Saves any available imageURIs as a zip
Photodump.prototype.saveAll = function(){

    var self = this;

    $.when(
        $.getScript('lib/jszip.min.js'),
        $.getScript('lib/FileSaver.js')
    ).done(function proceed(){
        var zip = new JSZip();

        for (var prop in self.images){
            var image = self.images[prop];

            if (image.imageURI){

                // Remove mimetype stuff
                var uri = image.imageURI,
                    stripped = uri.substr(uri.indexOf(',') + 1);

                // TODO: support actual file name instead of hashes
                zip.file(image.hash + '.jpg', stripped, { base64 : true });
            }
        }

        var content = zip.generate({type:"blob"});

        // see FileSaver.js
        saveAs(content, self.options.hash + '.zip');
    });
};

// Return a new height and width based on dimensions
// via http://stackoverflow.com/questions/3971841
Photodump.Image.prototype.getDimensions = function(maxWidth, maxHeight, img){
    var ratio =  Math.min(maxWidth / img.width, maxHeight / img.height),
        width = Math.round(img.width * ratio),
        height = Math.round(img.height * ratio);

    return { width: width, height: height };
}

