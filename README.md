## The Design and Implementation of Probabilistic Programming Languages

A web book, available online at [dippl.org](https://dippl.org/)

Requirements:

- [git](http://git-scm.com/)
- [jekyll](http://jekyllrb.com/)

Run a local webserver:

    git clone https://github.com/probmods/dippl.git
    cd dippl
    jekyll serve --watch

All JavaScript and CSS dependencies are vendored in the repo, so no package manager is needed:

- The webppl runtime, editor, and visualization library live in `assets/js` and `assets/css` (currently webppl v0.9.9, webppl-editor 1.0.9, webppl-viz 0.7.11). To upgrade, replace those files with new builds and update the references in `_layouts/default.html`.
- Third-party browser libraries (jQuery, Bootstrap, d3, etc.) live in `bower_components`. The directory name is historical; bower itself is no longer used.

The site deploys via GitHub Pages from the `gh-pages` branch.
