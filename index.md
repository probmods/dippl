---
layout: default
title: Probabilistic Programming Languages
---

<div class="page-header">
  <h1>Probabilistic Programming Languages</h1>
</div>

These are notes from the [ESSLLI 2014](http://www.esslli2014.info) class on Probabilistic Programming Languages, by Noah D. Goodman and Andreas Stuhlmüller.

Please cite this book as: N. D. Goodman and A. Stuhlmüller (electronic). Probabilistic Programming Languages. Retrieved <span id="date"></span> from `http://probmods.github.io/esslli2014/`.

{% assign sorted_pages = site.pages | sort:"name" %}

### Lectures

{% for p in sorted_pages %}
    {% if p.layout == 'lecture' %}
- [{{ p.title }}]({{ site.baseurl }}{{ p.url }})<br>
    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}


### Examples

{% for p in sorted_pages %}
    {% if p.layout == 'example' %}
- Example: [{{ p.title }}]({{ site.baseurl }}{{ p.url }})<br>
    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}

### Open source

- [Lecture notes](https://github.com/probmods/esslli2014)
- [WebPPL](https://github.com/probmods/webppl)

### Acknowledgments

The construction of this tutorial was made possible by grants from DARPA and the Office of Naval Research. This material is based on research sponsored by DARPA under agreement number FA8750-14-2-0009. The U.S. Government is authorized to reproduce and distribute reprints for Governmental purposes notwithstanding any copyright notation thereon. The views and conclusions contained herein are those of the authors and should not be interpreted as necessarily representing the official policies or endorsements, either expressed or implied, of DARPA or the U.S. Government.
