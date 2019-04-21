// Note: the database code was adapted from the boxgame server code from Node and MySQL lab

var mysql = require("mysql");

// Establish the connection
var connection = mysql.createConnection({
	host: 'localhost',
	port: 3306,
	user: 'root',
	password: ''
});
connection.connect();

// Create the database if it doesn't already exist on the server
connection.query("CREATE DATABASE IF NOT EXISTS dungeongame;", function (error, result, fields){
	if (error){
		console.log("Error creating database: " + error.code);
	} else if (result){
		console.log("Database created successfully.");
	}
});

// Once the database is created, set it to be used
connection.query("USE dungeongame;", function (error, result, fields){
	if (error){
		console.log("Error setting database: " + error.code);
	} else if (result){
		console.log("Database successfully set.");
	}
});

// If the table already exists, drop it before recreating
connection.query("DROP TABLE IF EXISTS hiscores", function (error, result, fields) {
	if (error) {
		console.log("Problem dropping hiscores table: " + error.code);
	} else if (result){
		console.log("Hiscores table dropped successfully.");
	}
});

// Create a new table with 3 columns, username, timeTaken and entryId
var createTableQuery = "CREATE TABLE hiscores(";
	createTableQuery += "username		VARCHAR(20)		,";
	createTableQuery += "timeTaken		VARCHAR(20)		,";
	createTableQuery += "entryId		INT				,";
	createTableQuery += "PRIMARY KEY (entryId)";
	createTableQuery += ")";	
connection.query(createTableQuery, function(error, result, fields){
	if (error) {
		console.log("Error creating hiscores table: " + error.code);
	} else if (result) {
		console.log("Hiscores table created successfully.");
	}
});

// Close the connection
connection.end(function(){
	console.log("Script has finished executing.");
});