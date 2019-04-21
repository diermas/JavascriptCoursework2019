/*
 * These three variables hold information about the dungeon, received from the server
 * via the "dungeon data" message. Until the first message is received, they are
 * initialised to empty objects.
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
 * - dungeonStart
 * -- x, the row at which players should start in the dungeon
 * -- y, the column at which players should start in the dungeon
 *
 * - dungeonEnd
 * -- x, the row where the goal space of the dungeon is located
 * -- y, the column where the goal space of the dungeon  is located
 */
let dungeon = {};
let dungeonStart = {};
let dungeonEnd = {};

// load a spritesheet (dungeon_tiles.png) which holds the tiles
// we will use to draw the dungeon
// Art by MrBeast. Commissioned by OpenGameArt.org (http://opengameart.org)
const tilesImage = new Image();
tilesImage.src = "dungeon_tiles.png";

// Spritesheet for the character used in the dungeon
// Art by Cough-E. Found on OpenGameArt.org at (https://opengameart.org/content/base-character-spritesheet-16x16)
const charImage = new Image();
charImage.src = "Hero.png";
const enemyImage = new Image();
enemyImage.src = "Enemy.png";

/* 
 * Establish a connection to our server
 * We will need to reuse the 'socket' variable to both send messages
 * and receive them, by way of adding event handlers for the various
 * messages we expect to receive
 *
 * Replace localhost with a specific URL or IP address if testing
 * across multiple computers
 *
 * See Real-Time Servers III: socket.io and Messaging for help understanding how
 * we set up and use socket.io
 */
const socket = io.connect("http://localhost:8081");

 // Players array populated from server message
 let players = [];
 
 // Player object (info overwritten when receiving dungeon data)
 let id = 0;
 
 // Hiscore array containing all previous dungeon clear times
 let hiscores = [];

// Mouseover to show/hide the quadrants for mouse controls
let mouseOver = false;
let touchUsed = false;

/*
 * This is the event handler for the 'dungeon data' message
 * When a 'dungeon data' message is received from the server, this block of code executes
 * 
 * The server is sending us either initial information about a dungeon, or,
 * updated information about a dungeon, and so we want to replace our existing
 * dungeon variables with the new information.
 *
 * We know the specification of the information we receive (from the documentation
 * and design of the server), and use this to help write this handler.
 */
 
socket.on("dungeon data", function (data) {
    dungeon = data.dungeon;
    dungeonStart = data.startingPoint;
    dungeonEnd = data.endingPoint;
	// The client's id is the id of the socket
	id = socket.id;
});

// Update the client's internal players array.
socket.on("player data", function (data) {
	players = data;	
});

socket.on("hiscore data", function (data) {
	hiscores = data;
	// Clear the data from the table before adding in the extra rows
	$("#HiscoreTable tr").remove();
	// Update the text in the table
	$("#HiscoreTable").append("<tr><th>Player</th><th>Time Taken</th></tr>");
	for (let i = 0; i < hiscores.length; i++){
		var line = "<tr><td>";
			line += hiscores[i].username;
			line += "</td><td>";
			line += hiscores[i].timeTaken;
			line += "</td></tr>";
		$("#HiscoreTable").append(line);
	}
});

/*
 * The identifySpaceType function takes an x, y coordinate within the dungeon and identifies
 * which type of tile needs to be drawn, based on which directions it is possible
 * to move to from this space. For example, a tile from which a player can move up
 * or right from needs to have walls on the bottom and left.
 *
 * Once a tile type has been identified, the necessary details to draw this
 * tile are returned from this method. Those details specifically are:
 * - tilesetX: the x coordinate, in pixels, within the spritesheet (dungeon_tiles.png) of the top left of the tile
 * - tilesetY: the y coordinate, in pixels, within the spritesheet (dungeon_tiles.png) of the top left of the tile
 * - tilesizeX: the width of the tile
 * - tilesizeY: the height of the tile
 */
