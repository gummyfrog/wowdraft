require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';

const client = new MongoClient(uri);

let leaguesDB;
let playersDB;

async function connect() {
  await client.connect();
  console.log('Connected to Database');
  leaguesDB = client.db('wowdraft');
  playersDB = client.db('proplayers');
}

function leagues() {
  return leaguesDB.collection('leagues');
}

function players(tag) {
  return playersDB.collection(tag);
}

function users() {
  return leaguesDB.collection('users');
}

module.exports = { connect, leagues, players, users };
