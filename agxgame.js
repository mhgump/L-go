var io;
var gameSocket;

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket){
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
    gameSocket.on('playerRestart', playerRestart);
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
function hostCreateNewGame() {
    // Create a unique Socket.IO Room
    var thisGameId = ( Math.random() * 100000 ) | 0;

    red = [];
    blue = [];
    blueturn = true;
    for (i = 0; i < 144; i++) { 
    	wordPool[0].decoys[i]=["btnAnswer",i];
	}

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});

    // Join the Room and wait for the players
    this.join(thisGameId.toString());
};

/*
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(gameId) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : gameId
    };
    //console.log("All Players Present. Preparing game...");
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

/*
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 */
function hostStartGame(gameId) {
    console.log('Game Started.');
    wordPool[0].decoys[26]=["btnRed",26];
    red[red.length]=26;
    wordPool[0].decoys[117]=["btnBlue",117];
    blue[blue.length]=117;
    sendWord(0,gameId,200,false);
};

/**
 * A player answered correctly. Time for the next word.
 * @param data Sent from the client. Contains the current round and gameId (room)
 */
function hostNextRound(data) {
	console.log(blueturn,data.answer);
    sendWord(data.round, data.gameId,data.answer,true);
}
/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */

/**
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {
    //console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId );

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // If the room exists...
    if( room != undefined ){
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        sock.join(data.gameId);

        //console.log('Player ' + data.playerName + ' joining game: ' + data.gameId );

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
    }
}

/**
 * A player has tapped a word in the word list.
 * @param data gameId
 */
