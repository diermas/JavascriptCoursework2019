// See Real-Time Servers II: File Servers for understanding 
// how we set up and use express
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const mysql = require("mysql");
let timeStart = 0;
let playerCount = 0;
let hiscores = [];

// We will use the dungeongenerator module to generate random dungeons
// Details at: https://www.npmjs.com/package/dungeongenerator
// Source at: https://github.com/nerox8664/dungeongenerator
const DungeonGenerator = require("dungeongenerator");

// We are going to serve our static pages from the public directory
// See Real-Time Servers II: File Servers for understanding
// how we set up and use express
app.use(express.static("public"));

/*  These variables store information about the dungeon that we will later
 *  send to clients. In particular:
 *  - the dungeonStart variable will store the x and y coordinates of the start point of the dungeon
 *  - the dungeonEnd variable will store the x and y coordinates of the end point of the dungeon
 *  - the dungeonOptions object contains four variables, which describe the default state of the dungeon:
 *  - - dungeon_width: the width of the dungeon (size in the x dimension)
 *  - - dungeon_height: the height of the dungeon (size in the y dimension)
 *  - - number_of_rooms: the approximate number of rooms to generate
 *  - - average_room_size: roughly how big the rooms will be (in terms of both height and width)
 *  - this object is passed to the dungeon constructor in the generateDungeon function
 */
let dungeon = {};
let dungeonStart = {};
let dungeonEnd = {};

// Array that contains all the Player objects in the game
let players = [];

const dungeonOptions = {
    dungeon_width: 20,
    dungeon_height: 20,
    number_of_rooms: 7,
    average_room_size: 8
};

/*
 * The getDungeonData function packages up important information about a dungeon
 * into an object and prepares it for sending in a message. 
 *
 * The members of the returned object are as follows:
 *
 * - dungeon, an object, containing the following variables:
 * -- maze: a 2D array of integers, with the following numbers:
 * --- 0: wall
 * --- 1: corridor
 * --- 2+: numbered rooms, with 2 being the first room generated, 3 being the next, etc.
 * -- h: the height of the dungeon (y dimension)
 * -- w: the width of the dungeon (x dimension)
 * -- rooms: an array of objects describing the rooms in the dungeon, each object contains:
 * --- id: the integer representing this room in the dungeon (e.g. 2 for the first room)
 * --- h: the height of the room (y dimension)
 * --- w: the width of the room (x dimension)
 * --- x: the x coordinate of the top-left corner of the room
 * --- y: the y coordinate of the top-left corner of the room
 * --- cx: the x coordinate of the centre of the room
 * --- cy: the y coordinate of the centre of the room
 * -- roomSize: the average size of the rooms (as used when generating the dungeon)
 * -- _lastRoomId: the id of the next room to be generated (so _lastRoomId-1 is the last room in the dungeon)
 *
 * - startingPoint
 * -- x: the column at which players should start in the dungeon
 * -- y: the row at which players should start in the dungeon
 *
 * - endingPoint
 * -- x: the column where the goal space of the dungeon is located
 * -- y: the row where the goal space of the dungeon is located
 *
 */
function getDungeonData() {
    return {
        dungeon,
        startingPoint: dungeonStart,
        endingPoint: dungeonEnd
    };
}

/*
 * This is our event handler for a connection.
 * That is to say, any code written here executes when a client makes a connection to the server
 * (i.e. when the page is loaded)
 * 
 * See Real-Time Servers III: socket.io and Messaging for help understanding how
 * we set up and use socket.io
 */
io.on("connection", function (socket) {

    // Print an acknowledge to the server's console to confirm a player has connected
    console.log("A player has connected - sending dungeon data...");
	// Player count is used only to give players unique names when the server is run for adding to a database
	playerCount++;
	var defaultName = "Player " + playerCount;
	// Push the new player's information to the array
	players.push({x: dungeonStart.x, y: dungeonStart.y, facing: "down", id: socket.id, name: defaultName});

    /*
     * Here we send all information about a dungeon to the client that has just connected
     * For full details about the data being sent, check the getDungeonData method
     * This message triggers the socket.on("dungeon data"... event handler in the client
     */
    socket.emit("dungeon data", getDungeonData());
	socket.emit("hiscore data", hiscores);
	
	// Emit the players array to all currently connected clients
	io.emit("player data", players);
	
	// Remove a player from the array and log their disconnect 
	// when they leave the page
	socket.on("disconnect", function(){
		for (let i = 0; i < players.length; i++){
			if (players[i].id == socket.id){
				players.splice(i, 1);
			}
		}
		console.log("Player "+socket.id+" disconnected.");
		io.emit("player data", players);
	});
	// When a client passes the 'move' message to the server, the server calculates if the move is valid
	// If so, the player's position is updated, then the players array is re-sent to all clients
	// to update positions across all clients
	socket.on("move", function (direction) {
		let player = {};
		// Find the player that matches the socket
		for (let i = 0; i < players.length; i++){
			if (players[i].id == socket.id){
				player = players[i];
			}
		}
		// Depending on the direction, find out if the tile is valid for moving, 
		// then update the position and direction of the player
		if (direction == "up"){
			if (player.y - 1 >= 0 && dungeon.maze[player.y - 1][player.x] > 0) {
				player.y--;
				player.facing = "up";
			}
		} else if (direction == "down"){
			if (player.y + 1 < dungeon.h && dungeon.maze[player.y + 1][player.x] > 0) {
				player.y++;
				player.facing = "down";
			}
		} else if (direction == "left"){
			if (player.x - 1 >= 0 && dungeon.maze[player.y][player.x - 1] > 0) {
				player.x--;
				player.facing = "left";
			}
		} else if (direction == "right"){
			if (player.x + 1 < dungeon.w && dungeon.maze[player.y][player.x + 1] > 0) {
				player.x++;
				player.facing = "right";
			}
		}
		// Emit the new players array to all sockets
		io.emit("player data", players);
		// Check if the move ends on the dungeonEnd space
		if (player.x == dungeonEnd.x && player.y == dungeonEnd.y){
			// Calculate the time taken to complete the dungeon and format to min:sec:ms
			let timeEnd = new Date();
			let timeTaken = timeEnd - timeStart;
			let timeTakenMin = Math.floor((timeTaken/1000)/60);
			let timeTakenSec = Math.floor((timeTaken/1000)%60);
			let timeTakenMs = timeTaken%1000;
			let timeTakenString = timeTakenMin+":"+timeTakenSec+":"+timeTakenMs;
			// Print the winner to the console
			console.log(player.id+" Wins!!!!");
			console.log("Time taken: "+timeTakenString);
			console.log("Time taken in ms: "+timeTaken);
			// Update the database to add the new entry then generate a new level
			updateDatabase(player.name, timeTakenString);
			startLevel();
			// Emit the new dungeon and updated players array to all clients
			io.emit("dungeon data", getDungeonData());
			io.emit("player data", players);
		};
	});
	
	// When a client updates their username, find the correct player in the array and
	// update it here
	socket.on("username update", function(data){
		for (let i = 0; i < players.length; i++){
			if (socket.id == players[i].id){
				players[i].name = data;
			}
		}
		io.emit(players);
	});

});

