## The Design and Implementation of Probabilistic Programming Languages

A web book, available online at [dippl.org](http://dippl.org/)

Requirements:

- [git](http://git-scm.com/)
- [nodejs](http://nodejs.org)
- [jekyll](http://jekyllrb.com/)

Installation:

    git clone https://github.com/probmods/dippl.git
    cd dippl
    git submodule update --init --recursive
    npm install
    npm install -g browserify bower uglifyjs
    bower install

Run local webserver:

    jekyll serve --watch

Update webppl:

    cd /PATH/TO/webppl
    browserify -t [./src/bundle.js --require webppl-viz] -g brfs ./src/browser.js > compiled/webppl.js
    uglifyjs compiled/webppl.js -b ascii_only=true,beautify=false > compiled/webppl.min.js
    mv compiled/webppl.min.js /PATH/TO/dippl/assets/js/webppl.min.js

This requires the `webppl-viz` package to be available. To install it globally, run:

    npm install --prefix ~/.webppl erindb/webppl-viz
