const express = require('express');
const mysql = require('mysql')
const cors = require('cors')

const app = express()
app.use(cors())

const db = mysql.createConnection({
    host: "localhost",
    user: 'root',
    password: '',
    database: ''
})

app.get('/', (re, res)=> {
    return res .json("from backend side");  
})

/*
    dito ilalagay ang bawat table ng database boom panot!
*/
app.listen(5173, ()=>{
    console.log("listening");
})

