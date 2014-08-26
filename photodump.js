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
        url  : 'https://photodump.firebaseio.com/',
        hash : hash,
        first: first
    };

    var photodump = new Photodump(options);

});

Photodump = function(options){
    this.firebase = new Firebase(options.url + options.hash);
    this.options  = options;

    this.bar    = $('#bar');
    this.offset = this.bar.height();
    this.stage  = new Photodump.Stage('#window', this.bar, this);
    this.thumbs = {};
    this.images = {};
    this.data   = {};

    this
        .initMessages()
        .initClientEvents()
        .initServerEvents();
};

Photodump.prototype.initMessages = function(){
    if (this.options.first){
        this.welcome = new Photodump.Message(
            'You have created a new photodump.  <br />Drag a photo here to begin.',
            this.stage
        );
    }

    return this;
};

Photodump.Message = function(string, stage){
    this.el = $('<h1 />')
        .html(string)
        .css({
            'position' : 'absolute',
            'top' : '130px', 'left' : 0, 'right': 0
        })
        .appendTo(stage.el);

    return this;
};

Photodump.Message.prototype.clear = function(){
    this.el.remove();
};

Photodump.prototype.initClientEvents = function(){
    var self = this;
    var div  = '<div />';
    var icon = '<i />';

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
            this.stage.el
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
            var dataURI = evt.target.result,
                hash    = this.hash(file.name);

            this.data[hash] = dataURI;
            this.makeThumb(dataURI, function(thumbURI){

                var data = {
                    filename: file.name,
                    thumbURI: thumbURI,
                    hash:     hash
                };

                if (this.welcome) this.welcome.clear();
                this.firebase.push(data);
            }.bind(this));
        }
    }.bind(this);

    return this;
};

Photodump.prototype.initServerEvents = function(){

    this.firebase.on('child_added', function(snapshot){
        var data = snapshot.val();

        // TODO: reclass thumbs and images somehow so that they aren't different things?
        new Photodump.Thumb(data, this);
        new Photodump.Image(data, this);

        if (this.welcome){
            this.welcome.clear();
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

Photodump.Image = function(data, dump){
    this.data = data;
    this.dump = dump;
    this.uri = dump.data[data.hash];

    dump.images[data.hash] = this;

    if (!this.uri){

    } else {

        // Push to server
        // TODO: validation
        // TODO: chunking + progress
        console.log('Uploading ' + data.hash + '...');

        dump.firebase.child('images/' + data.hash).set(this.uri, function(error){
            if (error){
                console.log(error);
            } else {
                console.log('Image upload complete.');
            }
        });
    }
};

Photodump.Thumb = function(data, dump){
    this.data = data;
    this.dump = dump;
    this.dump.thumbs[data.hash] = this;

    this.li = $('<li />').addClass('thumb').appendTo(dump.bar.find('ul'));

    this.append();
    return this;
};

Photodump.Thumb.prototype.append = function(){

    var img = $('<img />')
        .attr('id', this.data.hash)
        .attr('src', this.data.thumbURI)
        .attr('alt', this.data.filename)
        .hide()
        .click(clickHandler.bind(this))
        .appendTo(this.li)
        .fadeIn();

    function clickHandler(evt){
        this.dump.stage.show(this.data.hash);
    }

    return this;
};

// Resize an image's dataURI using canvas and provide the result via callback
// via http://stackoverflow.com/questions/2516117
Photodump.prototype.makeThumb = function(datauri, callback){
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

    img.src = datauri;
};

Photodump.Stage = function(selector, bar, dump){
    this.el = $(selector).addClass('contain');
    this.current = null;
    this.bar = bar;
    this.barHeight = bar.height();
    this.elements = {};
    this.dump = dump;

    return this;
};

Photodump.Stage.prototype.show = function(id){
    if (this.current){
        this.current.removeClass('active');
    }

    this.current = $(id).addClass('active');
    var image = this.dump.images[id];

    if (image){
        var uri = image.uri;

        if (!uri || typeof uri === 'undefined'){

            // Grab URI from server
            this.el.text('Loading...');
            image.ref = new Firebase(this.dump.options.url + this.dump.options.hash + '/images/' + image.data.hash)
                .once('value', function(snap){
                    image.uri = snap.val();
                    console.log('Image loaded.');
                    display(this.el, image.uri);
                }.bind(this));
        } else {
            display(this.el, uri);
        }

    }

    function display(el, uri){
        el
            .text('')
            .css({
                'background-image' : 'url(' + uri + ')'
            });
    }

    return this;
};

Photodump.Stage.prototype.prev = function(){
    this.change('prev');
};

Photodump.Stage.prototype.next = function(){
    this.change('next');
};

Photodump.Stage.prototype.find = function(name, toggle){
    var ele = this.elements[name],
        self = this;

    toggle.forEach(function(d){
        if (self.elements[d] && self.elements[d].hasClass('active')) self[d](d, []);
    });

    if (ele.hasClass('active')){
        this.bar.stop().animate({ 'height' : this.barHeight });
    } else {
        this.bar.stop().animate({ 'height' : this.bar.find('ul').height() });
    }
    ele.toggleClass('active');
};

Photodump.Stage.prototype.full = function(name, toggle){
    var ele = this.elements[name],
        self = this;

    toggle.forEach(function(d){
        if (self.elements[d] && self.elements[d].hasClass('active')) self[d](d, []);
    });

    if (ele.hasClass('active')){
        this.bar.stop().animate({ 'height' : this.barHeight });
    } else {
        this.bar.stop().animate({ 'height' : 0 });
    }
    ele.toggleClass('active');
};

Photodump.Stage.prototype.change = function(direction){
    if (!this.current) return this;
    var img = this.current.parent()[direction]().find('img');

    if (img.length === 0) return this;
    if (img.prop('tagName').toLowerCase() === 'img'){
        this.show(img.attr('id'));
    }
    return this;
};

Photodump.Stage.prototype.play = function(){

};
