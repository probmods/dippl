---
layout: default
title: Probabilistic Programming Languages
---

This is some introductory text.

{% assign sorted_pages = site.pages | sort:"name" %}

{% for p in sorted_pages %}
    {% if p.layout == 'lecture' %}
- [{{ p.title }}]({{ site.baseurl }}{{ p.url }})

    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}
