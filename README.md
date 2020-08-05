# Photodump 2

Photodump is a simple, realtime photo sharing application tuned to an unreasonable degree of efficiency.

Just drag your photos on to the page.  Invite friends to look.

## Implementation details

Photodump is a client-intensive application with a thin server layer.  It uses websockets in order to synchronize states
across different clients, and WEBP format to reduce the overall data transfer.

In the future, I would like it to use WebRTC to reduce my bandwidth costs, but that's a lot of engineering work to solve
what is currently non-problem.

The client handles all of the resizing and reencoding of images.  It is written in library-free, transpilation-free
ES6.

The server handles synchronization between clients and the desired storage platform (currently S3).
