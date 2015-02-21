function unpack_data (data, out) {
    var teams = {};
    var players = {};
    data.team.forEach(function (team) {
        teams[team.team_id] = team;
        var playerList = team.player || team.squad;
        playerList.forEach(function (player) {
            players[player.player_id] = player;
        });
    });

    var match_status = data.match.match_status;
    if (!match_status || data.match.result !== "0")
        match_status = "complete";

    if (match_status === "current" && !data.live.innings.batting_team_id) {
        match_status = "dormant";
    }

    // XXX fact
    if (data.live["break"]) {
        out.fact = data.live["break"];
    }

    console.log("match status: "+match_status);

    switch (match_status) {
        case "dormant":
            out.score = data.match.team1_abbreviation.toUpperCase()+" v "+data.match.team2_abbreviation.toUpperCase();
            out.lead = "Match starts in "+data.match.match_clock;

            if (data.match.toss_decision && data.match.toss_decision !== "" && data.match.toss_decision !== "0") {
                out.striker_name = teams[data.match.toss_winner_team_id].team_short_name+" won toss,";
                out.nonstriker_name = "will "+data.match.toss_decision_name;
            }
            break;

        case "complete": {
            out.score = data.match.team1_abbreviation.toUpperCase()+" v "+data.match.team2_abbreviation.toUpperCase();

            if (data.match.winner_team_id == "0") {
                out.striker_name = "Match drawn";
            }
            else {
                out.striker_name = teams[data.match.winner_team_id].team_short_name+" won by";
                if (data.match.amount_name === "innings") {
                    out.nonstriker_name = "innings and "+data.match.amount+" runs";
                }
                else {
                    out.nonstriker_name = data.match.amount+" "+data.match.amount_name;
                }
            }
            break;
        }

        case "current": {
            var innings = data.live.innings;

            out.score = [
                teams[innings.batting_team_id].team_abbreviation.toUpperCase() + " " + innings.runs,
                (innings.wickets < 10) ? "/"+innings.wickets : "",
                ((innings.event && innings.event == "declared") ? "d" : "")
            ].join('');

            out.overs = innings.overs;

            if (+data.match.scheduled_overs > 0) {
                switch (+innings.innings_number) {
                    case 1:
                        out.lead = "Run rate: "+innings.run_rate;
                        break;
                    default:
                        out.lead =
                            "Need "+(1-innings.lead)+" from "+
                            (innings.remaining_overs <= 10.0 ? innings.remaining_balls : innings.remaining_overs+" ov");
                        break;
                }
            }
            else {
                switch (+innings.innings_number) {
                    case 1:
                        out.lead = "First innings";
                        break;
                    case 4:
                        out.lead = "Target "+(innings.target);
                        break;
                    default:
                        out.lead =
                            innings.lead < 0 ? "Trail by "+(-innings.lead) :
                            innings.lead > 0 ? "Lead by "+innings.lead :
                                            "Scores level";
                }
            }

            var striker = data.live.batting.filter(function (player) { return player.live_current_name == "striker"; })[0];
            var nonstriker = data.live.batting.filter(function (player) { return player.live_current_name == "non-striker"; })[0];

            if (!striker) {
                striker = nonstriker;
                nonstriker = null;
            }

            var shorten = function (n) {
                var bits = n.split(' ');
                for (var i = 0; i < bits.length-1; i++)
                    bits[i] = bits[i].substr(0,1);
                return bits.join('.');
            };

            if (striker) {
                var striker_name = players[striker.player_id].card_short;
                if (striker_name.length > 10 && players[striker.player_id].popular_name.length > 0)
                    striker_name = players[striker.player_id].popular_name;
                if (striker_name.length > 10)
                    striker_name = shorten(striker_name);
                out.striker_name = striker_name + (nonstriker ? "*" : "");
                out.striker_stats = striker.runs+" ("+striker.balls_faced+")";
            }

            if (nonstriker) {
                var nonstriker_name = players[nonstriker.player_id].card_short;
                if (nonstriker_name.length > 10 && players[nonstriker.player_id].popular_name.length > 0)
                    nonstriker_name = players[nonstriker.player_id].popular_name;
                if (nonstriker_name.length > 10)
                    nonstriker_name = shorten(nonstriker_name);
                out.nonstriker_name = nonstriker_name;
                out.nonstriker_stats = nonstriker.runs+" ("+nonstriker.balls_faced+")";
            }

            var bowler = data.live.bowling.filter(function (player) { return player.live_current_name == "current bowler"; })[0];
            if (bowler) {
                var bowler_name = players[bowler.player_id].card_short;
                if (bowler_name.length > 10) bowler_name = players[bowler.player_id].popular_name;
                out.bowler_name = bowler_name;
                out.bowler_stats = bowler.overs+"-"+bowler.maidens+"-"+bowler.conceded+"-"+bowler.wickets;
            }

            break;
        }
    }
}

function new_out () {
    var out = {
        "score":"",
        "overs":"",
        "lead":"",
        "striker_name":"",
        "striker_stats":"",
        "nonstriker_name":"",
        "nonstriker_stats":"",
        "bowler_name":"",
        "bowler_stats":"",
        "fact":""
    };
    return out;
}

function update () {
    var out = new_out();
    var matchId = localStorage.getItem("matchId");
    if (!matchId) {
        out.striker_name = "No match selected";
        out.nonstriker_name = "in config.";
        Pebble.sendAppMessage(out);
        return;
    }
    var req = new XMLHttpRequest();
    req.open('GET', "http://www.espncricinfo.com/ci/engine/match/"+matchId+".json");
    req.onload = function(e) {
        if (req.readyState == 4) {
            if(req.status == 200) {
                console.log("got new data, updating");

                var data = JSON.parse(req.responseText);
                if (data) {
                    unpack_data(data, out);
                    console.log(JSON.stringify(out));
                    Pebble.sendAppMessage(out);
                }

            } else {
                console.log("Error");
            }
        }
    };
    req.send(null);
}

Pebble.addEventListener("ready", function (e) {
    console.log("connected, doing first update");
    update();
});

Pebble.addEventListener("appmessage", function (e) {
    console.log("tick, doing update");
    update();
});

Pebble.addEventListener("showConfiguration", function (e) {
    console.log("config requested");
    Pebble.openURL("http://eatenbyagrue.org/a/sixfour.psgi");
});

Pebble.addEventListener("webviewclosed", function (e) {
    console.log("config closed, response: "+e.response);
    if (e.response !== "CANCELLED") {
        localStorage.setItem("matchId", e.response);
        update();
    }
});
