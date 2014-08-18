---
layout: default
title: Probabilistic Programming Languages
---

<div class="page-header">
  <h1>Probabilistic Programming Languages</h1>
</div>

These are notes from the [ESSLLI 2014](http://www.esslli2014.info) class on Probabilistic Programming Languages, by Noah D. Goodman and Andreas Stuhlmüller. 

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