function identifySpaceType(x, y) {

    let returnObject = {
        spaceType: "",
        tilesetX: 0,
        tilesetY: 0,
        tilesizeX: 16,
        tilesizeY: 16
    };

    let canMoveUp = false;
    let canMoveLeft = false;
    let canMoveRight = false;
    let canMoveDown = false;

    // check for out of bounds (i.e. this move would move the player off the edge,
    // which also saves us from checking out of bounds of the array) and, if not
    // out of bounds, check if the space can be moved to (i.e. contains a corridor/room)
    if (x - 1 >= 0 && dungeon.maze[y][x - 1] > 0) {
        canMoveLeft = true;
    }
    if (x + 1 < dungeon.w && dungeon.maze[y][x + 1] > 0) {
        canMoveRight = true;
    }
    if (y - 1 >= 0 && dungeon.maze[y - 1][x] > 0) {
        canMoveUp = true;
    }
    if (y + 1 < dungeon.h && dungeon.maze[y + 1][x] > 0) {
        canMoveDown = true;
    }

    if (canMoveUp && canMoveRight && canMoveDown && canMoveLeft) {
        returnObject.spaceType = "all_exits";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 16;
    }
    else if (canMoveUp && canMoveRight && canMoveDown) {
        returnObject.spaceType = "left_wall";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 16;
    }
    else if (canMoveRight && canMoveDown && canMoveLeft) {
        returnObject.spaceType = "up_wall";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 0;
    }
    else if (canMoveDown && canMoveLeft && canMoveUp) {
        returnObject.spaceType = "right_wall";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 16;
    }
    else if (canMoveLeft && canMoveUp && canMoveRight) {
        returnObject.spaceType = "down_wall";
        returnObject.tilesetX = 16;
        returnObject.tilesetY = 32;
    }
    else if (canMoveUp && canMoveDown) {
        returnObject.spaceType = "vertical_corridor";
        returnObject.tilesetX = 144;
        returnObject.tilesetY = 16;
    }
    else if (canMoveLeft && canMoveRight) {
        returnObject.spaceType = "horizontal_corridor";
        returnObject.tilesetX = 112;
        returnObject.tilesetY = 32;
    }
    else if (canMoveUp && canMoveLeft) {
        returnObject.spaceType = "bottom_right";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 32;
    }
    else if (canMoveUp && canMoveRight) {
        returnObject.spaceType = "bottom_left";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 32;
    }
    else if (canMoveDown && canMoveLeft) {
        returnObject.spaceType = "top_right";
        returnObject.tilesetX = 32;
        returnObject.tilesetY = 0;
    }
    else if (canMoveDown && canMoveRight) {
        returnObject.spaceType = "top_left";
        returnObject.tilesetX = 0;
        returnObject.tilesetY = 0;
    }
    return returnObject;
}

/*
 * Once our page is fully loaded and ready, we call startAnimating
 * to kick off our animation loop.
 * We pass in a value - our fps - to control the speed of our animation.
 */
$(document).ready(function () {
	
	// When a client enters a new username, send a message to the server to update it in the array
	$("#usernameForm").submit(function(e){
		e.preventDefault();
		socket.emit("username update", $("#username").get(0).value 	);
		$("#username").get(0).value = "";
	});
	
	// Keyboard controls for arrow keys and WASD *using keyup so that you can't hold a key down to move fast)
	$(document).keyup(function (event) {
		let key = event.key;
		// Check if client is currently typing in the text box, and only move if not
		if ($(document.activeElement)[0].id != "username"){
			if (key == "a" || key == "ArrowLeft" || key == 'A') {
				socket.emit("move", "left");
			} else if (key == "d" || key == "ArrowRight" || key == 'D') {
				socket.emit("move", "right");
			} else if (key == "w" || key == "ArrowUp" || key == 'W') {
				socket.emit("move", "up");
			} else if (key == "s" || key == "ArrowDown" || key == 'S') {
				socket.emit("move", "down");
			}
		}
	});
	
	// Mouse click controls
	$("canvas").click(function (event) {
		let canvas = $(this);
		let width = canvas.attr("width");
		let height = canvas.attr("height");
		let mouseX = event.offsetX;
		let mouseY = event.offsetY;
		// Check if the click was in the top quadrant
		if (mouseY - mouseX <= 0 && mouseY + mouseX <= height){
			socket.emit("move", "up");
		// Check if the click was in the bottom quadrant
		} else if (mouseY - mouseX >= 0 && mouseY + mouseX >= height){
			socket.emit("move", "down");
		// Check if the click was in the left quadrant
		} else if (mouseY - mouseX >= 0 && mouseY + mouseX <= height){
			socket.emit("move", "left");
		// Check if the click was in the right quadrant
		} else if (mouseY - mouseX <= 0 && mouseY + mouseX >= height){
			socket.emit("move", "right");
		};
	});
	
	// Toggle mouseOver
	$("canvas").mouseenter(function () {
		mouseOver = true;
	});
	$("canvas").mouseleave(function () {
		mouseOver = false;
	});
	
	// Touch controls
	$("canvas").on("touchend", function (event) {
		event.preventDefault(); // preventDefault stops the event from triggering a click event as well
		touchUsed = true; // touchUsed becomes true to display the red lines marking the touch regions
		let touch = event.originalEvent.changedTouches[0]; // touch will contain the Touch object of the first touch point that was removed
		let cvs = event.target; // cvs is a reference to the canvas object to adjust the touch point for offset on the page
		let canvas = $(this);
		let width = canvas.attr("width");
		let height = canvas.attr("height");
		let touchX = touch.clientX - cvs.offsetLeft;
		let touchY = touch.clientY - cvs.offsetTop;
		// Check if the touch was in the top quadrant
		if (touchY - touchX <= 0 && touchY + touchX <= height){
			socket.emit("move", "up");
		// Check if the touch was in the bottom quadrant
		} else if (touchY - touchX >= 0 && touchY + touchX >= height){
			socket.emit("move", "down");
		// Check if the touch was in the left quadrant
		} else if (touchY - touchX >= 0 && touchY + touchX <= height){
			socket.emit("move", "left");
		// Check if the touch was in the right quadrant
		} else if (touchY - touchX <= 0 && touchY + touchX >= height){
			socket.emit("move", "right");
		};
	});
	
    startAnimating(60);
});