/*
 * This method locates a specific room, based on a given index, and retrieves the
 * centre point, and returns this as an object with an x and y variable.
 * For example, this method given the integer 2, would return an object
 * with an x and y indicating the centre point of the room with an id of 2.
 */
function getCenterPositionOfSpecificRoom(roomIndex) {
    let position = {
        x: 0,
        y: 0
    };

    for (let i = 0; i < dungeon.rooms.length; i++) {
        let room = dungeon.rooms[i];
        if (room.id === roomIndex) {
            position.x = room.cx;
            position.y = room.cy;
            return position;
        }
    }
    return position;
}

/*
 * The generateDungeon function uses the dungeongenerator module to create a random dungeon,
 * which is stored in the 'dungeon' variable.
 *
 * Additionally, we find a start point (this is always the centre point of the first generated room)
 * and an end point is located (this is always the centre point of the last generated room).
 */
function generateDungeon() {
    dungeon = new DungeonGenerator(
        dungeonOptions.dungeon_height,
        dungeonOptions.dungeon_width,
        dungeonOptions.number_of_rooms,
        dungeonOptions.average_room_size
    );
    console.log(dungeon);
    dungeonStart = getCenterPositionOfSpecificRoom(2);
    dungeonEnd = getCenterPositionOfSpecificRoom(dungeon._lastRoomId - 1);
	console.log(dungeonStart.x);
	console.log(dungeonStart.y);
	console.log(dungeonEnd.x);
	console.log(dungeonEnd.y);
}

/* 
 * Function to create a new level, called when the server starts and when a dungeon is cleared,
 * The function first called generateDungeon, and then updates the timeStart variable with the new time
 * and updates all player positions in the players array, before logging the new start time to console.
 */
function startLevel() {
	generateDungeon();
	timeStart = new Date();
	for (let i = 0; i < players.length; i++){
		players[i].x = dungeonStart.x;
		players[i].y = dungeonStart.y;
		players[i].facing = "down";
	}
	console.log("New dungeon started at "+timeStart);
}

// Function to add a new dungeon clear time to the database
function updateDatabase(playerUsername, playerTimeTaken){
	var connection = mysql.createConnection({
		host: 'localhost',
		port: 3306,
		user: 'root',
		password: ''
	});	
	connection.connect();	
	connection.query("USE dungeongame", function (error, result, fields){
		if (error) {
			console.log("Error setting database for update: " + error.code);
		} else if (result){
			console.log("Database successfully set for update.");
		}
	});	
	var hiscore = {username: playerUsername, timeTaken: playerTimeTaken, entryId: hiscores.length};
	connection.query("INSERT INTO hiscores SET ?", hiscore, function(error, result, fields){
		if (error) {
			console.log("Error adding hiscore: " + error.code);
		} else if (result) {
			console.log("Hiscore successfully added.");
		}
	});	
	connection.end(function(){
		console.log("Connection closed.");
		// Update the hiscores array once the database is updated
		updateHiscores();
	});
}

// Function to connect to the database and copy all of the dungeon clear times from it to the
// server hiscores array
function updateHiscores(){
	var connection = mysql.createConnection({
		host: 'localhost',
		user: 'root',
		port: 3306,
		password: ''
	});
	connection.connect();
	connection.query("USE dungeongame", function (error, result, fields){
		if (error){
			console.log("Error setting database for reading: " + error.code);
		} else if (result) {
			console.log("Database successfully set for reading.");
		}
	});
	var query = connection.query("SELECT * FROM hiscores");
	hiscores = [];
	query.on('result', function (row){
		hiscores.push({username: row.username, timeTaken: row.timeTaken, id: row.entryId});
	});
	query.on('end', function(){
		connection.end();
		// Send the updates hiscores array to players
		io.emit("hiscore data", hiscores);
	});
}


/*
 * Start the server, listening on port 8081.
 * Once the server has started, output confirmation to the server's console.
 * After initial startup, generate a dungeon, ready for the first time a client connects.
 *
 */
server.listen(8081, function () {
    console.log("Dungeon server has started - connect to http://localhost:8081");
	startLevel();
	updateHiscores();
    console.log("Initial dungeon generated!");
});