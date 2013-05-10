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
        ]
    }
    var photodump = new Photodump(options);
    
});

Photodump = function(options){
    this.firebase = new Firebase(options.url + options.hash);
    this.reader   = new FileReader();
    this.options  = options;
    
    this.bar    = $('#bar');
    this.offset = this.bar.height();
    this.stage  = new Photodump.Stage('#window') 

    this
        .initMessages()
        .initClientEvents()
        .initServerEvents();
}

Photodump.prototype.initMessages = function(){
    if (this.options.first){
        var message = $('<h1 />')
            .html('You have created a new photodump.  <br />Drag a photo here to begin.')
            .css({
                'position' : 'absolute',
                'left' : 0, 'right': 0, 'top': 0
            });
        this.stage.frame.append(message);
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
                self.stage[d.name]() 
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
        
        var files = evt.dataTransfer.files,
            reader = self.reader;

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            
            reader.onload = function(theFile){
                var payload =  theFile.target.result;
                var response = self.firebase.push({filename : file.name, data : payload });
                if (response.toString){
                    var id = response.toString().split('/').pop();
                } else {
                    // TODO: Display error

                }
            };
            self.reader.readAsDataURL(file);
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
        if (data.data){
            var li = new Photodump.Thumb(data, self.stage);
            $('#thumbs').append(li);
        }
        
        if (!self.controls){
            self.initControls();
            self.stage.show('image-' + data.id);
        }
    });
    
    return this;
}

Photodump.prototype.refToId = function(ref){
    return ref.toString().split('/').pop();
}

Photodump.Thumb = function(data, stage){
    var self = this;
    this.id = 'image-' + data.id;

    var tag = 'li';

    var img = $('<img />')
        .attr('id', this.id)
        .attr('src', data.data)
        .attr('alt', data.filename);
    var element = $('<' + tag + '/>')
        .addClass('thumb')
        .click($.proxy(clickHandler, this))
        .hide()
        .append(img)
        .fadeIn();
    
    return element;

    function clickHandler(evt){
        stage.show(this.id);
    }
}

Photodump.Stage = function(selector){
    this.el = $(selector);
    this.current = null;
    this.frame = $('<div />')
        .width('100%').height('100%')
        .appendTo(this.el);

    return this;
}

Photodump.Stage.prototype.show = function(id){
    id = id.substr(0,1) === "#" ? id : '#' + id;
    if (this.current)
        this.current.removeClass('active');

    var img = this.current = $(id);
    img.addClass('active');

    this.frame.empty().append(img.clone());
    return this;
}

Photodump.Stage.prototype.prev = function(){
    this.change('prev');
}

Photodump.Stage.prototype.next = function(direction){
    this.change('next');
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

