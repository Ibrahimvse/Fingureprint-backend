const Database = require('better-sqlite3');
const path=require('path');
const databasePath=path.resolve(__dirname,'..\\..')+'\\database.db'
const db = new Database(databasePath, { verbose: console.log });
const createTimeOffTable="CREATE TABLE IF NOT EXISTS TimeOff('id' INTEGER PRIMARY KEY,'EmployeeId' INT,'TimeOffDate' date,'TimeOffOut' varchar,'TimeOffIn' varchar,'TimeOffTotal' INT)";
db.exec(createTimeOffTable);
const createEmplyeeTable="CREATE TABLE IF NOT EXISTS Employee('id' INTEGER PRIMARY KEY,'name' varchar,'department' varchar,'unit' varchar,'notes' varchar,'cardno' INTEGER, 'allowance' INTEGER ,'password' varchar ,'role' INTEGER )";
db.exec(createEmplyeeTable);
db.close();