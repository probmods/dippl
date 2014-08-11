esslli2014
==========

ESSLLI 2014 Probabilistic programming languages course

[Webppl](https://github.com/probmods/webppl) is included as a submodule.

Installation:

    git clone https://github.com/probmods/esslli2014.git
    cd esslli2014
    git submodule update --init --recursive
    npm install
    npm install -g browserify    
    bower install

Run local webserver:

    jekyll serve --watch --baseurl ""

Pull upstream changes to repo:

    git pull origin gh-pages
    git submodule update --recursive

Update submodule to latest version of webppl and compile webppl for use in browser:

    ./update-webppl
