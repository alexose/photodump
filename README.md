# Photodump 2

Photodump is a simple, realtime photo sharing application tuned to an unreasonable degree of efficiency.

Just drag your photos on to the page.  Invite friends to look.

# Installation

    git clone git@github.com:alexose/photodump.git
    cd photodump
    git checkout v2
    npm install
    node server.js

## Design choices

Photodump is a client-intensive application with a thin server layer.  It uses websockets in order to synchronize states
across different clients, and WEBP format to reduce the overall data transfer.

It is intentionally databaseless.  Rather, the 'database' is a combination of in-memory storage and persistence to S3.
This allows for cheap scaling, albeit at the mercy of S3 performance.

In the future, I would like it to use WebRTC to reduce my bandwidth costs, but that's a lot of engineering work to solve
what is currently non-problem.

The client handles all of the resizing and reencoding of images.  It is written in library-free, transpilation-free
ES6.  There is no CSS framework.  This forces me to be economical with my design choices.

The server handles synchronization between clients and transfering data to (but not from) S3.
