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

// Adds user to existing game child
// Takes a gameName and a userID
app.post('/joinGame', function(req, res) {
	var gameName = req.body.gameName;
	var userID   = req.body.userID;

	if (!gameName || !userID) return res.send({'error': 'Missing or invalid arguments', 'status': 400});

	db.ref("Games").once('value', function(snapshot) {
		snapshot.forEach(function(childSnapshot) {
			var child = childSnapshot.val();
			if (gameName == child.gameName) {
				var key      = childSnapshot.key;
				var childRef = childSnapshot.ref;

				// To get user's name given userID
				db.ref("Users/" + userID + "/name").once('value', function(snapshot) {
					var name = snapshot.val();

					// Add player to game's players child
					childRef.child('players/' + userID).set({
						name: name,
						status: "0"
					});

					// Increment number of players in game
					var numPlayers = child.numPlayers;
					childRef.child('numPlayers').set(numPlayers + 1);

					// Add game to user's "games" child
					db.ref('Users/' + userID + "/games/" + key).set(gameName);

					return res.send({'success': 'Successfully joined game', 'status': 200, 'gameKey': key});

				}, function(errorObj) {
					console.log("Error from getNameFromID(). Error is: " + errorObj.code);
					return res.send({'error': "Couldn't find user's name from userID", 'status': 400});
				});

			}
		});
		return res.send({'error': 'No such game with that name', 'status': 401})
	});
});

// Creates a new game child in database, also adds game to user's gamesList
// Takes a gameName and userID
app.post('/createGame', function(req, res) {
	var gameName = req.body.gameName;
	var userID   = req.body.userID;

	if (!gameName || !userID) return res.send({'error': 'Missing or invalid arguments', 'status': 400});
	
	// To get user's name given userID
	db.ref("Users/" + userID + "/name").once('value', function(snapshot) {
		var name = snapshot.val();

		// Create new item in database's Games branch using default numbers
		var newGameRef = db.ref('Games').push();
		newGameRef.set({
			numDead: 0,
			numPlayers: 1,
			numReady: 0,
			gameName: gameName,
		});
		newGameRef.child('players/' + userID).set({
			name,
			status: "0"
		});

		// Add new game to user's list of joined games
		var key = newGameRef.key;
		db.ref('Users/' + userID + '/games').child(key).set(gameName);

		return res.send({'success': 'New game created successfully', 'status': 200, 'gameKey': key});
	
	}, function(errorObj) {
		console.log("Error from getNameFromID(). Error is: " + errorObj.code);
		return res.send({'error': "Couldn't find user's name from userID", 'status': 400});
	});

});

// This route is pinged when someone votes to start
// Takes a userID, gameID
app.post('/vote', function(req, res) {
	var userID = req.body.userID;
	var gameID = req.body.gameID;

	var gameRef = db.ref('Games/' + gameID);

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

// Takes a userID and returns their name
// Returns null if invalid userID or error
function getNameFromID(id) {
	db.ref("Users/" + id + "/name").once('value', function(snapshot) {
		console.log(id)
		console.log(snapshot.val())
		return snapshot.val();
	}, function(errorObj) {
		console.log("Error from getNameFromID(). Error is: " + errorObj.code);
		return null;
	});
}

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