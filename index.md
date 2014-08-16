---
layout: default
title: Probabilistic Programming Languages
---

These are notes from the [ESSLLI 2014](http://www.esslli2014.info) class on Probabilistic Programming Languages, by Noah D. Goodman and Andreas Stuhlmueller.

{% assign sorted_pages = site.pages | sort:"name" %}

# Lectures
{% for p in sorted_pages %}
    {% if p.layout == 'lecture' %}
- [{{ p.title }}]({{ site.baseurl }}{{ p.url }})<br>
    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}


# Examples
{% for p in sorted_pages %}
    {% if p.layout == 'example' %}
- Example: [{{ p.title }}]({{ site.baseurl }}{{ p.url }})<br>
    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}
