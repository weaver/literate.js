# Literate JS #

Tools for generating documents from Javascript written in a literate
style.  This software is currently just a proof-of-concept.
Suggestions are welcome.

See also: [docco][1]

[1]: http://jashkenas.github.com/docco/

## Untangle ##

Convert a program written in a semi-literate style to HTML.  This is
done by searching for comments beginning with a `//`, stripping the
comment characters off to create a markdown document, then converting
the text to HTML.

For example, run `untangle.js` on itself.

    ./bin/untangle.js ./bin/untangle.js > example.html
    open example.html

