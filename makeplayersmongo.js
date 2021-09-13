//jshint esversion:6
var MongoClient = require('mongodb').MongoClient;
var json = require("jsonfile");
var fs = require("fs");

var progress = 0;
var username = process.env.MONGO_USER;
var password = process.env.MONGO_PASSWORD;

const uri = `mongodb+srv://${username}:${password}@cluster0.qrezy.mongodb.net?retryWrites=true&w=majority`;

MongoClient.connect(uri)
.then((client) => {
	console.log("Connected to Database");

	fs.readdir("./playerfiles", (err, files) => {
		files.forEach((file) => {
			if(file != '.DS_Store') {
				var arr = goAhead(file);
				const db = client.db("proplayers");
				var tag = file.substring(0, file.length-5).toLowerCase();
				var collection = db.collection(tag);

				collection.insertMany(arr)
				.then((result) => {
					console.log(result)
				})
				.catch(error => console.error(error));

				console.log(tag + " Done");
				}

		});
	});
	
})
.catch((err) => {
	console.log("server connection error!");
});


function goAhead(file) {
	console.log("Working... | " + file)
	var players = json.readFileSync("./playerfiles/"+file);

	var arr = [];

	for(player in players) {
		players[player].name = player;
		arr.push(players[player]);
	}

	// maybe this is a bad idea?
	arr.sort((a, b) => {
		return b.avgParse - a.avgParse;
	});

	return arr;
}
