var matchid = "667715";

function update () {
    var req = new XMLHttpRequest();
    req.open('GET', "http://www.espncricinfo.com/ci/engine/match/"+matchid+".json");
    req.onload = function(e) {
        if (req.readyState == 4) {
            if(req.status == 200) {
                console.log("got new data, updating");

                var data = JSON.parse(req.responseText);
                if (data) {
                    var out = {
                        "score":"",
                        "overs":"",
                        "lead":"",
                        "striker_name":"",
                        "striker_stats":"",
                        "nonstriker_name":"",
                        "nonstriker_stats":"",
                        "bowler_name":"",
                        "bowler_stats":""
                    };

                    var teams = {};
                    var players = {};
                    data.team.forEach(function (team) {
                        teams[team.team_id] = team;
                        team.player.forEach(function (player) {
                            players[player.player_id] = player;
                        });
                    });

                    console.log("match type: "+data.match.match_status);

                    switch (data.match.match_status) {
                        case "dormant":
                            out.score = data.match.team1_filename+" v "+data.match.team2_filename;
                            out.lead = "Match starts in "+data.match.match_clock;

                            if (data.match.toss_decision !== "") {
                                out.striker_name = data.match["team"+data.match.toss_winner_team_id+"_short_name"]+" won toss,";
                                out.nonstriker_name = "will "+data.match.toss_decision_name;
                            }
                            break;

                        case "complete": {
                            out.score = data.match.team1_filename+" v "+data.match.team2_filename;

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
                            var innings = data.innings.filter(function (innings) { return innings.live_current == 1; })[0];

                            out.score = [
                                teams[innings.batting_team_id].team_filename + " " + innings.runs,
                                (innings.wickets < 10) ? "/"+innings.wickets : "",
                                ((innings.event && innings.event == "declared") ? "d" : "")
                            ].join('');

                            out.overs = innings.overs;

                            if (+data.match.scheduled_overs > 0) {
                                switch (+innings.innings_number) {
                                    case 1:
                                        out.lead = "First innings";
                                        break;
                                    default:
                                        out.lead =
                                            "Target "+(-innings.lead)+" in "+
                                            (innings.remaining_overs <= 10.0 ? innings.remaining_balls+" balls" : innings.remaining_overs+" overs");
                                        break;
                                }
                            }
                            else {
                                switch (+innings.innings_number) {
                                    case 1:
                                        out.lead = "First innings";
                                        break;
                                    case 4:
                                        out.lead = "Target "+(-innings.lead);
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
                                out.striker_name = players[striker.player_id].card_short + (nonstriker ? "*" : "");
                                out.striker_stats = striker.runs+" ("+striker.balls_faced+")";
                            }

                            if (nonstriker) {
                                out.nonstriker_name = players[nonstriker.player_id].card_short;
                                out.nonstriker_stats = nonstriker.runs+" ("+nonstriker.balls_faced+")";
                            }

                            var bowler = data.live.bowling.filter(function (player) { return player.live_current_name == "current bowler"; })[0];
                            if (bowler) {
                                out.bowler_name = players[bowler.player_id].card_short;
                                out.bowler_stats = bowler.overs+"-"+bowler.maidens+"-"+bowler.conceded+"-"+bowler.wickets;
                            }

                            break;
                        }
                    }

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
