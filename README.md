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
    npm install -g browserify    
    npm install -g bower
    bower install

Run local webserver:

    jekyll serve --watch

Update webppl:

    browserify -t brfs PATH/TO/webppl/src/browser.js > assets/js/webppl.js
    uglifyjs assets/js/webppl.js -b ascii_only=true,beautify=false > assets/js/webppl.min.js
