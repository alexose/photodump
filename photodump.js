/*
photodump.js -- A Firebase-backed photo sharing app.
By Alex Ose, alex@alexose.com
*/

$(document).ready(function(){
    var options = {
        url  : 'https://photodump.firebaseio.com/',
        hash : 'develop-1'
    }
    var photodump = new Photodump(options);
    
});

Photodump = function(options){
    this.firebase = new Firebase(options.url + options.hash);
    this.reader = new FileReader();

    this
        .initControls()
        .initClientEvents()
        .initServerEvents()
}

Photodump.prototype.initControls = function(){
    // TODO: slideshow controls
    
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
                self.firebase.push({filename : file.name, data : payload });
            };
            self.reader.readAsDataURL(file);
        }
    };

    return this;
}

Photodump.prototype.initServerEvents = function(){
    var self = this;

    this.firebase.on('child_added', function(snapshot){
        data = snapshot.val();
        if (data.data){
            var li = new Photodump.Thumb(data);
            $('#thumbs').append(li);
        }
    });
    
    return this;
}

Photodump.Thumb = function(data, tag){
    tag = tag || 'li';

    var img = $('<img />')
        .attr('src', data.data)
        .attr('alt', data.filename);
    var element = $('<' + tag + '/>')
        .addClass('thumb')
        .click(clickHandler)
        .append(img);
    
    return element;

    function clickHandler(evt){
       var selector = '#window';
       $(selector).empty().append(img.clone());
    }
}
