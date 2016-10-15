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
app.post('/vote', (req, res) => {
	var userID = req.body.userID;
	var gameID = req.body.gameID;

	var gameRef = db.ref('/Games/' + gameID);

	// Change status to 1 (aka ready)
	gameRef.child('players').child(userID).child('status').set("1");

	// Get values numPlayers and numReady
	gameRef.child('numPlayers').once('value').then(numPlayersSnapshot => {
		var numPlayers = numPlayersSnapshot.val();

		console.log(numPlayers);
	});

	res.send("cool")
});

app.listen(app.get('port'), function() {

});