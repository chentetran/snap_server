// Initialization
var express = require('express');
var bodyParser = require('body-parser'); // Required if we need to use HTTP query or post parameters
var firebase = require("firebase");
var app = express();
app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Required if we need to use HTTP query or post parameters

// Initialize Firebase
var config = {
	apiKey: "AIzaSyANDuIa1bygnoQ551DrNI9MpdU64Ey62-o",
	authDomain: "snap-91990.firebaseapp.com",
	databaseURL: "https://snap-91990.firebaseio.com",
};
firebase.initializeApp(config);

var db = firebase.database();

app.get('/', function(req, res) {
	res.send("hooray");
})

// This route is pinged when someone votes to start
// Takes a userID, gameID
app.post('/vote', function(req, res) {
	var userID = req.body.userID;
	var gameID = req.body.gameID;

	var gameRef = db.ref('/Games/' + gameID);

	// Change status to 1 (aka ready)
	gameRef.child('players').child(userID).child('status').set("1");

	gameRef.once('value').then(function(snapshot) {
		var numPlayers    = snapshot.val().numPlayers;
		var numReady      = snapshot.val().numReady;
		numReady++;

		gameRef.child("numReady").set(numReady);

		if (numReady / numPlayers > .5) {
			console.log("[+] Game " + gameID + " is ready to start");


			gameRef.child('players').once('value').then(function(snapshot) {
				// Get all players as an array
				var players = [];
				snapshot.forEach(function(snapshot) {
					console.log(snapshot.val())
					players.push(snapshot.getKey());
				});

				sattoloCycle(players);

				// Iterate thru players child and assign a target
				var i = 0;
				snapshot.forEach(function(snapshot) {
					snapshot.ref.child('target').set(players[i]);
					snapshot.ref.child('status').set("2");
					i++;
				});

			});
		}
	});

	res.send({'success':'yaas'});
});

function sattoloCycle(items) {
  for(var i = items.length; i-- > 1; ) {
    var j = Math.floor(Math.random() * i);
    var tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

app.listen(app.get('port'), function() {

});