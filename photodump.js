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
            { name : 'play', icon : 'play' },
            { name : 'next', icon : 'forward' },
        ]
    }
    var photodump = new Photodump(options);
    
});

Photodump = function(options){
    this.firebase = new Firebase(options.url + options.hash);
    this.reader = new FileReader();
    this.options = options;
    
    this.stage = new Photodump.Stage('#window') 

    this
        .initMessages()
        .initControls()
        .initClientEvents()
        .initServerEvents()
}

Photodump.prototype.initMessages = function(){
    if (this.options.first){
        var message = $('<h1 />').html('You have created a new photodump.  <br />Drag a photo here to begin.');
        $('#window').append(message);
    }

    return this;
}

Photodump.prototype.initControls = function(){
    var div  = '<div />',
        icon = '<i />'; 

    this.options.controls.forEach(function(d){
        $(div)
            .addClass(d.name)
            .click($.proxy(this[d], this))
            .appendTo('#controls')
            .append(
                $(icon).addClass('icon-' + d.icon)
            )
    });
    return this;
}

Photodump.prototype.initClientEvents = function(){
    var self = this;

    document.ondragover = function(evt, file){
        evt.stopPropagation();
        evt.preventDefault();

        // TODO: visual drag feedback
    };
    
    // Drop event listener 
    document.ondrop = function(evt, file){
        evt.stopPropagation();
        evt.preventDefault();
        
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
        .click(clickHandler)
        .append(img);
    
    return element;

    function clickHandler(evt){
        stage.show(self.id);
    }
}

Photodump.Stage = function(selector){
    this.el = $(selector);
    this.current = null;
    return this;
}

Photodump.Stage.prototype.show = function(id){
    id = id.substr(0,1) === "#" ? id : '#' + id;

    var img = this.current = $(id);
    this.el.empty().append(img.clone());
    return this;
}

Photodump.Stage.prototype.prev = function(){
    this.change('prev');
}

Photodump.Stage.prototype.next = function(direction){
    this.change('next');
}

Photodump.Stage.prototype.change = function(direction){
    var img = this.current[direction]();
    if (img.prop('tagname') === 'img'){
        this.show(img.attr('id'));
    }
    return this;
}

Photodump.Stage.prototype.play = function(){

}

