## The Design and Implementation of Probabilistic Programming Languages

A web book, available online at [dippl.org](http://dippl.org/)

Requirements:

- [git](http://git-scm.com/)
- [nodejs](http://nodejs.org)
- [jekyll](http://jekyllrb.com/)

Installation:

    git clone https://github.com/probmods/dippl.git
    cd dippl
    npm install
    npm install -g browserify bower uglifyjs
    bower install

Run local webserver:

    jekyll serve --watch

## Assets

To update webppl, webppl-viz, and webppl-editor, simply copy the minified Javascript files (`webppl-editor.min.js`, `webppl-viz.min.js`, `webppl.min.js`) and CSS files (`webppl-editor.css`, `webppl-viz.css`) to `assets/js` and `assets/css` respectively.

- webppl: f24238e (v0.7.0+ dev)
- webppl-editor: d888aa2
- webppl-viz: 2450784
