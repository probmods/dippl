## The Design and Implementation of Probabilistic Programming Languages

A web book, available online at [dippl.org](http://dippl.org/)

[WebPPL](https://github.com/probmods/webppl) is included as a submodule.

Requirements:

- [git](http://git-scm.com/)
- [nodejs](http://nodejs.org)
- [bower](http://bower.io/)
- [jekyll](http://jekyllrb.com/)

Installation:

    git clone https://github.com/probmods/dippl.git
    cd dippl
    git submodule update --init --recursive
    npm install
    npm install -g browserify    
    bower install

Run local webserver:

    jekyll serve --watch

Pull upstream changes to repo:

    git pull origin gh-pages
    git submodule update --recursive

Update submodule to latest version of webppl and compile webppl for use in browser:

    ./update-webppl
