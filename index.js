// Initialization
var express = require('express');
var bodyParser = require('body-parser'); // Required if we need to use HTTP query or post parameters
var firebase = require("firebase");
var request = require("request");
var app = express();
app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Required if we need to use HTTP query or post parameters

// Kairos API details
var app_id  = "dba28545";
var app_key = "cb111b88fb1119f6ad2003c64cc71a14"; 

// Initialize Firebase
var config = {
	apiKey: "AIzaSyANDuIa1bygnoQ551DrNI9MpdU64Ey62-o",
	authDomain: "snap-91990.firebaseapp.com",
	databaseURL: "https://snap-91990.firebaseio.com",
	// storageBucket: 'gs://snap-91990.appspot.com'
};
firebase.initializeApp(config);

var db = firebase.database();
// var storage = firebase.storage();

app.get('/', function(req, res) {
	res.send("hooray");
});

// Attempts assassination using Kairos face verification feature
// Puts photo in game's history child in database
// If successful, eliminates target from game and assigns user a new target
// Also checks if user is winner
// Takes a userID, a gameKey, and an imgUrl
app.post('/assassinate', function(req, res) {
	var imgUrl   = req.body.imgUrl;
	var userID   = req.body.userID;
	var gameKey  = req.body.gameKey;

	if (!imgUrl || !userID || !gameKey) return res.send({'error': 'Missing or invalid arguments', 'status': 400});


	var gameRef = db.ref('Games/' + gameKey);

	gameRef.once('value', function(snapshot) {
		// If no target, assassination is invalid
		if (!snapshot.child('players/' + userID + '/target').exists()) {
			return res.send({'error': 'You do not have a target', 'status': 401});
		}


		var targetID = snapshot.child('players/' + userID + '/target').val();
		var name = snapshot.child('players/' + userID + '/name').val();
		var targetName = snapshot.child('players/' + targetID + '/name').val();
		var date = new Date();

		
		// Call to Kairos' face verification
		var data = {
			image: imgUrl,
			subject_id: targetID,
			gallery_name: "snapsassin"
		}
		request({
			url: "https://api.kairos.com/verify",
			method: "POST",
			json: true,
			headers: {
				"Content-Type": "application/json",
				app_id,
				app_key
			},
			body: data
		}, function(error, response, body) {
			console.log(body);

			if (body.Errors) {
				return res.send({'error': body.Errors[0].Message, 'status': 201});
			}

			else if (body.images) {							// Assassination successful
				// Increment numDead
				var numDead = snapshot.child("numDead").val() + 1;
				gameRef.child('numDead').set(numDead);

				// Change victim's status code
				gameRef.child('players/' + targetID + "/status").set("3");
				gameRef.child('players/' + targetID + "/target").set(null);
				db.ref('Users/' + targetID + '/games/' + gameKey).set('3');

				// Assign victim's target to user
				var newTargetID = snapshot.child('players/' + targetID + '/target').val();
				gameRef.child('players/' + userID + '/target').set(newTargetID);

				// Adds url to game's history of successful assassinations
				gameRef.child('assassinations/' + targetID).set(imgUrl);

				// Post to feed
				gameRef.child('feed').push().set({item: name + " assassinated " + targetName + ".", date: date.toString()});

				if (newTargetID == userID) {				// If new target is self, user has won
					gameRef.child('players/' + userID + '/status').set("4"); 	// Set as winner
					db.ref('Users/' + userID + '/games/' + gameKey).set('4');

					// Post to feed
					gameRef.child('feed').push().set({item: name + " is the winner!", date: date.toString()});
					
					return res.send({'success': 'You won!', 'status': 202});
				} else {
					return res.send({'success': 'Successfully assassinated target', 'status': 200});
				}
			}
		});
	});
});

// Enrolls an image corresponding to the user on the Kairos face database
// Also inserts URL to user's database entry
// Takes a URL to an image and userID
app.post('/calibrate', function(req, res) {
	var imgUrl = req.body.imgUrl;
	var userID = req.body.userID;

	if (!imgUrl || !userID) return res.send({'error': 'Missing or invalid arguments', 'status': 400});

	// Enroll to Kairos
	var data = {
		"image": imgUrl,
		"subject_id": userID,
		"gallery_name": "snapsassin"
	};

	request({
		url: "https://api.kairos.com/enroll",
		method: "POST",
		json: true,
		headers: {
			"Content-Type": "application/json",
			"app_id": app_id,
			"app_key": app_key
		},
		body: data
	}, function(error, response, body) {
		console.log(body);

		if (body.Errors) {
			return res.send({'error': body.Errors[0].Message, 'status': 201});
		}

		else if (body.images) {
			// Insert URL to user's db entry
			db.ref('Users/' + userID + '/photoUrl').set(imgUrl); 
			
			return res.send({'success': 'Successfully calibrated face', 'status': 200});

		}

		else {
			return res.send({'error': 'Something went wrong with Kairos', 'status': 201})
		}
	});
});

