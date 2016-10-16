# snap_server

Server-side code that handles the vote-to-start function in the Android app for snapsassin.

A REST API to be pinged by Snapsassin client with a game ID.

Once receiving a POST request with a gameID and userID, this server will change the status of the user in the Firebase database to "ready" (status code 1) and increment the number of players ready. If number of players ready is greater than 50% (yay democracy), the server randomly assign targets to each player (using the Sattolo shuffle to ensure no one is assigned to themselves) and update it on Firebase.

See Snapsassin repo for what Snapsassin is.