let fpsInterval;
let then;

/*
 * The startAnimating function kicks off our animation (see Games on the Web I - HTML5 Graphics and Animations).
 */
function startAnimating(fps) {
    fpsInterval = 1000 / fps;
    then = Date.now();
    animate();
}

// Counter and step are used to animate the character
let counter = 0;
let step = 0;

/*
 * The animate function is called repeatedly using requestAnimationFrame (see Games on the Web I - HTML5 Graphics and Animations).
 */
function animate() {
    requestAnimationFrame(animate);

    let now = Date.now();
    let elapsed = now - then;

    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);
        // Acquire both a canvas (using jQuery) and its associated context
        let canvas = $("canvas").get(0);
        let context = canvas.getContext("2d");

        // Calculate the width and height of each cell in our dungeon
        // by diving the pixel width/height of the canvas by the number of
        // cells in the dungeon
        let cellWidth = canvas.width / dungeon.w;
        let cellHeight = canvas.height / dungeon.h;

        // Clear the drawing area each animation cycle
        context.clearRect(0, 0, canvas.width, canvas.height);

        /* We check each one of our tiles within the dungeon using a nested for loop
         * which runs from 0 to the width of the dungeon in the x dimension
         * and from 0 to the height of the dungeon in the y dimension
         *
         * For each space in the dungeon, we check whether it is a space that can be
         * moved into (i.e. it isn't a 0 in the 2D array), and if so, we use the identifySpaceType
         * method to check which tile needs to be drawn.
         *
         * This returns an object containing the information required to draw a subset of the
         * tilesImage as appropriate for that tile.
         * See: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
         * to remind yourself how the drawImage method works.
         */
        for (let x = 0; x < dungeon.w; x++) {
            for (let y = 0; y < dungeon.h; y++) {
                if (dungeon.maze[y][x] > 0) {
                    let tileInformation = identifySpaceType(x, y);
                    context.drawImage(tilesImage,
                        tileInformation.tilesetX,
                        tileInformation.tilesetY,
                        tileInformation.tilesizeX,
                        tileInformation.tilesizeY,
                        x * cellWidth,
                        y * cellHeight,
                        cellWidth,
                        cellHeight);
                } else {
                    context.fillStyle = "black";
                    context.fillRect(
                        x * cellWidth,
                        y * cellHeight,
                        cellWidth,
                        cellHeight
                    );
                }
            }
        }

        // The start point is calculated by multiplying the cell location (dungeonStart.x, dungeonStart.y)
        // by the cellWidth and cellHeight respectively
        // Refer to: Games on the Web I - HTML5 Graphics and Animations, Lab Exercise 2
        context.drawImage(tilesImage,
            16, 80, 16, 16,
            dungeonStart.x * cellWidth,
            dungeonStart.y * cellHeight,
            cellWidth,
            cellHeight);

        // The goal is calculated by multiplying the cell location (dungeonEnd.x, dungeonEnd.y)
        // by the cellWidth and cellHeight respectively
        // Refer to: Games on the Web I - HTML5 Graphics and Animations, Lab Exercise 2
        context.drawImage(tilesImage,
            224, 80, 16, 16,
            dungeonEnd.x * cellWidth,
            dungeonEnd.y * cellHeight,
            cellWidth,
            cellHeight);
		
		// Loop through all connected players, drawing their avatar in the position given by the server
		let currentImage = new Image();
		for (let i = 0; i < players.length; i++){
			// If the ID matches, draw the player with the outline, otherwise draw the player without
			if (players[i].id == id){
				currentImage = charImage;
			} else {
				currentImage = enemyImage;
			}
			// Use a certain row of the spritesheet depending on player direction
			if (players[i].facing == "down"){
				context.drawImage(currentImage,(step+4)*32,0,32,32,players[i].x*cellWidth,players[i].y*cellHeight,cellWidth,cellHeight);
			} else if (players[i].facing == "up"){
				context.drawImage(currentImage,step*32,0,32,32,players[i].x*cellWidth,players[i].y*cellHeight,cellWidth,cellHeight);
			} else if (players[i].facing == "right"){
				context.drawImage(currentImage,(step+4)*32,32,32,32,players[i].x*cellWidth,players[i].y*cellHeight,cellWidth,cellHeight);
			} else if (players[i].facing == "left"){
				context.drawImage(currentImage,step*32,32,32,32,players[i].x*cellWidth,players[i].y*cellHeight,cellWidth,cellHeight);
			}
		};
		
		// Code to set the framerate for the animation of walking
		if (counter % 10 == 0) {
			if (step + 1 == 4) {
				step = 0;
			} else {
				step++;
			}
		};
		counter++;
		
		// Lines to mark quadrants for touch/mouse controls, only shows if the mouse is 
		// inside the canvas or touch controls have been used
		if (mouseOver || touchUsed) {
			context.strokeStyle = "red";
			context.beginPath();
			context.moveTo(0,0);
			context.lineTo(canvas.width,canvas.height);
			context.moveTo(canvas.width,0);
			context.lineTo(0,canvas.height);
			context.closePath();
			context.stroke();
		};
    }
}