// Adds user to existing game child
// Takes a gameName and a userID
app.post('/joinGame', function(req, res) {
	var gameName = req.body.gameName;
	var userID   = req.body.userID;
	var date = new Date();

	if (!gameName || !userID) return res.send({'error': 'Missing or invalid arguments', 'status': 400});

	var gameRef = db.ref('Games/' + gameName);

	gameRef.once('value', function(snapshot) {
		var name; 

		if (!snapshot.exists()) {
			return res.send({'error': 'No game found with that name', 'status': 401});
		}

		// To get user's name given userID
		db.ref("Users/" + userID).once('value', function(childSnapshot) {
			name = childSnapshot.child('name').val();

			if (childSnapshot.child('games').hasChild(gameName)) {
				return res.send({'error': "You're already in this game", 'status': 401});
			}

			// Add player to game's players child
			gameRef.child('players/' + userID).set({
				name: name,
				status: "0"
			});

			// Increment number of players in game
			var numPlayers = snapshot.child('numPlayers').val();
			gameRef.child('numPlayers').set(numPlayers + 1);

			// Add game to user's "games" child
			db.ref('Users/' + userID + "/games/" + gameName).set('0');

			// Add to feed
			db.ref('Games/' + gameName + '/feed').push().set({item: name + " joined the game.", date: date.toString()});
			
			return res.send({'success': 'Successfully joined game', 'status': 200});
		});
	});
});

// Takes an id and name to check if user is in the db or not
// Used for onboarding process
app.post('/onboard', function(req, res) {
	var userID = req.body.userID;
	var name   = req.body.name;

	if (!name || !userID) return res.send({'error': 'Missing or invalid arguments', 'status': 400});

	var userRef = db.ref("Users/" + userID)
	userRef.once('value', function(snapshot) {
		console.log(snapshot);
		if (snapshot != null && snapshot.hasChild('name')) {
			console.log('[*] ' + name + ' (' + userID + ') logged in.');
			return res.send({'success': 'User exists', 'status': 201});
		} else {
			userRef.set({ name });
			console.log('[*] ' + name + ' (' + userID + ') onboarded.');
			return res.send({'success': 'Onboarding complete', 'status': 200});
		}
	});
});

// Creates a new game child in database, also adds game to user's gamesList
// Takes a gameName and userID
app.post('/createGame', function(req, res) {
	var gameName = req.body.gameName;
	var userID   = req.body.userID;
	var date = new Date();

	if (!gameName || !userID) return res.send({'error': 'Missing or invalid arguments', 'status': 400});
	
	// Check if game with same name already exists
	db.ref('Games/' + gameName).once('value', function(snapshot) {
		if (snapshot.exists()) {
			return res.send({'error': 'Game aleady exists. Please choose a different name.', 'status': 400})
		}

		// To get user's name given userID
		db.ref("Users/" + userID + "/name").once('value', function(snapshot) {
			var name = snapshot.val();

			// Create new item in database's Games branch using default numbers
			var newGameRef = db.ref('Games').child(gameName);
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
			db.ref('Users/' + userID + '/games').child(gameName).set("0");

			// Add to feed
			newGameRef.child("feed").push().set({item: "Game was created.", date: date.toString()});

			return res.send({'success': 'New game created successfully', 'status': 200});
		
		}, function(errorObj) {
			console.log("Error from getNameFromID(). Error is: " + errorObj.code);
			return res.send({'error': "Couldn't find user's name from userID", 'status': 400});
		});
		
	});


});

// This route is pinged when someone votes to start
// Takes a userID, gameID
app.post('/vote', function(req, res) {
	var userID = req.body.userID;
	var gameID = req.body.gameID;
	var gameRef = db.ref('Games/' + gameID);
	var userRef = db.ref('Users/' + userID);
	var date = new Date();

	if (!userID || !gameID) {
		return res.send({'error': 'Missing or invalid arguments', 'status': 400});
	}

	// Change status to 1 (aka ready)
	gameRef.child('players').child(userID).child('status').set("1");
	userRef.child('games').child(gameID).set('1');

	gameRef.once('value').then(function(snapshot) {
		var numPlayers    = snapshot.val().numPlayers;
		var numReady      = snapshot.val().numReady;
		numReady++;

		gameRef.child("numReady").set(numReady);
		var name = snapshot.child('players/' + userID + '/name').val();; 
		gameRef.child("feed").push().set({item: name + " voted to start.", date: date.toString()});

		if (numPlayers == 1) {
			return res.send({'error': 'You cannot start the game with one player', 'status': 405})
		}
		if (numReady / numPlayers > .5 && numPlayers != 1) {
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
					db.ref('Users/' + players[i] + '/games/' + gameID).set('2');
					i++;
				});
			});

			gameRef.child("feed").push().set({item: "Game has started!", date: date.toString()});

			return res.send({'success':'yaas', 'status': 200});
		}
	});

	
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