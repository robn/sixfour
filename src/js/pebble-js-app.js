var measure = function (n) {
    var len = n.length;
    var nspaces = (n.match(/ /g) || []).length;
    var nwide   = (n.match(/[WwMm]/g) || []).length;
    var nnarrow = (n.match(/[Iil]/g) || []).length;
    var nnormal = n.length - nspaces - nwide - nnarrow;
    return nnormal + nspaces*0.8 + nnarrow*0.5 + nwide*1.5;
};

var shorten = function (n) {
    var bits = n.split(' ');
    for (var i = 0; i < bits.length-1; i++)
        bits[i] = bits[i].substr(0,1);
    return bits.join('.');
};

var player_pretty_name = function (p) {
    var name = p.card_short;
    if (measure(name) > 10 && p.popular_name.length > 0)
        name = p.popular_name;
    if (measure(name) > 10)
        name = shorten(name);
    return name;
};


function unpack_data (data, out) {
    var teams = {};
    var players = {};
    var playerByShortName = {};
    var playerByLongName = {};
    data.team.forEach(function (team) {
        teams[team.team_id] = team;
        var playerList = team.player || team.squad;
        playerList.forEach(function (player) {
            players[player.player_id] = player;
            playerByShortName[player.card_short] = player;
            playerByLongName[player.card_long] = player;
        });
    });

    var match_status = data.match.match_status;
    if ((!match_status || match_status === "current") && data.match.result !== "0")
        match_status = "complete";

    if (match_status === "current" && !data.live.innings.batting_team_id) {
        match_status = "dormant";
    }

    switch (match_status) {
        case "dormant":
            out.score = data.match.team1_abbreviation.toUpperCase()+" v "+data.match.team2_abbreviation.toUpperCase();

            if (data.live["break"]) {
                out.fact = data.live["break"];
            }

            if (data.match.match_clock && data.match.match_clock !== "") {
                out.lead = "Match starts in "+data.match.match_clock;
            }
            else if (out.fact !== "") {
                out.lead = out.fact;
                out.fact = "";
            }

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
                    if (data.match.amount_balls && data.match.amount_balls > 0) {
                        out.bowler_name = "(" + data.match.amount_balls + " balls remaining)";
                    }
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

            if (striker) {
                out.striker_name = player_pretty_name(players[striker.player_id]);
                out.striker_stats = striker.runs+" ("+striker.balls_faced+")";
            }

            if (nonstriker) {
                out.nonstriker_name = player_pretty_name(players[nonstriker.player_id]);
                out.nonstriker_stats = nonstriker.runs+" ("+nonstriker.balls_faced+")";
            }

            var bowler = data.live.bowling.filter(function (player) { return player.live_current_name == "current bowler"; })[0];
            if (bowler) {
                out.bowler_name = player_pretty_name(players[bowler.player_id]);
                out.bowler_stats = bowler.overs+"-"+bowler.maidens+"-"+bowler.conceded+"-"+bowler.wickets;
            }

            var facts = [];

            if (data.live["break"]) {
                facts.push(data.live["break"]);
            }

            var factBall = localStorage.getItem("lastFactBall") || 0;

            console.log("lastFactBall: "+factBall);

            var newLastFactBall = factBall;
            data.comms.forEach(function (over) {
                over.ball.forEach(function (ball) {
                    if (ball.overs_unique > newLastFactBall) {
                        newLastFactBall = ball.overs_unique;
                    }

                    if (ball.event) {
                        var fact;

                        var ev = ball.event.match(/OUT|SIX|FOUR/);
                        if (!ev && ball.dismissal) {
                            ev = ["OUT"];
                        }

                        if (ev) switch (ev[0]) {

                            case "OUT":
                                var dismissal =
                                    ball.dismissal
                                    .replace(/\s+/g, " ")
                                    .replace("&dagger;", "\u2020")
                                    .replace("&amp;", "&")
                                    .match(/(.+?) (lbw b|hit wicket b|run out|retired hurt|c \& b|c|b|st) ((?:.(?! (?:b|\d+)))+.)/);

                                fact = player_pretty_name(playerByShortName[dismissal[1]] || playerByLongName[dismissal[1]]) +
                                        " " + dismissal[2] +
                                        (dismissal[2].match(/run out|retired hurt/) ? "" : " " + dismissal[3]);
                                break;

                            case "SIX":
                            case "FOUR":
                                var name = ball.players.match(/to (.+)$/)[1];
                                fact = ev[0] + " " + player_pretty_name(playerByShortName[name] || playerByLongName[name]);
                                break;
                        }

                        if (fact) {
                            facts.push([ball.overs_actual,fact].join(' '));
                        }
                    }
                });
            });

            facts.forEach(function (fact) { console.log("FACT: "+fact); });

            console.log("newLastFactBall: "+newLastFactBall);
            if (newLastFactBall > factBall) {
                localStorage.setItem("lastFactBall", newLastFactBall);
            }

            // XXX send the lot to watch and have it cycle
            if (facts.length > 0) {
                out.fact = facts[0];
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
        localStorage.setItem("lastFactBall", 0);
        update();
    }
});
