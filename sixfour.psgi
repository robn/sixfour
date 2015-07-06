#!/usr/bin/env perl

use 5.020;
use warnings;
use strict;

use HTTP::Tiny;
use XML::RSS;
use Template;

my $template = do { local $/; <DATA> };

my $app = sub {
    my ($env) = @_;

    my $data = XML::RSS->new->parse(HTTP::Tiny->new->get('http://static.cricinfo.com/rss/livescores.xml')->{content});

    my %matches = map { [$_->{guid} =~ m/(\d+)/]->[0] => ($_->{description} =~ s/\s+/ /gr) } @{$data->{items}};

    my %stash = (
        matches => \%matches,
    );

    my $output;
    open my $outfh, '>', \$output;
    Template->new(OUTPUT => $outfh)->process(\$template, \%stash);
    close $outfh;

    return [ 200, [ 'Content-type' => 'text/html' ], [ $output ] ];
};

if (caller) {
    return \&app;
}

say for @{$app->()->[2]};

__DATA__
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>sixfour config</title>
    <!--
    <link rel="stylesheet" href="http://yui.yahooapis.com/pure/0.5.0/pure-min.css">
    <link rel="stylesheet" href="http://yui.yahooapis.com/pure/0.5.0/grids-responsive-min.css">
    -->
  </head>
  <body>
    <div class='pure-g'>
      <div class='pure-u-1 pure-u-md-1-1'>
        <select class='pure-input-1' name='match' id='match'`>
          [% FOR id IN matches.keys.sort %]
          <option value="[% id %]">[% matches.$id %]</option>
          [% END %]
        </select>
      </div>
    </div>
    <div class='pure-g'>
      <button class="pure-input-1 pure-button pure-button-primary" onClick='window.location.href="pebblejs://close#"+document.getElementById("match").value'>Follow match</button>
    </div>
  </body>
</html>
