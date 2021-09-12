// jshint esversion: 6
$("#logged-in").hide();

var auth = "#{user_session_auth}";

console.log(auth);

if(auth) {
	console.log("you're logged in!");
	$("#logged-out").hide();
	$("#logged-in").show();
}