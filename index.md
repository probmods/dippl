---
layout: default
title: Probabilistic Programming Languages
---

<div class="main">
  <h1>The Design and Implementation of Probabilistic Programming Languages</h1>
  <span class="authors">Noah D. Goodman and Andreas Stuhlmüller</span>
</div>

**About:** Probabilistic programing languages (PPLs) unify techniques for formal description of computation and those for representation and use of uncertain knowledge. PPLs have seen recent interest from artificial intelligence, programming languages, cognitive science, and natural languages communities. This book explains techniques for implementing PPLs by lightweight embedding into a host language. We illustrate by designing and implementing a small PPL embedded in Javascript -- WebPPL. We show how to implement several algorithms for universal probabilistic inference including: priority-based enumeration with caching, particle filtering, and Markov chain Monte Carlo. To implement these algorithms we use continuations and coroutines to expose the information needed by the algorithms, without requiring any support by the host language. We illustrate these ideas with examples drawn from semantic parsing, natural language pragmatics, and procedural graphics.

**Citing:** Please cite this book as: 
N. D. Goodman and A. Stuhlmüller (electronic). The Design and Implementation of Probabilistic Programming Languages. Retrieved <span id="date"></span> from `http://dippl.org`.

{% assign sorted_pages = site.pages | sort:"name" %}

### Chapters

{% for p in sorted_pages %}
    {% if p.layout == 'lecture' %}
- [{{ p.title }}]({{ site.baseurl }}{{ p.url }})<br>
    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}


### Examples

{% for p in sorted_pages %}
    {% if p.layout == 'example' %}
- [{{ p.title }}]({{ site.baseurl }}{{ p.url }})<br>
    <em>{{ p.description }}</em>
    {% endif %}
{% endfor %}

### Open source

- [Book content](https://github.com/probmods/dippl)<br>
  *Markdown code for the book chapters*

- [WebPPL](https://github.com/probmods/webppl)<br>
  *A probabilistic programming language for the web*

### Acknowledgments

The construction of this tutorial was made possible by grants from DARPA, under agreement number FA8750-14-2-0009, and the Office of Naval Research, grant number N00014-13-1-0788. 
(The views and conclusions contained herein are those of the authors and should not be interpreted as necessarily representing the official policies or endorsements, either expressed or implied, of DARPA or the U.S. Government.)

This book is based on notes from the [ESSLLI 2014](http://www.esslli2014.info) class on Probabilistic Programming Languages, taught by the authors.

