---
layout: default
---

<div class="page-header">
  <h1>Probabilistic Programming Languages</h1>
</div>

This is some introductory text.

{% assign sorted_pages = site.pages | sort:"name" %}

{% for p in sorted_pages %}
    {% if p.layout == 'lecture' %}
- [{{ p.title }}]({{ site.baseurl }}{{ p.url }})<br>
    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}
