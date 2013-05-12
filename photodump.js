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
        first: first,
        controls: [
            { name : 'prev', icon : 'backward' },
            { name : 'play', icon : 'play'     },
            { name : 'next', icon : 'forward'  },
            { name : 'find', icon : 'th', toggle : ['full'] },
            { name : 'full', icon : 'fullscreen', toggle : ['find'] }
        ]
    }
    var photodump = new Photodump(options);
    
});

Photodump = function(options){
    this.firebase = new Firebase(options.url + options.hash);
    this.options  = options;
    
    this.bar    = $('#bar');
    this.offset = this.bar.height();
    this.stage  = new Photodump.Stage('#window', this.bar) 
    this.thumbs = {}
    
    this
        .initMessages()
        .initClientEvents()
        .initServerEvents();
}

Photodump.prototype.initMessages = function(){
    if (this.options.first){
        this.welcome = $('<h1 />')
            .html('You have created a new photodump.  <br />Drag a photo here to begin.')
            .css({
                'position' : 'absolute',
                'top' : '130px', 'left' : 0, 'right': 0
            });
        this.stage.el.append(this.welcome);
    }

    return this;
}

Photodump.prototype.initControls = function(){
    var div  = '<div />',
        icon = '<i />',
        self = this;

    this.controls = true;

    this.options.controls.forEach(function(d){
        $(div)
            .addClass(d.name)
            .click($.proxy(function(evt){ 
                var ele = $(evt.target);
                self.stage.elements[d.name] = ele;
                self.stage[d.name](d.name, d.toggle); 
            }, self))
            .mousedown(function(){ return false; }) // Prevent selection on double click
            .appendTo('#controls')
            .append(
                $(icon).addClass('icon-' + d.icon)
            )
    });
    return this;
}

Photodump.prototype.initClientEvents = function(){
    var self = this;
    var div  = '<div />';
    var icon = '<i />';

    // Dragover icon for visual feedback
    var size = '128px';
    var dragover = $(div)
        .addClass('dragover')
        .css({
            'position' : 'absolute',
            'z-index': '1002',
            'pointer-events': 'none',
            'width' : size, 
            'height': size,
            'font-size': size,
            'display': 'none'
        })
        .append(
            $(icon).addClass('icon-plus-sign')
        )
        .appendTo(
            this.stage.el
        )

    document.ondragover = function(evt, file){
        evt.stopPropagation();
        evt.preventDefault();
        dragover.show()
            .css({
                top  : evt.y - (parseInt(size, 10)/2) - self.offset,
                left : evt.x - (parseInt(size, 10)/2)
            });
    };
    
    document.ondragout = function(evt, file){
        // dragover.hide(); 
    };

    // Drop event listener 
    document.ondrop = function(evt, file){
        evt.stopPropagation();
        evt.preventDefault();
        dragover.hide(); 
        
        var files = evt.dataTransfer.files;

        for (var i = 0; i < files.length; i++) {
            var reader = new FileReader(),
                file = files[i];
            
            reader.onload = function(theFile){
                
                // First, create thumbnail and push that to firebase.
                var dataURI =  theFile.target.result,
                    data = {
                        filename : file.name, 
                        dataURI  : dataURI 
                    },
                    thumb = new Photodump.Thumb(data),
                    response = self.firebase.push(data);
                
                if (response.toString){
                    thumb.id = response.toString().split('/').pop();

                    
                    // Second, queue the full image for upload
                    // TODO: resize this one also
                    response.update({ 
                        dataURI  : dataURI
                    }, function(){
                       console.log('full image complete!');
                    });
                } else {
                    // TODO: Display error
                }


            };
            reader.readAsDataURL(file);
        }
    };

    return this;
}

Photodump.prototype.initServerEvents = function(){
    var self = this;

    this.firebase.on('child_added', function(snapshot){
        var data = snapshot.val();

        // Piggyback off of firebase's unique-ish IDs 
        data.id = self.refToId(snapshot.ref());
        console.log(data);
        if (data.thumbURI && !data.dataURI){

            // Only a thumb is available at this point
            var thumb = new Photodump.Thumb(data, self.stage);
            $('#thumbs').append(thumb.li);
        } else if (data.dataURI){
            
            // A full image is available

        } else {
            // Something went wrong
        }
        
        if (self.welcome){
            self.welcome.remove();
            delete self.welcome;
        }
    });
    return this;
}

Photodump.prototype.refToId = function(ref){
    return ref.toString().split('/').pop();
}

Photodump.Thumb = function(data, stage){
    var self = this;
    this.li = $('<li />').addClass('thumb');
    this.id = null; 
    this.dataURI = data.dataURI;

    if (this.dataURI){
        this.makeThumb(data.dataURI, function(thumbURI){
            self.thumbURI = thumbURI;
            var img = $('<img />')
                .attr('id', self.id)
                .attr('src', thumbURI)
                .attr('alt', data.filename)
                .hide()
                .appendTo(self.li)
                .fadeIn();
            
            function clickHandler(evt){
                stage.show(self.id);
            }
        });
    }

    return this;
}

// Resize an image's dataURI using canvas and provide the result via callback
// via http://stackoverflow.com/questions/2516117
Photodump.Thumb.prototype.makeThumb = function(datauri, callback){
    var img = new Image(),
        width = 120,
        height = 80;
    
    img.onload = function() {
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL());
    }

    img.src = datauri;
}

Photodump.Stage = function(selector, bar){
    this.el = $(selector).addClass('contain');
    this.current = null;
    this.bar = bar;
    this.barHeight = bar.height();
    this.elements = {};

    return this;
}

Photodump.Stage.prototype.show = function(id){
    id = id.substr(0,1) === "#" ? id : '#' + id;
    if (this.current)
        this.current.removeClass('active');

    var img = this.current = $(id);

    img.addClass('active');

    this.el.css({
        'background-image' : 'url(' + img.attr('src') + ')' 
    });
    return this;
}

Photodump.Stage.prototype.prev = function(){
    this.change('prev');
}

Photodump.Stage.prototype.next = function(){
    this.change('next');
}

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
}

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
}

Photodump.Stage.prototype.change = function(direction){
    if (!this.current) return this;
    var img = this.current.parent()[direction]().find('img');
    
    if (img.length === 0) return this;
    if (img.prop('tagName').toLowerCase() === 'img'){
        this.show(img.attr('id'));
    }
    return this;
}

Photodump.Stage.prototype.play = function(){
    
}

