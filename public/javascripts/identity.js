// jshint esversion: 6
$("#logged-in").hide();

var auth = "#{user_session_auth}";

if(auth) {
	$("#logged-out").hide();
	$("#logged-in").show();
}