function playerAnswer(data) {
    // console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);

    // The player's answer is attached to the data object.  \
    // Emit an event with the answer so it can be checked by the 'Host'
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(data) {
    // console.log('Player: ' + data.playerName + ' ready for new game.');

    // Emit the player's data back to the clients in the game room.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom',data);
}

/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */

/**
 * Get a word for the host, and a list of words for the player.
 *
 * @param wordPoolIndex
 * @param gameId The room identifier
 */
function sendWord(wordPoolIndex, gameId,answer,move) {
    var data = getWordData(wordPoolIndex,answer,move);
    io.sockets.in(data.gameId).emit('newWordData', data);
}

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the wordPool.
 * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getWordData(i,answer,move){
    // Randomize the order of the available words.
    // The first element in the randomized array will be displayed on the host screen.
    // The second element will be hidden in a list of decoys as the correct answer
    answer = parseInt(answer,10)
    if(move){
    	if(blueturn && ismove(answer)){
	    	wordPool[0].decoys[answer]=["btnBlue",answer];
	    	blue.push(answer)
	    	switchcolor(answer)
	    	blueturn=false;
	    }else if(!blueturn && ismove(answer)){
	    	wordPool[0].decoys[answer]=["btnRed",answer];
	    	red.push(answer)
	    	switchcolor(answer)
	    	blueturn=true;
	    }
    }
    var words = shuffle(wordPool[0].words);

    // Randomize the order of the decoy words and choose the first 5
    var decoys = wordPool[0].decoys;

    // Package the words into a single object.
    var wordData = {
        round: i,
        word : words[0],   // Displayed Word
        answer : words[1], // Correct Answer
        list : decoys      // Word list for player (decoys and answer)
    };

    return wordData;
}
function switchcolor(number){
	console.log("switch");
	if(blueturn){
		if(wordPool[0].decoys[number-13][0]=="btnRed"){
			wordPool[0].decoys[number-13]=["btnBlue",number-13];
			var index = red.indexOf(number-13);
			if (index > -1) {
    			red.splice(index, 1);
			}
			blue.push(number-13);
		}
		if(wordPool[0].decoys[number-12][0]=="btnRed"){
			wordPool[0].decoys[number-12]=["btnBlue",number-12];
			var index = red.indexOf(number-12);
			if (index > -1) {
    			red.splice(index, 1);
			}
			blue.push(number-12);
		}
		if(wordPool[0].decoys[number-11][0]=="btnRed"){
			wordPool[0].decoys[number-11]=["btnBlue",number-11];
			var index = red.indexOf(number-11);
			if (index > -1) {
    			red.splice(index, 1);
			}
			blue.push(number-11);
		}
		if(wordPool[0].decoys[number-1][0]=="btnRed"){
			wordPool[0].decoys[number-1]=["btnBlue",number-1];
			var index = red.indexOf(number-1);
			if (index > -1) {
    			red.splice(index, 1);
			}
			blue.push(number-1);
		}
		if(wordPool[0].decoys[number+1][0]=="btnRed"){
			wordPool[0].decoys[number+1]=["btnBlue",number+1];
			var index = red.indexOf(number+1);
			if (index > -1) {
    			red.splice(index, 1);
			}
			blue.push(number+1);
		}
		if(wordPool[0].decoys[number+11][0]=="btnRed"){
			wordPool[0].decoys[number+11]=["btnBlue",number+11];
			var index = red.indexOf(number+11);
			if (index > -1) {
    			red.splice(index, 1);
			}
			blue.push(number+11);
		}
		if(wordPool[0].decoys[number+12][0]=="btnRed"){
			wordPool[0].decoys[number+12]=["btnBlue",number+12];
			var index = red.indexOf(number+12);
			if (index > -1) {
    			red.splice(index, 1);
			}
			blue.push(number+12);
		}
		if(wordPool[0].decoys[number+13][0]=="btnRed"){
			wordPool[0].decoys[number+13]=["btnBlue",number+13];
			var index = red.indexOf(number+13);
			if (index > -1) {
    			red.splice(index, 1);
			}
			blue.push(number+13);
		}
	}else{
		if(wordPool[0].decoys[number-13][0]=="btnBlue"){
			wordPool[0].decoys[number-13]=["btnRed",number-13];
			var index = blue.indexOf(number-13);
			if (index > -1) {
    			blue.splice(index, 1);
			}
			red.push(number-13);
		}
		if(wordPool[0].decoys[number-12][0]=="btnBlue"){
			wordPool[0].decoys[number-12]=["btnRed",number-12];
			var index = blue.indexOf(number-12);
			if (index > -1) {
    			blue.splice(index, 1);
			}
			red.push(number-12);
		}
		if(wordPool[0].decoys[number-11][0]=="btnBlue"){
			wordPool[0].decoys[number-11]=["btnRed",number-11];
			var index = blue.indexOf(number-11);
			if (index > -1) {
    			blue.splice(index, 1);
			}
			red.push(number-11);
		}
		if(wordPool[0].decoys[number-1][0]=="btnBlue"){
			wordPool[0].decoys[number-1]=["btnRed",number-1];
			var index = blue.indexOf(number-1);
			if (index > -1) {
    			blue.splice(index, 1);
			}
			red.push(number-1);
		}
		if(wordPool[0].decoys[number+1][0]=="btnBlue"){
			wordPool[0].decoys[number+1]=["btnRed",number+1];
			var index = blue.indexOf(number+1);
			if (index > -1) {
    			blue.splice(index, 1);
			}
			red.push(number+1);
		}
		if(wordPool[0].decoys[number+11][0]=="btnBlue"){
			wordPool[0].decoys[number+11]=["btnRed",number+11];
			var index = blue.indexOf(number+11);
			if (index > -1) {
    			blue.splice(index, 1);
			}
			red.push(number+11);
		}
		if(wordPool[0].decoys[number+12][0]=="btnBlue"){
			wordPool[0].decoys[number+12]=["btnRed",number+12];
			var index = blue.indexOf(number+12);
			if (index > -1) {
    			blue.splice(index, 1);
			}
			red.push(number+12);
		}
		if(wordPool[0].decoys[number+13][0]=="btnBlue"){
			wordPool[0].decoys[number+13]=["btnRed",number+13];
			var index = blue.indexOf(number+13);
			if (index > -1) {
    			blue.splice(index, 1);
			}
			red.push(number+13);
		}

	}
}
function ismove(number){
	if(blueturn){
		console.log(blue);
		var temp = blue.slice(0);
		for(var i=0;i<temp.length;i++){
			variable = temp[i];
			console.log(variable);
			console.log("variable");
			if(number== (variable+10) || number ==(variable-10) || number ==(variable+14) || number ==(variable-14)|| number ==(variable-25) || number ==(variable+25) || number ==(variable+23) || number ==(variable-23)){
				return true;
			}
		}
	}else{
		console.log(red);
		var temp = red.slice(0);
		for(var i=0;i<temp.length;i++){
			variable = temp[i];
			console.log(variable);
			console.log("variable");
			if(number== (variable+10) || number ==(variable-10) || number ==(variable+14) || number ==(variable-14)|| number ==(variable-25) || number ==(variable+25) || number ==(variable+23) || number ==(variable-23)){
				return true;
			}
		}
	}
	return false;
}

/*
 * Javascript implementation of Fisher-Yates shuffle algorithm
 * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
 */
function shuffle(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

/**
 * Each element in the array provides data for a single round in the game.
 *
 * In each round, two random "words" are chosen as the host word and the correct answer.
 * Five random "decoys" are chosen to make up the list displayed to the player.
 * The correct answer is randomly inserted into the list of chosen decoys.
 *
 * @type {Array}
 */
var blueturn = true;
var wordPool = [
    {
        "words"  : [ "sale","seal","ales","leas" ],
	    "decoys" : [['btnAnswer', 0], ['btnAnswer', 1], ['btnAnswer', 2], ['btnAnswer', 3], ['btnAnswer', 4], ['btnAnswer', 5], ['btnAnswer', 6], ['btnAnswer', 7], ['btnAnswer', 8], ['btnAnswer', 9], ['btnAnswer', 10], ['btnAnswer', 11], ['btnAnswer', 12], ['btnAnswer', 13], ['btnAnswer', 14], ['btnAnswer', 15], ['btnAnswer', 16], ['btnAnswer', 17], ['btnAnswer', 18], ['btnAnswer', 19], ['btnAnswer', 20], ['btnAnswer', 21], ['btnAnswer', 22], ['btnAnswer', 23], ['btnAnswer', 24], ['btnAnswer', 25], ['btnAnswer', 26], ['btnAnswer', 27], ['btnAnswer', 28], ['btnAnswer', 29], ['btnAnswer', 30], ['btnAnswer', 31], ['btnAnswer', 32], ['btnAnswer', 33], ['btnAnswer', 34], ['btnAnswer', 35], ['btnAnswer', 36], ['btnAnswer', 37], ['btnAnswer', 38], ['btnAnswer', 39], ['btnAnswer', 40], ['btnAnswer', 41], ['btnAnswer', 42], ['btnAnswer', 43], ['btnAnswer', 44], ['btnAnswer', 45], ['btnAnswer', 46], ['btnAnswer', 47], ['btnAnswer', 48], ['btnAnswer', 49], ['btnAnswer', 50], ['btnAnswer', 51], ['btnAnswer', 52], ['btnAnswer', 53], ['btnAnswer', 54], ['btnAnswer', 55], ['btnAnswer', 56], ['btnAnswer', 57], ['btnAnswer', 58], ['btnAnswer', 59], ['btnAnswer', 60], ['btnAnswer', 61], ['btnAnswer', 62], ['btnAnswer', 63], ['btnAnswer', 64], ['btnAnswer', 65], ['btnAnswer', 66], ['btnAnswer', 67], ['btnAnswer', 68], ['btnAnswer', 69], ['btnAnswer', 70], ['btnAnswer', 71], ['btnAnswer', 72], ['btnAnswer', 73], ['btnAnswer', 74], ['btnAnswer', 75], ['btnAnswer', 76], ['btnAnswer', 77], ['btnAnswer', 78], ['btnAnswer', 79], ['btnAnswer', 80], ['btnAnswer', 81], ['btnAnswer', 82], ['btnAnswer', 83], ['btnAnswer', 84], ['btnAnswer', 85], ['btnAnswer', 86], ['btnAnswer', 87], ['btnAnswer', 88], ['btnAnswer', 89], ['btnAnswer', 90], ['btnAnswer', 91], ['btnAnswer', 92], ['btnAnswer', 93], ['btnAnswer', 94], ['btnAnswer', 95], ['btnAnswer', 96], ['btnAnswer', 97], ['btnAnswer', 98], ['btnAnswer', 99], ['btnAnswer', 100], ['btnAnswer', 101], ['btnAnswer', 102], ['btnAnswer', 103], ['btnAnswer', 104], ['btnAnswer', 105], ['btnAnswer', 106], ['btnAnswer', 107], ['btnAnswer', 108], ['btnAnswer', 109], ['btnAnswer', 110], ['btnAnswer', 111], ['btnAnswer', 112], ['btnAnswer', 113], ['btnAnswer', 114], ['btnAnswer', 115], ['btnAnswer', 116], ['btnAnswer', 117], ['btnAnswer', 118], ['btnAnswer', 119], ['btnAnswer', 120], ['btnAnswer', 121], ['btnAnswer', 122], ['btnAnswer', 123], ['btnAnswer', 124], ['btnAnswer', 125], ['btnAnswer', 126], ['btnAnswer', 127], ['btnAnswer', 128], ['btnAnswer', 129], ['btnAnswer', 130], ['btnAnswer', 131], ['btnAnswer', 132], ['btnAnswer', 133], ['btnAnswer', 134], ['btnAnswer', 135], ['btnAnswer', 136], ['btnAnswer', 137], ['btnAnswer', 138], ['btnAnswer', 139], ['btnAnswer', 140], ['btnAnswer', 141], ['btnAnswer', 142], ['btnAnswer', 143]]
    }
]
var red = [];
var blue = [];