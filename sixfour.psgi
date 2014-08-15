#!/usr/bin/env plackup

use 5.010;
use warnings;
use strict;

use HTTP::Tiny;
use JSON::XS;
use Template;

my $template = do { local $/; <DATA> };

my $app = sub {
    my ($env) = @_;

    my $data = decode_json(HTTP::Tiny->new->get('http://www.espncricinfo.com/ci/content/rss/extension.json')->{content});

    my %matches = map {
        $_->{id} => (join(' ', grep { $_ } ($_->{b1}, $_->{b1d}, 'v', $_->{b2}, $_->{b2d})) =~ s/\s+/ /gr)
    } @{$data->{matches}};

    my %stash = (
        matches => \%matches,
    );

    my $output;
    open my $outfh, '>', \$output;
    Template->new(OUTPUT => $outfh)->process(\$template, \%stash);
    close $outfh;

    return [ 200, [ 'Content-type' => 'text/html' ], [ $output ] ];
};

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
