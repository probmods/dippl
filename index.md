---
layout: default
title: Probabilistic Programming Languages
---

This is some introductory text.

{% for p in site.pages | sort:"path" %}
    {% if p.layout == 'lecture' %}
- [{{ p.title }}]({{ site.baseurl }}{{ p.url }})

    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}
