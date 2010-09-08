#!/usr/bin/env node

/// # untangle.js #
//
// Convert a program written in a semi-literate style to HTML.  This
// is done by searching for comments beginning with a `//`, stripping
// the comment characters off to create a markdown document, then
// converting the text to HTML.

require.paths.unshift(__dirname + '/../ext');

var fs = require('fs'),
    path = require('path'),
    sys = require('sys'),
    showdown = require('showdown'),
    Mustache = require('mustache');


/// ## Main Program ##

// main :: String -> ()
//
// The program takes one argument, a filename to untangle.  Print HTML
// to standard output.
//
// + filename - String path to a javascript file.
//
// Returns nothing.
function main(filename) {
  var content = fs.readFileSync(filename, 'utf-8'),
      template = path.join(__dirname, '../layout/page.html.mu');

  sys.print(render(template, {
    body: markdown(untangle(content)),
    file: path.basename(filename)
  }));
}

// markdown :: String -> String
//
// Convert a document formatted with Markdown to HTML.
//
// + text - String markdown document content.
//
// Returns String HTML.
function markdown(text) {
  return (new showdown.converter()).makeHtml(text);
}

function render(path, bindings) {
  return Mustache.to_html(fs.readFileSync(path, 'utf-8'), bindings);
}

// untangle :: String -> String
//
// Convert a javascript source program to a Markdown document by
// extracting comments.
//
// Relevant comments are followed by an empty line (general-purpose
// documentation) or by a function (method documentation).  Comments
// followed immediately by a non-function line are assumed to be
// simple inline comments and are ignored.
//
// + program - String javascript source.
//
// Returns String Markdown document.
function untangle(program) {
  var inBlock = true,
      sig = [],
      block = [],
      text = [],
      depth = 1,
      probe;

  // startBlock :: String -> ()
  //
  // This method is called when the first comment in a possible series
  // of comment lines is encountered.
  //
  // + line - String comment body without preceeding slashes.
  //
  // Returns nothing.
  function startBlock(line) {
    block = [];
    addLine(line);
  }

  // addLine :: String -> ()
  //
  // This method is called when additional comment lines are
  // encountered.
  //
  // + line - String comment body without preceeding slashes.
  //
  // Returns nothing.
  function addLine(line) {
    var $m;

    // Named Type Signature
    if (($m = line.match(/^\s*([^\s:]+)\s*::(.*)$/))) {
      sig.push([$m[1], ' :: ', $m[2]]);
      return;
    }
    // Unnamed Type Signature
    else if (($m = line.match(/^\s+::\s*(.*)$/))) {
      sig.push(['', ' :: ', $m[1]]);
      return;
    }
    else if (sig.length > 0)
      addSig();

    // Parameter List
    if (($m = line.match(/^\s*([\*\+\-])\s*(\S+)\s+\-\s+(.*)$/)))
      line = $m[1] + ' `' + $m[2] + '` ' + $m[3];
    // Header
    else if (($m = line.match(/(#+)/)))
      depth = $m[1].length;

    block.push(line);
  }

  // endBlock :: String -> ()
  //
  // This method is called when a non-comment line is encountered
  // after a comment line or series of comment lines have been
  // encountered.
  //
  // + line - String non-comment.
  //
  // Returns nothing.
  function endBlock(line) {
    var $m;

    // Empty Line
    if (/^\s*$/.test(line)) {
      addBlock();
    }
    // Bound Function
    else if (($m = line.match(/(\.?[^\.\s=]+)\s*=\W*function(\(.*\))/))) {
      block.unshift(repeat('#', depth + 1) + ' ' + $m[1] + $m[2]);
      addBlock();
    }
    // Named Function
    else if (($m = line.match(/function\s+([^\s\(]+)\s*(\(.*\))/))) {
      block.unshift(repeat('#', depth + 1) + ' ' + $m[1] + $m[2]);
      addBlock();
    }
    block = undefined;
  }

  // addBlock :: ()
  //
  // This helper method for `endBlock` adds the current block to the
  // markdown document.  First, make sure there's an empty line
  // between this block and the previous block.  Also, add any
  // signature (this shouldn't normally happen, but is here for
  // completeness).
  //
  // Returns nothing.
  function addBlock() {
    if (text.length > 0)
      text.push('');
    addSig();
    block.forEach(function(line) {
      text.push(line);
    });
  }

  // addSig :: ()
  //
  // This helper method for `addLine` and `endBlock` adds a signature
  // table to the current block.  Signatures are accumulated into an
  // array that looks like `[[name, '::', 'type'], ...]` by `addLine`.
  //
  // Returns nothing.
  function addSig() {
    if (sig.length > 0) {
      block.push(table(sig, 'sig', function(cell) {
        return '<code>' + cell + '</code>';
      }));
      sig = [];
    }
  }

  // Process each line.
  program.split(/(?:\r\n|\r|\n)/g).forEach(function(line) {
    if ((probe = line.match(/^\s*\/{2,}\s?(.*)$/))) {
      if (!inBlock) {
        inBlock = true;
        block = [];
        startBlock(probe[1]);
      }
      else
        addLine(probe[1]);
    }
    else if (inBlock) {
      endBlock(line);
      inBlock = false;
    }
  });

  if (inBlock)
    endBlock('');

  return text.join('\n');
}


/// ## Aux ##

// repeat :: String -> Int -> String
//
// Concatenate `str` with itself many `times`.
//
// + str   - String value to repeat.
// + times - The number of times to repeat `str`.
//
// Returns String value.
function repeat(str, times) {
  var result = '';

  for (var i = times; i >= 0; i--)
    result += str;

  return result;
}

// table :: [[String]] -> String -> (String -> String) -> String
//
// Format a two-dimensional array as an HTML table.
//
// + data   - Array of rows.
// + cls    - String class name for this table.
// + format - Function used to format cell content.
//
// Returns String html table.
function table(data, cls, format) {
  var rows = data.map(function(row) {
    var cells = row.map(function(cell) {
      return '<td>' + format(escapeHtml(cell)) + '</td>';
    });
    return '<tr>' + cells.join('') + '</tr>';
  });
  return '<table class="' + cls + '">' + rows.join('') + '</table>';
}

// escapeHtml :: String -> String
//
// Make `str` safe to add into an HTML document by escaping important
// characters with HTML entities.
//
// + str - String of text that may contain special HTML characters.
//
// Returns String of safe HTML.
function escapeHtml(str) {
  var entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
  return str.replace(/[<>&"]/g, function(character) {
    return entities[character];
  });
}


/// Main
main.apply(this, process.argv.slice(2));